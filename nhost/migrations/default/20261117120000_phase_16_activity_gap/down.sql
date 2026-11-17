DELETE FROM public.week_objectives WHERE metric = 'gap_distance';
ALTER TABLE public.week_objectives DROP CONSTRAINT week_objectives_metric;
ALTER TABLE public.week_objectives ADD CONSTRAINT week_objectives_metric CHECK (
  metric IN ('distance', 'elevation', 'duration', 'sessions')
);
DROP MATERIALIZED VIEW public.gap_trend;
DROP MATERIALIZED VIEW public.activity_gap;
