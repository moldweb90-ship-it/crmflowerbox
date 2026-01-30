-- Важные даты клиентов (ДР, юбилей, свадьба) для напоминаний
CREATE TABLE IF NOT EXISTS customer_important_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    date_type VARCHAR(20) NOT NULL, -- 'birthday', 'anniversary', 'wedding', 'other'
    event_date DATE NOT NULL, -- день+месяц для ежегодных напоминаний
    notes TEXT,
    source_sale_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (customer_id, date_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_dates_customer ON customer_important_dates(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_dates_event ON customer_important_dates(event_date);

-- Перенос существующих ДР из customers.birthday (если есть)
INSERT INTO customer_important_dates (customer_id, date_type, event_date)
SELECT id, 'birthday', birthday FROM customers WHERE birthday IS NOT NULL
ON CONFLICT (customer_id, date_type) DO NOTHING;

-- RLS (если используете)
-- ALTER TABLE customer_important_dates ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated" ON customer_important_dates FOR ALL USING (auth.role() = 'authenticated');
