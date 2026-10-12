-- Retired shoes. Kept rather than deleted so their activities keep the link and
-- lifetime mileage stays visible; the dashboard demotes them in pickers.
ALTER TABLE public.shoes
  ADD COLUMN archived boolean NOT NULL DEFAULT false;
