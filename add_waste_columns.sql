-- Add reason and created_by columns to stock_transactions for Waste Analytics
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Optional: Add index for faster filtering/grouping
CREATE INDEX IF NOT EXISTS idx_stock_transactions_reason ON stock_transactions(reason);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_by ON stock_transactions(created_by);
