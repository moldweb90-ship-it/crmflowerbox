-- Выплаты сотрудникам: ЗП, авансы, премии
-- Выполните в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS employee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('salary', 'bonus', 'advance')),
    period_date DATE NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_employee_payments_employee ON employee_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payments_period ON employee_payments(period_date);
CREATE INDEX IF NOT EXISTS idx_employee_payments_type ON employee_payments(payment_type);

COMMENT ON TABLE employee_payments IS 'Выплаты: salary=ЗП, bonus=премия, advance=аванс';
COMMENT ON COLUMN employee_payments.period_date IS 'Первый день месяца периода (например 2025-01-01)';
