-- =============================================================================
-- Office employees: add personal_email only (for work-hours reports).
-- BioTime sync uses "email"; this column is never touched by sync.
-- Safe to run multiple times. Does NOT alter or drop any existing columns.
-- =============================================================================

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS personal_email text DEFAULT NULL;

COMMENT ON COLUMN public.office_employees.personal_email IS 'Personal email for receiving work hours report; not synced from BioTime. Reports are sent to this if set, else to email.';
