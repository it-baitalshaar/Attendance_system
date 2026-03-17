-- =============================================================================
-- Use BioTime department names so synced employees match report settings.
-- BioTime uses "Bait Alshaar" and "Al Saqia", not "Office Baitalshaar" / "Alsaqia Showroom".
-- =============================================================================

-- Rename existing report settings and emails to match BioTime
UPDATE public.office_report_settings SET department = 'Bait Alshaar' WHERE department = 'Office Baitalshaar';
UPDATE public.office_report_settings SET department = 'Al Saqia' WHERE department = 'Alsaqia Showroom';

UPDATE public.office_report_emails SET department = 'Bait Alshaar' WHERE department = 'Office Baitalshaar';
UPDATE public.office_report_emails SET department = 'Al Saqia' WHERE department = 'Alsaqia Showroom';

-- Ensure both departments exist in settings (for fresh DBs or if inserts were skipped)
INSERT INTO public.office_report_settings (department, enabled, report_time)
VALUES
  ('Bait Alshaar', true, '10:00'),
  ('Al Saqia', true, '10:00')
ON CONFLICT (department) DO NOTHING;
