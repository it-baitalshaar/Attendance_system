-- Admin-configured public holidays (Eid, etc.) for automatic public-holiday overtime defaults.
-- department_id NULL = applies to all departments.

CREATE TABLE IF NOT EXISTS public.department_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_holidays_dept_date_unique UNIQUE (department_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_department_holidays_date
  ON public.department_holidays (holiday_date)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_department_holidays_department
  ON public.department_holidays (department_id)
  WHERE is_active = true;

COMMENT ON TABLE public.department_holidays IS
  'Public holidays for field attendance. NULL department_id = all departments.';

ALTER TABLE public.department_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "department_holidays_select_authenticated" ON public.department_holidays;
CREATE POLICY "department_holidays_select_authenticated"
  ON public.department_holidays
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "department_holidays_admin_all" ON public.department_holidays;
CREATE POLICY "department_holidays_admin_all"
  ON public.department_holidays
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
