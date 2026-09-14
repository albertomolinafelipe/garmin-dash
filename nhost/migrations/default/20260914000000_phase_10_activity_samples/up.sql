-- timescaledb is a trusted extension, so the migration role can install it.
-- postgis is NOT trusted and needs a superuser, which the migration role is
-- not: create it once per environment before migrating (see README, "Database
-- bootstrap"). Once it exists this statement is a no-op the migration role is
-- allowed to run, so the migration stays portable.
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Full-resolution activity stream: one row per FIT record message, every
-- channel sharing a single timestamp. This replaces activity_streams.payload,
-- where the series were downsampled independently and so could not be joined.
--
-- activity_streams is intentionally left in place until the backfill is
-- verified; nothing reads this table yet.
CREATE TABLE public.activity_samples (
  activity_id bigint NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  -- Seconds since the activity's first record. Redundant with recorded_at, but
  -- it keeps the common "plot against elapsed time" query off a correlated
  -- subquery for the activity start.
  elapsed_s integer NOT NULL,
  hr smallint NULL,
  altitude_m real NULL,
  -- Cumulative distance, straight from the FIT record.
  distance_m real NULL,
  geom geometry(Point, 4326) NULL,
  PRIMARY KEY (activity_id, recorded_at)
);

SELECT create_hypertable(
  'public.activity_samples',
  'recorded_at',
  chunk_time_interval => INTERVAL '30 days'
);

-- Marks an activity as having full-resolution samples. The backfill uses this
-- to resume, and it is the ONLY column on activities that the backfill writes.
ALTER TABLE public.activities
  ADD COLUMN samples_synced_at timestamptz NULL;

-- Per-sample gradient. Raw point-to-point grade is unusable (GPS altitude
-- jitters by metres between consecutive seconds), so rise and run are measured
-- across a lookback window instead.
CREATE VIEW public.activity_sample_grades AS
SELECT
  activity_id,
  recorded_at,
  elapsed_s,
  hr,
  altitude_m,
  distance_m,
  geom,
  CASE
    WHEN run_m > 0 THEN (rise_m / run_m) * 100
  END::real AS grade_pct
FROM (
  SELECT
    activity_id,
    recorded_at,
    elapsed_s,
    hr,
    altitude_m,
    distance_m,
    geom,
    altitude_m - lag(altitude_m, 15) OVER w AS rise_m,
    distance_m - lag(distance_m, 15) OVER w AS run_m
  FROM public.activity_samples
  WINDOW w AS (PARTITION BY activity_id ORDER BY recorded_at)
) windowed;

-- Signed steepness band: 0 flat, 1..5 uphill, -1..-5 downhill. Thresholds live
-- here alone, so retuning them never requires touching stored data.
CREATE FUNCTION public.grade_band(grade_pct real)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN grade_pct IS NULL THEN NULL
    WHEN grade_pct >=  35 THEN  5
    WHEN grade_pct >=  25 THEN  4
    WHEN grade_pct >=  15 THEN  3
    WHEN grade_pct >=   8 THEN  2
    WHEN grade_pct >=   3 THEN  1
    WHEN grade_pct <= -35 THEN -5
    WHEN grade_pct <= -25 THEN -4
    WHEN grade_pct <= -15 THEN -3
    WHEN grade_pct <=  -8 THEN -2
    WHEN grade_pct <=  -3 THEN -1
    ELSE 0
  END::smallint;
$$;

-- Contiguous runs of one steepness band, collapsed into segments with their own
-- geometry, so a route can be drawn or marked up by how steep each part was.
--
-- Short segments are dropped: without a floor, band flapping around a threshold
-- produces thousands of metre-long slivers.
CREATE VIEW public.activity_grade_segments AS
WITH banded AS (
  SELECT
    activity_id,
    recorded_at,
    elapsed_s,
    altitude_m,
    distance_m,
    geom,
    public.grade_band(grade_pct) AS band
  FROM public.activity_sample_grades
  WHERE grade_pct IS NOT NULL
),
islands AS (
  SELECT
    *,
    row_number() OVER (PARTITION BY activity_id ORDER BY recorded_at)
      - row_number() OVER (PARTITION BY activity_id, band ORDER BY recorded_at)
      AS island
  FROM banded
)
SELECT
  activity_id,
  band,
  min(recorded_at) AS started_at,
  max(recorded_at) AS ended_at,
  max(elapsed_s) - min(elapsed_s) AS duration_s,
  max(distance_m) - min(distance_m) AS length_m,
  -- Signed: last minus first, not max minus min, so a descent reads negative.
  last(altitude_m, recorded_at) - first(altitude_m, recorded_at)
    AS elevation_delta_m,
  ST_MakeLine(geom ORDER BY recorded_at) AS geom
FROM islands
GROUP BY activity_id, band, island
HAVING max(distance_m) - min(distance_m) >= 50;
