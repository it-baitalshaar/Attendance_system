-- =============================================================================
-- OFFICE SCHEMA BOOTSTRAP (BioTime + Admin dashboard compatible)
-- Use when office_* tables do NOT exist yet in Supabase.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- This gives you:
--   • Full office employees (code, name, email, phone, department, device_id, dynamic_link_token)
--   • Check-in / check-out per day in office_attendance
--   • worked_hours per day (auto-calculated from check_out - check_in)
--   • Monthly total hours = SUM(worked_hours) in app or SQL (no extra table)
--   • Audit log of every punch in office_attendance_logs
--   • QR sessions table for backup attendance (optional)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) office_employees
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  department text NOT NULL DEFAULT 'Office',
  device_id text,
  dynamic_link_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_employees_employee_code ON public.office_employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_office_employees_department ON public.office_employees(department);

-- -----------------------------------------------------------------------------
-- 2) office_attendance_logs (one row per punch; BioTime sync inserts here first)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.office_employees(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('checkin', 'checkout')),
  method text NOT NULL DEFAULT 'biometric' CHECK (method IN ('qr', 'biometric', 'manual')),
  timestamp timestamptz NOT NULL,
  ip_address inet,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_attendance_logs_dedupe UNIQUE (employee_id, action, method, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_office_attendance_logs_employee_id ON public.office_attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_office_attendance_logs_timestamp ON public.office_attendance_logs(timestamp DESC);

-- -----------------------------------------------------------------------------
-- 3) office_attendance (one row per employee per day; worked_hours auto-calculated)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.office_employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  worked_hours numeric,
  method text NOT NULL DEFAULT 'biometric' CHECK (method IN ('biometric', 'qr', 'manual')),
  device text,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_attendance_unique_employee_date UNIQUE (employee_id, date),
  CONSTRAINT office_attendance_check_order CHECK (
    check_in IS NULL OR check_out IS NULL OR check_out >= check_in
  )
);

CREATE INDEX IF NOT EXISTS idx_office_attendance_employee_date ON public.office_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_office_attendance_date ON public.office_attendance(date DESC);

-- Trigger: set worked_hours when check_in/check_out change (daily total)
CREATE OR REPLACE FUNCTION public.office_compute_worked_hours()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
    NEW.worked_hours := ROUND(EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0, 2);
  ELSE
    NEW.worked_hours := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_office_compute_worked_hours ON public.office_attendance;
CREATE TRIGGER trg_office_compute_worked_hours
  BEFORE INSERT OR UPDATE OF check_in, check_out
  ON public.office_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.office_compute_worked_hours();

-- -----------------------------------------------------------------------------
-- 4) office_qr_sessions (for QR backup attendance; optional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL,
  shift text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_qr_sessions_expires_at ON public.office_qr_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- 5) RLS (employee sees own row by email; admin needs separate policy)
-- -----------------------------------------------------------------------------
ALTER TABLE public.office_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_qr_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_employees_select_own" ON public.office_employees;
CREATE POLICY "office_employees_select_own"
  ON public.office_employees FOR SELECT TO authenticated
  USING (email IS NOT NULL AND (auth.jwt() ->> 'email') = email);

DROP POLICY IF EXISTS "office_attendance_select_own" ON public.office_attendance;
CREATE POLICY "office_attendance_select_own"
  ON public.office_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.office_employees e
      WHERE e.id = office_attendance.employee_id
        AND e.email IS NOT NULL AND (auth.jwt() ->> 'email') = e.email
    )
  );

DROP POLICY IF EXISTS "office_attendance_logs_select_own" ON public.office_attendance_logs;
CREATE POLICY "office_attendance_logs_select_own"
  ON public.office_attendance_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.office_employees e
      WHERE e.id = office_attendance_logs.employee_id
        AND e.email IS NOT NULL AND (auth.jwt() ->> 'email') = e.email
    )
  );

-- -----------------------------------------------------------------------------
-- 6) Realtime (admin dashboard + every transaction live)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'office_employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_employees;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'office_attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_attendance;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'office_attendance_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_attendance_logs;
  END IF;
END $$;

-- =============================================================================
-- AFTER RUNNING THIS:
-- Run add_office_admin_policies.sql so admin users (profiles.role = 'admin')
-- can read all office_employees and office_attendance in the admin panel.
-- =============================================================================
