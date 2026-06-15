-- Per-department weekend days for automatic weekend overtime defaults.
-- Day numbers: 0 = Sunday … 6 = Saturday (JavaScript Date.getDay()).

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS weekend_days integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.departments.weekend_days IS
  'Weekend weekdays (0=Sun … 6=Sat). Used to default project overtime to holiday (×1.5) on those days.';

-- Sensible defaults for existing field departments.
UPDATE public.departments
SET weekend_days = ARRAY[6]
WHERE lower(trim(name)) = 'construction'
  AND (weekend_days IS NULL OR weekend_days = '{}');

UPDATE public.departments
SET weekend_days = ARRAY[0]
WHERE lower(trim(name)) = 'maintenance'
  AND (weekend_days IS NULL OR weekend_days = '{}');
