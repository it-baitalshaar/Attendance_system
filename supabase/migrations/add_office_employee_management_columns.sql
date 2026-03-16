-- =============================================================================
-- Office employees: add management columns (salary, min/max working hours)
-- Safe to run multiple times. Only adds columns if missing; no data loss.
-- Does NOT alter or drop any existing columns or tables.
-- =============================================================================

-- Add salary (nullable; existing rows keep NULL or you can backfill later)
ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT NULL;

-- Min/max working hours expected per month (e.g. 160 and 200)
ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS min_working_hours numeric DEFAULT NULL;

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS max_working_hours numeric DEFAULT NULL;

COMMENT ON COLUMN public.office_employees.salary IS 'Employee salary (numeric, e.g. 50000.00)';
COMMENT ON COLUMN public.office_employees.min_working_hours IS 'Minimum expected working hours per month';
COMMENT ON COLUMN public.office_employees.max_working_hours IS 'Maximum expected working hours per month';

-- Allow admin users to UPDATE office_employees (for edit-employee UI)
DROP POLICY IF EXISTS "office_employees_update_admin" ON public.office_employees;
CREATE POLICY "office_employees_update_admin"
ON public.office_employees
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
