-- Add salary column to Employee table for managing employee compensation.
-- Run this in Supabase SQL editor if the column does not exist yet.

ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT NULL;

COMMENT ON COLUMN "Employee".salary IS 'Employee salary (numeric, e.g. 50000.00)';
