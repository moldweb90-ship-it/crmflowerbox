-- Add columns for custom/salon sales to the sales table
-- Run this in Supabase SQL Editor

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS custom_composition JSONB;

-- Add comment for documentation
COMMENT ON COLUMN sales.is_custom IS 'True if this is a custom bouquet made in salon (not from catalog)';
COMMENT ON COLUMN sales.custom_name IS 'Custom bouquet name given by florist';
COMMENT ON COLUMN sales.custom_composition IS 'JSON array of items in the custom bouquet';
