-- Add allow_future_attendance to departments so each department can optionally
-- allow supervisors/managers to mark attendance for future dates (up to a limit).
-- Run this in the Supabase SQL editor if the column does not exist yet.

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS allow_future_attendance boolean DEFAULT false;

COMMENT ON COLUMN departments.allow_future_attendance IS 'When true, this department allows attendance to be submitted for future dates (up to the app-configured limit, e.g. 10 days ahead).';

