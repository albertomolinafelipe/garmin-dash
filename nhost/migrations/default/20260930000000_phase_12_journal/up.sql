-- Kind vocabulary for journal entries. A table rather than a CHECK so adding a
-- kind is a row, not a migration -- same reasoning as public.sports.
--
-- Unlike sports, the icon and colour live here too. sports gets away with
-- keeping those in the dashboard (categoryIcon/categoryColor) because its
-- vocabulary is fixed by Garmin's activity types; the whole point of this table
-- is that a future kind can be added without touching code, which only works if
-- it arrives with everything needed to render it.
CREATE TABLE public.journal_kinds (
  value text PRIMARY KEY,
  label text NOT NULL,
  -- Iconify name, resolved by the dashboard's iconifyIcon().
  icon text NOT NULL,
  -- Any CSS colour; used for the chip's left border and icon.
  color text NOT NULL,
  -- Whether entries of this kind usually carry a 1-5 severity. Advisory: the
  -- form hides the field when false, the column stays nullable either way.
  has_severity boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL UNIQUE
);

-- Colours are the Kanagawa "autumn" tones the dashboard already uses for
-- activity categories, picked to stay distinguishable from the sport palette.
INSERT INTO public.journal_kinds (value, label, icon, color, has_severity, sort_order) VALUES
  ('trip',    'Trip',    'mdi:airplane',             '#7AA89F', false, 1),
  ('illness', 'Illness', 'mdi:virus-outline',        '#C34043', true,  2),
  ('injury',  'Injury',  'mdi:bandage',              '#DCA561', true,  3),
  ('feeling', 'Feeling', 'mdi:emoticon-sad-outline', '#957FB8', true,  4),
  ('life',    'Life',    'mdi:calendar-heart',       '#658594', false, 5),
  ('note',    'Note',    'mdi:note-text-outline',    '#727169', false, 6);

-- A dated record of something that happened, spanning one or more days: a trip,
-- an illness, an injury, or just "felt flat today".
--
-- Modelled as a range rather than one row per day because nearly everything
-- worth recording is a span -- a trip is a fortnight, a cold is three days, an
-- injury runs for months. end_date NULL means open ended ("started Tuesday,
-- still going"); a single day is simply end_date = start_date.
--
-- Entries may overlap freely: being ill during a trip, or carrying a nagging
-- injury through both, is the normal case, not a data error.
CREATE TABLE public.journal_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL REFERENCES public.journal_kinds(value) ON UPDATE CASCADE,
  start_date date NOT NULL,
  end_date date NULL,
  -- Short label for the calendar chip, e.g. "Chamonix".
  title text NOT NULL,
  -- Optional long form, shown on hover and in the dialog.
  note text NULL,
  -- Subjective 1 (mild) to 5 (severe). Kept deliberately coarse so it can be
  -- charted against the objective daily_hrv / training_readiness series.
  severity smallint NULL,
  -- Escape hatch for kind-specific fields a future kind needs (injured body
  -- part, trip location) without a migration per kind. Nothing writes it yet.
  data jsonb NULL,
  CONSTRAINT journal_entries_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT journal_entries_note_not_blank
    CHECK (note IS NULL OR btrim(note) <> ''),
  CONSTRAINT journal_entries_date_order
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT journal_entries_severity_range
    CHECK (severity IS NULL OR severity BETWEEN 1 AND 5)
);

-- The calendar asks for entries overlapping a visible window, which is a
-- predicate on both ends of the range.
CREATE INDEX journal_entries_range_idx
  ON public.journal_entries (start_date, end_date);
