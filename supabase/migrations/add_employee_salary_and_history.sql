-- Add optional salary column to Employee table (if your table is named "Employee")
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT NULL;

-- Employee history table for audit log of changes.
-- employee_id here stores the Employee row's primary key (uuid), NOT the business employee_id (e.g. BS0051).
-- If your Employee table uses "uuid" as the PK column name instead of "id", use: REFERENCES "Employee"(uuid)
CREATE TABLE IF NOT EXISTS "Employee_history" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES "Employee"(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_history_employee_id ON "Employee_history"(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_history_created_at ON "Employee_history"(created_at DESC);

-- Optional: enable RLS and policies if you use Row Level Security
-- ALTER TABLE "Employee_history" ENABLE ROW LEVEL SECURITY;
-- (Add policies as needed for your auth setup.)
