-- Store department on each attendance row (submission department at time of entry).
-- Reports filter by this column when set; otherwise Employee_history is used for past months.

ALTER TABLE public."Attendance"
  ADD COLUMN IF NOT EXISTS department text;

COMMENT ON COLUMN public."Attendance".department IS
  'Department roster when attendance was submitted (Construction / Maintenance / SAQIYA). Used for historical payroll reports after employee transfers.';

CREATE INDEX IF NOT EXISTS idx_attendance_department_date
  ON public."Attendance" (department, date)
  WHERE department IS NOT NULL;
