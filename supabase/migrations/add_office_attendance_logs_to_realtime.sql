-- =============================================================================
-- Add office_attendance_logs to supabase_realtime (every punch is stored here).
-- Run once in Supabase SQL Editor if you already had office_employees and
-- office_attendance in Realtime but not office_attendance_logs.
-- Does NOT delete or modify any data.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'office_attendance_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_attendance_logs;
  END IF;
END $$;
