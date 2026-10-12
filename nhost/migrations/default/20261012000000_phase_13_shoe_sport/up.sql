-- Which sport a shoe is for (running, climbing, skiing), reusing the
-- public.sports vocabulary rather than a separate category list. Every shoe so
-- far is a running shoe, so that is the default for existing rows.
ALTER TABLE public.shoes
  ADD COLUMN sport text NOT NULL DEFAULT 'running'
    REFERENCES public.sports(value) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX shoes_sport_idx ON public.shoes (sport);
