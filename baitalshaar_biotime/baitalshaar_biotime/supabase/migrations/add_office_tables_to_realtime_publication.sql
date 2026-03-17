-- Add office tables to supabase_realtime publication so the attendance website
-- (and admin dashboard) can subscribe to live changes.
--
-- • office_employees — employee list changes
-- • office_attendance — daily summary (one row per employee per day)
-- • office_attendance_logs — every transaction (each punch); subscribe here for
--   real-time view of each check-in/check-out as it is synced.
--
-- Run once in Supabase (SQL Editor or via Supabase CLI).
-- If a table is already in the publication, that line will error; skip or run
-- ALTER PUBLICATION supabase_realtime DROP TABLE <table>; first if needed.

ALTER PUBLICATION supabase_realtime ADD TABLE office_employees;
ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance_logs;
