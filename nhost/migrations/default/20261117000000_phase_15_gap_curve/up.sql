-- Personal grade adjustment curve: for each 2% grade bucket, how much slower
-- (factor > 1) or faster than flat the same heart rate carries you. Measured as
-- in Strava's equal-heart-rate GAP model, on this athlete's runs alone:
--
--   * one-minute windows of running and trail running samples;
--   * kept only when steady: HR spread under 8 bpm, moving faster than 1 m/s,
--     HR above 100, at least 50 s of data;
--   * cost = HR / speed, normalised by the median cost of the same activity's
--     flat windows (|grade| < 2%, at least five of them), so fitness, weather
--     and fatigue that differ between days cancel out;
--   * factor = median normalised cost per bucket, buckets with 10+ windows.
--
-- Materialized because it scans every sample (seconds, not milliseconds); the
-- sync CLI refreshes it after each run.
CREATE MATERIALIZED VIEW public.gap_curve AS
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
)
SELECT
  (round(grade_pct / 2) * 2)::smallint AS grade_pct,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY cost / flat_cost)::real AS factor,
  count(*)::int AS windows,
  count(DISTINCT activity_id)::int AS activities
FROM steady JOIN flat USING (activity_id)
WHERE abs(grade_pct) <= 40
GROUP BY 1
HAVING count(*) >= 10;

CREATE UNIQUE INDEX gap_curve_grade_pct_idx ON public.gap_curve (grade_pct);
