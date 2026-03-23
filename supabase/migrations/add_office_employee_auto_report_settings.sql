-- =============================================================================
-- Per-employee auto report schedule settings
-- =============================================================================

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS auto_daily_report_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS auto_daily_report_time text NOT NULL DEFAULT '10:00';

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS auto_month_end_report_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS auto_month_end_report_time text NOT NULL DEFAULT '18:00';

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS last_daily_report_sent_on date;

ALTER TABLE public.office_employees
ADD COLUMN IF NOT EXISTS last_month_end_report_sent_month text;

COMMENT ON COLUMN public.office_employees.auto_daily_report_enabled IS 'If true, employee gets automatic daily report email';
COMMENT ON COLUMN public.office_employees.auto_daily_report_time IS 'Daily auto report time in HH:MM (UAE time)';
COMMENT ON COLUMN public.office_employees.auto_month_end_report_enabled IS 'If true, employee gets automatic month-end report email';
COMMENT ON COLUMN public.office_employees.auto_month_end_report_time IS 'Month-end auto report time in HH:MM (UAE time)';
COMMENT ON COLUMN public.office_employees.last_daily_report_sent_on IS 'Date marker to prevent duplicate daily auto emails';
COMMENT ON COLUMN public.office_employees.last_month_end_report_sent_month IS 'Month marker (YYYY-MM) to prevent duplicate month-end auto emails';
