-- =============================================================================
-- Office employee overrides: app-edited fields stored here so BioTime sync
-- can update office_employees without overwriting department, personal_email, etc.
-- The app reads from office_employees and merges in overrides (override wins).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.office_employee_overrides (
  employee_id uuid PRIMARY KEY REFERENCES public.office_employees(id) ON DELETE CASCADE,
  department text,
  personal_email text,
  phone text,
  salary numeric,
  min_working_hours numeric,
  max_working_hours numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.office_employee_overrides IS 'App-only edits (department, personal_email, etc.). BioTime sync does not touch this table.';

CREATE INDEX IF NOT EXISTS idx_office_employee_overrides_employee_id ON public.office_employee_overrides(employee_id);

-- Backfill: copy current app-editable values from office_employees so existing data is preserved (once)
INSERT INTO public.office_employee_overrides (employee_id, department, personal_email, phone, salary, min_working_hours, max_working_hours)
SELECT id, department, personal_email, phone, salary, min_working_hours, max_working_hours
FROM public.office_employees
ON CONFLICT (employee_id) DO NOTHING;

-- RLS
ALTER TABLE public.office_employee_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_employee_overrides_select_admin" ON public.office_employee_overrides;
CREATE POLICY "office_employee_overrides_select_admin"
  ON public.office_employee_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "office_employee_overrides_insert_admin" ON public.office_employee_overrides;
CREATE POLICY "office_employee_overrides_insert_admin"
  ON public.office_employee_overrides FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "office_employee_overrides_update_admin" ON public.office_employee_overrides;
CREATE POLICY "office_employee_overrides_update_admin"
  ON public.office_employee_overrides FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "office_employee_overrides_delete_admin" ON public.office_employee_overrides;
CREATE POLICY "office_employee_overrides_delete_admin"
  ON public.office_employee_overrides FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Realtime (so admin UI updates when overrides change)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'office_employee_overrides') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_employee_overrides;
  END IF;
END $$;
