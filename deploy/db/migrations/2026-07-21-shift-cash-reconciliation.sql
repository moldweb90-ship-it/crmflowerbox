ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash_expected DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash_difference DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash_note TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_expected DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_difference DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_note TEXT;

COMMENT ON COLUMN shifts.opening_cash IS 'Фактически пересчитанная касса при открытии смены';
COMMENT ON COLUMN shifts.opening_cash_expected IS 'Ожидаемая касса при открытии смены';
COMMENT ON COLUMN shifts.opening_cash_difference IS 'Фактическая касса минус ожидаемая при открытии';
COMMENT ON COLUMN shifts.closing_cash IS 'Фактически пересчитанная касса при закрытии смены';
COMMENT ON COLUMN shifts.closing_cash_expected IS 'Ожидаемая касса при закрытии смены';
COMMENT ON COLUMN shifts.closing_cash_difference IS 'Фактическая касса минус ожидаемая при закрытии';
