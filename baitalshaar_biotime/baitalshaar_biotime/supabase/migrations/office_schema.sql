-- BioTime Office schema for Supabase
-- Paste this into Supabase Dashboard → SQL Editor → New query → Run.
-- Run "add_office_tables_to_realtime_publication.sql" afterward if you want Realtime for the dashboard.

-- 1) office_employees
-- Used by: Import Employees from BioTime, sync script (employee_code → id), APIs
CREATE TABLE IF NOT EXISTS office_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  email text NOT NULL,
  device_id text,
  dynamic_link_token text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- 2) office_attendance_logs
-- One row per punch (check-in/check-out). Sync script inserts; duplicate (employee_id, action, method, timestamp) is skipped.
CREATE TABLE IF NOT EXISTS office_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES office_employees(id) ON DELETE CASCADE,
  action text NOT NULL,
  method text NOT NULL DEFAULT 'biometric',
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, action, method, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_office_attendance_logs_employee_id ON office_attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_office_attendance_logs_timestamp ON office_attendance_logs(timestamp);

-- 3) office_attendance
-- One row per employee per day. Sync upserts by (employee_id, date). worked_hours is computed.
CREATE TABLE IF NOT EXISTS office_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES office_employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  worked_hours numeric GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN ROUND((EXTRACT(EPOCH FROM (check_out - check_in)) / 3600.0)::numeric, 2)
    ELSE NULL END
  ) STORED,
  method text DEFAULT 'biometric',
  device text,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, date),
  CONSTRAINT office_attendance_check_order CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);

CREATE INDEX IF NOT EXISTS idx_office_attendance_employee_date ON office_attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_office_attendance_date ON office_attendance(date);

-- Optional: enable Realtime for dashboard live updates (run if you use Realtime)
-- ALTER PUBLICATION supabase_realtime ADD TABLE office_employees;
-- ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance;
