DROP TABLE public.week_objectives;
DROP TABLE public.week_notes;
DROP TABLE public.day_plans;
DROP TABLE public.sports;

CREATE TABLE public.plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  start_week text NOT NULL,
  end_week text NOT NULL,
  notes text NULL,
  CONSTRAINT plans_start_week_iso CHECK (start_week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT plans_end_week_iso CHECK (end_week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT plans_week_order CHECK (end_week >= start_week)
);

CREATE TABLE public.plan_requirements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  week text NOT NULL,
  sport text NULL,
  metric text NOT NULL,
  target numeric NOT NULL,
  notes text NULL,
  CONSTRAINT plan_requirements_week_iso CHECK (week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT plan_requirements_sport CHECK (
    sport IS NULL OR sport IN
      ('running', 'climbing', 'strength', 'hiking', 'swimming', 'cycling', 'other')
  ),
  CONSTRAINT plan_requirements_metric CHECK (
    metric IN ('distance', 'elevation', 'duration', 'sessions')
  )
);

CREATE TABLE public.plan_workouts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  week text NOT NULL,
  day_of_week text NOT NULL,
  sport text NOT NULL,
  title text NOT NULL,
  description text NULL,
  completed_at timestamptz NULL,
  CONSTRAINT plan_workouts_week_iso CHECK (week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT plan_workouts_day CHECK (
    day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
  ),
  CONSTRAINT plan_workouts_sport CHECK (
    sport IN ('running', 'climbing', 'strength', 'hiking', 'swimming', 'cycling', 'other')
  )
);

CREATE INDEX plan_requirements_plan_id_week_idx
  ON public.plan_requirements (plan_id, week);
CREATE INDEX plan_workouts_plan_id_week_idx
  ON public.plan_workouts (plan_id, week);
