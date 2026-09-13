DROP TABLE public.plan_workouts;
DROP TABLE public.plan_requirements;
DROP TABLE public.plans;

-- Sport vocabulary, referenced by day_plans and week_objectives. A table rather
-- than a CHECK so adding a sport is a row, not a migration.
CREATE TABLE public.sports (
  value text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL UNIQUE
);

INSERT INTO public.sports (value, label, sort_order) VALUES
  ('running', 'Running', 1),
  ('climbing', 'Climbing', 2),
  ('skiing', 'Skiing', 3),
  ('strength', 'Strength', 4),
  ('hiking', 'Hiking', 5),
  ('swimming', 'Swimming', 6),
  ('cycling', 'Cycling', 7),
  ('other', 'Other', 8);

-- A free-text intention for a single day. sport NULL means unspecified.
CREATE TABLE public.day_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date date NOT NULL,
  sport text NULL REFERENCES public.sports(value) ON UPDATE CASCADE,
  note text NOT NULL,
  CONSTRAINT day_plans_note_not_blank CHECK (btrim(note) <> '')
);

CREATE INDEX day_plans_date_idx ON public.day_plans (date);

-- ISO year-week token, e.g. '2026-W01'.
CREATE TABLE public.week_notes (
  week text PRIMARY KEY,
  note text NOT NULL,
  CONSTRAINT week_notes_week_iso CHECK (week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT week_notes_note_not_blank CHECK (btrim(note) <> '')
);

-- Measurable weekly target, diffed against real activity totals in that ISO
-- week. sport NULL means the objective spans all sports.
CREATE TABLE public.week_objectives (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week text NOT NULL,
  sport text NULL REFERENCES public.sports(value) ON UPDATE CASCADE,
  metric text NOT NULL,
  target numeric NOT NULL,
  notes text NULL,
  CONSTRAINT week_objectives_week_iso CHECK (week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  CONSTRAINT week_objectives_metric CHECK (
    metric IN ('distance', 'elevation', 'duration', 'sessions')
  ),
  CONSTRAINT week_objectives_target_positive CHECK (target > 0)
);

CREATE INDEX week_objectives_week_idx ON public.week_objectives (week);
