-- Remove the constraint that prevents negative amounts (refunds)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_check;
