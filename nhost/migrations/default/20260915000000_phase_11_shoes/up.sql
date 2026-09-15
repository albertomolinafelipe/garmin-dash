-- Gear, mainly running shoes. image_url points at a picture shown in the UI;
-- starting_km seeds distance already run before importing, so lifetime mileage
-- can include prior use.
CREATE TABLE public.shoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  image_url text NULL,
  starting_km numeric NOT NULL DEFAULT 0,
  CONSTRAINT shoes_name_not_blank CHECK (btrim(name) <> '')
);

-- Which shoe an activity was run in. NULL for everything imported so far; making
-- it required from a cutoff date is an annotation-completeness rule in the
-- dashboard, not a constraint here, so historical rows stay valid.
ALTER TABLE public.activities
  ADD COLUMN shoe_id bigint NULL
    REFERENCES public.shoes(id) ON DELETE SET NULL;
