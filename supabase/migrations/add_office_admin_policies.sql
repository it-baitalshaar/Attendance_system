-- =============================================================================
-- Office module: allow admin users (profiles.role='admin') to read office tables
-- Does NOT modify any existing (non-office) tables.
-- =============================================================================

-- office_employees: admin can read all
DROP POLICY IF EXISTS "office_employees_select_admin" ON public.office_employees;
CREATE POLICY "office_employees_select_admin"
ON public.office_employees
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- office_attendance: admin can read all
DROP POLICY IF EXISTS "office_attendance_select_admin" ON public.office_attendance;
CREATE POLICY "office_attendance_select_admin"
ON public.office_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- office_attendance_logs: admin can read all
DROP POLICY IF EXISTS "office_attendance_logs_select_admin" ON public.office_attendance_logs;
CREATE POLICY "office_attendance_logs_select_admin"
ON public.office_attendance_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- office_qr_sessions: admin can read all (generation UI will also need insert later)
DROP POLICY IF EXISTS "office_qr_sessions_select_admin" ON public.office_qr_sessions;
CREATE POLICY "office_qr_sessions_select_admin"
ON public.office_qr_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

