-- =============================================================================
-- Office Daily Report: daily email at 10 AM with check-in + monthly total hours
-- Departments: Office Baitalshaar, Alsaqia Showroom
-- =============================================================================

-- Settings per department (enabled, report_time)
CREATE TABLE IF NOT EXISTS public.office_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  report_time text NOT NULL DEFAULT '10:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recipient emails per department
CREATE TABLE IF NOT EXISTS public.office_report_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, email)
);

CREATE INDEX IF NOT EXISTS idx_office_report_emails_department ON public.office_report_emails(department);

-- RLS
ALTER TABLE public.office_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_report_emails ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (admin UI); edge function uses service role
CREATE POLICY "office_report_settings_select" ON public.office_report_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "office_report_settings_all" ON public.office_report_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "office_report_emails_select" ON public.office_report_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "office_report_emails_insert" ON public.office_report_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "office_report_emails_delete" ON public.office_report_emails FOR DELETE TO authenticated USING (true);

-- Seed the two office departments with default 10:00
INSERT INTO public.office_report_settings (department, enabled, report_time)
VALUES
  ('Office Baitalshaar', true, '10:00'),
  ('Alsaqia Showroom', true, '10:00')
ON CONFLICT (department) DO NOTHING;
