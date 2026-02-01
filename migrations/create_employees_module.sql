-- Модуль Сотрудники: employees + shifts + миграция florists/couriers
-- Запустите в Supabase SQL Editor

-- 1. Таблица сотрудников
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('florist', 'courier', 'manager')),
    photo_url TEXT,
    rate_per_shift DECIMAL(12,2) DEFAULT 0,
    commission_percent DECIMAL(5,2) DEFAULT 0,
    rate_per_order DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    hired_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- 2. Таблица смен
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT DEFAULT 'day' CHECK (shift_type IN ('morning', 'day', 'evening', 'full')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);

-- 3. Миграция: florists -> employees (florists может не иметь phone)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'florists') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'florists' AND column_name = 'phone') THEN
            INSERT INTO employees (id, name, phone, role, rate_per_shift, commission_percent, is_active)
            SELECT id, name, COALESCE(phone, ''), 'florist', 0, 0, true FROM florists
            ON CONFLICT (id) DO NOTHING;
        ELSE
            INSERT INTO employees (id, name, phone, role, rate_per_shift, commission_percent, is_active)
            SELECT id, name, '', 'florist', 0, 0, true FROM florists
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- 4. Миграция: couriers -> employees (couriers может не иметь phone)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'couriers') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'couriers' AND column_name = 'phone') THEN
            INSERT INTO employees (id, name, phone, role, rate_per_shift, commission_percent, is_active)
            SELECT id, name, COALESCE(phone, ''), 'courier', 0, 0, true FROM couriers
            ON CONFLICT (id) DO NOTHING;
        ELSE
            INSERT INTO employees (id, name, phone, role, rate_per_shift, commission_percent, is_active)
            SELECT id, name, '', 'courier', 0, 0, true FROM couriers
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- 5. Удаление FK с sales (если есть)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_florist_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_courier_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS fk_sales_florist;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS fk_sales_courier;

-- 6. Добавление FK на employees
ALTER TABLE sales ADD CONSTRAINT sales_florist_id_fkey 
    FOREIGN KEY (florist_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE sales ADD CONSTRAINT sales_courier_id_fkey 
    FOREIGN KEY (courier_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 7. НЕ удаляем florists/couriers — код будет использовать employees.
-- Старые таблицы можно удалить позже вручную после проверки.

COMMENT ON TABLE employees IS 'Сотрудники: флористы, курьеры, менеджеры';
COMMENT ON TABLE shifts IS 'График смен сотрудников';
COMMENT ON COLUMN employees.rate_per_shift IS 'Ставка за смену (лей) — для флористов';
COMMENT ON COLUMN employees.commission_percent IS 'Процент с продаж — для флористов';
COMMENT ON COLUMN employees.rate_per_order IS 'Сумма за заказ/доставку (лей) — для курьеров';

-- Добавить колонку rate_per_order для курьеров (если таблица уже создана)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rate_per_order DECIMAL(12,2) DEFAULT 0;
