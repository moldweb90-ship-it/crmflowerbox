-- Add is_hidden column to expenses for 'Soft Delete'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
