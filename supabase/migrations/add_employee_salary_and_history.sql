-- =============================================================================
-- Employee: salary column + Employee_history table (for Manage Employee history)
-- Run this in Supabase SQL Editor or via: supabase db push
-- Does NOT modify or delete any existing data; only adds column and new table.
-- =============================================================================

-- 1) Add optional salary column to Employee (if your table is named "Employee")
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT NULL;

-- 2) Employee_history table for audit log of profile changes
--    Uses employee_id (e.g. BS0021) to link to Employee — for schemas where
--    Employee has employee_id as the main identifier (no separate id/uuid column).
CREATE TABLE IF NOT EXISTS "Employee_history" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES "Employee"(employee_id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_history_employee_id ON "Employee_history"(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_history_created_at ON "Employee_history"(created_at DESC);

-- Optional: enable RLS if you use Row Level Security
-- ALTER TABLE "Employee_history" ENABLE ROW LEVEL SECURITY;
-- Then add policies as needed for your auth.
