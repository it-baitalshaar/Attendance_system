-- Add department-level controls for overtime type availability.
-- Normal overtime remains always available; these toggles control optional types.
ALTER TABLE public.departments
ADD COLUMN IF NOT EXISTS allow_holiday_overtime BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_public_holiday_overtime BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.departments.allow_holiday_overtime
IS 'When true, supervisors can choose Holiday overtime (x1.5) for this department.';

COMMENT ON COLUMN public.departments.allow_public_holiday_overtime
IS 'When true, supervisors can choose Public holiday overtime (x2.5) for this department.';
