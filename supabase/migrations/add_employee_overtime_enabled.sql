-- Per-employee overtime eligibility (Construction / Maintenance attendance UI + submit).

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS overtime_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "Employee".overtime_enabled IS 'When false, overtime hours are not collected for this employee (Construction/Maintenance flows).';
