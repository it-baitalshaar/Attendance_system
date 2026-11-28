-- Employee vacation periods (approved annual leave / away ranges).
--
-- Why: attendance is submitted per day. When someone goes on vacation mid-period
-- the later days usually have no Attendance row at all, so the Attendance Report
-- used to list them as "no attendance record" (an issue). A vacation period tells
-- the report those days are vacation, not gaps.
--
-- The report adds missing days inside a period as V (Vacation) rows, so they are
-- counted in the card's VACATION stat and never flagged as missing.

CREATE TABLE IF NOT EXISTS public.employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public."Employee"(employee_id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_vacations_range_check CHECK (to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_employee_range
  ON public.employee_vacations (employee_id, from_date, to_date);

COMMENT ON TABLE public.employee_vacations IS
  'Approved vacation periods per employee. The Attendance Report treats days inside a period as vacation (V), not missing.';

ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;

-- Admins manage vacation periods (Employees tab -> Manage Employee).
DROP POLICY IF EXISTS "employee_vacations_admin_all" ON public.employee_vacations;
CREATE POLICY "employee_vacations_admin_all"
  ON public.employee_vacations
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
