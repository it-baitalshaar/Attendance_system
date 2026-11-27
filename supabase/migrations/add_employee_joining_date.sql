-- Employee joining date.
-- Used by the Attendance Report to skip days before the employee joined, so a
-- mid-month hire does not show the earlier days as "no attendance record".

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS joining_date date DEFAULT NULL;

COMMENT ON COLUMN "Employee".joining_date IS 'Date the employee joined (YYYY-MM-DD). Attendance Report hides expected days before this date.';
