-- Non-destructive: adds columns only. Does not delete or modify existing rows' working_hours / overtime_hours.
-- Idempotent: ADD COLUMN IF NOT EXISTS; UPDATE only sets overtime_rate where it is still NULL.
-- Table name matches production: public."Attendance_projects"

ALTER TABLE public."Attendance_projects"
  ADD COLUMN IF NOT EXISTS overtime_type text NOT NULL DEFAULT 'normal';

ALTER TABLE public."Attendance_projects"
  ADD COLUMN IF NOT EXISTS overtime_rate numeric(10, 4);

COMMENT ON COLUMN public."Attendance_projects".overtime_type IS 'normal | holiday | public_holiday';
COMMENT ON COLUMN public."Attendance_projects".overtime_rate IS 'Multiplier at save time (e.g. 1.25, 1.5, 2.5)';

-- Backfill rate from overtime_type for rows that have no rate yet (never overwrites a non-NULL rate).
UPDATE public."Attendance_projects"
SET overtime_rate = (
  CASE trim(lower(COALESCE(overtime_type, 'normal')))
    WHEN 'public_holiday' THEN 2.5::numeric(10, 4)
    WHEN 'holiday' THEN 1.5::numeric(10, 4)
    WHEN 'normal' THEN 1.25::numeric(10, 4)
    ELSE 1.25::numeric(10, 4)
  END
)
WHERE overtime_rate IS NULL;
