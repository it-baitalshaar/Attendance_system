-- Saved recipients and WhatsApp number for payroll / salary / attendance reports

CREATE TABLE IF NOT EXISTS public.payroll_report_settings (
  scope text PRIMARY KEY DEFAULT 'default',
  whatsapp_number text NOT NULL DEFAULT '+971527249586',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_report_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_report_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_report_settings_select" ON public.payroll_report_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_report_settings_all" ON public.payroll_report_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "payroll_report_emails_select" ON public.payroll_report_emails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_report_emails_insert" ON public.payroll_report_emails
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payroll_report_emails_delete" ON public.payroll_report_emails
  FOR DELETE TO authenticated USING (true);

INSERT INTO public.payroll_report_settings (scope, whatsapp_number)
VALUES ('default', '+971527249586')
ON CONFLICT (scope) DO NOTHING;
