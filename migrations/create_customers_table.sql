-- Таблица клиентов
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    birthday DATE,
    status VARCHAR(20) DEFAULT 'regular', -- 'regular', 'vip', 'blacklist'
    preferences TEXT, -- текстовое поле для заметок флористов
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    average_check DECIMAL(10,2) DEFAULT 0,
    last_order_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальность по email или phone (хотя бы одно должно быть заполнено)
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT unique_phone UNIQUE (phone),
    CONSTRAINT check_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_last_order ON customers(last_order_date DESC);

-- Добавляем customer_id в таблицу sales (если его ещё нет)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
