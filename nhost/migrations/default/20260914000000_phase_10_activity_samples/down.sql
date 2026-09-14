DROP VIEW public.activity_grade_segments;
DROP FUNCTION public.grade_band(real);
DROP VIEW public.activity_sample_grades;

ALTER TABLE public.activities
  DROP COLUMN samples_synced_at;

DROP TABLE public.activity_samples;

-- The extensions are left installed: other objects may depend on them, and
-- dropping postgis would cascade into any geometry column added since.
