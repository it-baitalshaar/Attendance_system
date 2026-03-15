-- =============================================================================
-- Add office_* tables to supabase_realtime publication so the admin dashboard
-- and attendance website can subscribe to live changes (employees, daily
-- attendance, and every punch in office_attendance_logs).
-- Run once in Supabase (SQL Editor or via Supabase CLI).
-- Does NOT delete or modify any existing data; only adds tables to the publication.
-- =============================================================================
--
-- Simple version (run once; errors if table already in publication):
--   ALTER PUBLICATION supabase_realtime ADD TABLE office_employees;
--   ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance;
--   ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance_logs;
--
-- Idempotent version below (safe to run multiple times):
--

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
