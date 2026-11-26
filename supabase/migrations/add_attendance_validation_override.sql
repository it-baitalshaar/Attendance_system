-- Attendance submit completeness guard — override audit columns.
--
-- A supervisor can still submit an incomplete day ("Submit anyway"), but must
-- type a reason. That reason + the issues that were open are stored on the
-- day's Track_Attendance row so the monthly report can show why.
--
-- Run in the Supabase SQL Editor (or `supabase db push`).
-- The API tolerates these columns being absent until this migration runs.

ALTER TABLE public."Track_Attendance"
  ADD COLUMN IF NOT EXISTS validation_override_reason text,
  ADD COLUMN IF NOT EXISTS validation_issues jsonb;

COMMENT ON COLUMN public."Track_Attendance".validation_override_reason IS
  'Reason typed by the supervisor when submitting a day with incomplete hours (submit guard override).';

COMMENT ON COLUMN public."Track_Attendance".validation_issues IS
  'JSON array of attendance validation issues that were open when the override was used.';
