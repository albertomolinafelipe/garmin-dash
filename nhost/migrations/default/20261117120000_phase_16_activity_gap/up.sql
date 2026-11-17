-- Grade adjusted pace per run, from the personal curve in gap_curve.
--
-- Each sample step's distance is weighted by the curve's factor at the step's
-- grade (activity_sample_grades), so gap_ratio = grade-adjusted distance /
-- distance. GAP speed is the activity's speed times the ratio, and GAP distance
-- its distance times the ratio. Grades beyond the well-sampled part of the
-- curve (30+ windows per bucket) take the factor at its edge.
CREATE MATERIALIZED VIEW public.activity_gap AS
WITH curve AS (
  SELECT grade_pct, factor FROM public.gap_curve WHERE windows >= 30
),
bounds AS (
  SELECT min(grade_pct) AS lo, max(grade_pct) AS hi FROM curve
),
steps AS (
  SELECT
    g.activity_id,
    g.distance_m - lag(g.distance_m) OVER w AS dx,
    g.grade_pct
  FROM public.activity_sample_grades g
  JOIN public.activities a ON a.id = g.activity_id
  WHERE a.activity_type IN ('running', 'trail_running')
  WINDOW w AS (PARTITION BY g.activity_id ORDER BY g.recorded_at)
)
SELECT
  s.activity_id,
  -- No grade (track start, missing altitude) counts as flat. least() skips
  -- NULLs, so without the guard a missing grade clamped to the steepest bucket.
  (sum(
    s.dx * CASE WHEN s.grade_pct IS NULL THEN 1 ELSE coalesce(c.factor, 1) END
  ) / nullif(sum(s.dx), 0))::real AS gap_ratio
FROM steps s
CROSS JOIN bounds b
LEFT JOIN curve c
  ON c.grade_pct = round(greatest(b.lo, least(b.hi, s.grade_pct)) / 2) * 2
WHERE s.dx > 0
GROUP BY s.activity_id;

CREATE UNIQUE INDEX activity_gap_activity_id_idx ON public.activity_gap (activity_id);

-- Hill fitness per quarter. Every steady one-minute window (same filters as
-- gap_curve) is compared with the all-time curve at its own grade bucket, so a
-- quarter's index is not skewed by which grades happened to be run in it:
-- 1.0 is the athlete's all-time average, below 1 is better than usual.
CREATE MATERIALIZED VIEW public.gap_trend AS
WITH windows AS (
  SELECT
    s.activity_id,
    avg(s.hr) AS hr,
    max(s.elapsed_s) - min(s.elapsed_s) AS dt,
    max(s.distance_m) - min(s.distance_m) AS dd,
    last(s.altitude_m, s.elapsed_s) - first(s.altitude_m, s.elapsed_s) AS dz,
    stddev(s.hr) AS hr_sd
  FROM public.activity_samples s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE a.activity_type IN ('running', 'trail_running') AND s.hr IS NOT NULL
  GROUP BY s.activity_id, s.elapsed_s / 60
),
steady AS (
  SELECT activity_id, hr / (dd / dt) AS cost, 100 * dz / dd AS grade_pct
  FROM windows
  WHERE dt >= 50 AND dd / dt > 1.0 AND hr_sd < 8 AND hr > 100
),
flat AS (
  SELECT activity_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY cost) AS flat_cost
  FROM steady
  WHERE abs(grade_pct) < 2
  GROUP BY activity_id
  HAVING count(*) >= 5
),
relative AS (
  SELECT
    date_trunc('quarter', a.start_time)::date AS quarter,
    st.grade_pct,
    (st.cost / f.flat_cost) / c.factor AS ratio
  FROM steady st
  JOIN flat f USING (activity_id)
  JOIN public.activities a ON a.id = st.activity_id
  JOIN public.gap_curve c
    ON c.grade_pct = round(st.grade_pct / 2) * 2 AND c.windows >= 30
)
SELECT
  quarter,
  (percentile_cont(0.5) WITHIN GROUP (ORDER BY ratio)
    FILTER (WHERE grade_pct >= 4))::real AS uphill_index,
  (count(*) FILTER (WHERE grade_pct >= 4))::int AS uphill_windows,
  (percentile_cont(0.5) WITHIN GROUP (ORDER BY ratio)
    FILTER (WHERE grade_pct <= -4))::real AS downhill_index,
  (count(*) FILTER (WHERE grade_pct <= -4))::int AS downhill_windows
FROM relative
GROUP BY quarter;

CREATE UNIQUE INDEX gap_trend_quarter_idx ON public.gap_trend (quarter);

-- Weekly objectives can target grade-adjusted distance.
ALTER TABLE public.week_objectives DROP CONSTRAINT week_objectives_metric;
ALTER TABLE public.week_objectives ADD CONSTRAINT week_objectives_metric CHECK (
  metric IN ('distance', 'gap_distance', 'elevation', 'duration', 'sessions')
);
