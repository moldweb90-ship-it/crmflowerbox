-- Расширение shifts: время начала/конца, касса, статус
-- Запустите в Supabase SQL Editor

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash DECIMAL(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed'));

COMMENT ON COLUMN shifts.start_time IS 'Время начала смены (Начать смену)';
COMMENT ON COLUMN shifts.end_time IS 'Время окончания смены (Закончить смену)';
COMMENT ON COLUMN shifts.opening_cash IS 'Остаток в кассе на начало смены';
COMMENT ON COLUMN shifts.closing_cash IS 'Остаток в кассе на конец смены';
COMMENT ON COLUMN shifts.status IS 'planned - галочка в табеле, active - смена идёт, completed - смена закончена';
