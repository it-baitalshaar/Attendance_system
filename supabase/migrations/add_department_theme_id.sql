-- Add theme_id to departments so each department can have a theme (e.g. Default, Al Saqiya).
-- Run this in Supabase SQL editor if the column does not exist yet.

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'default';

COMMENT ON COLUMN departments.theme_id IS 'Theme id for department branding: default, saqiya, etc.';
