#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${PGRST_DB_PASSWORD}';
  ELSE
    ALTER ROLE authenticator PASSWORD '${PGRST_DB_PASSWORD}';
  END IF;
END
\$\$;

GRANT anon TO authenticator;

CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  markup_percentage numeric DEFAULT 100,
  delivery_cost numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.flowers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  markup_factor numeric,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric DEFAULT 0,
  category text,
  cost numeric DEFAULT 0,
  markup_factor numeric,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  price numeric DEFAULT 0,
  composition jsonb DEFAULT '[]'::jsonb,
  description text,
  category_ids jsonb DEFAULT '[]'::jsonb,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  rating numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  birthday date,
  status text DEFAULT 'regular',
  preferences text,
  total_orders integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  average_check numeric DEFAULT 0,
  last_order_date text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  role text DEFAULT 'florist',
  photo_url text,
  rate_per_shift numeric DEFAULT 0,
  commission_percent numeric DEFAULT 0,
  rate_per_order numeric DEFAULT 0,
  employee_level text DEFAULT 'standard',
  is_active boolean DEFAULT true,
  hired_at date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.florists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  date timestamptz DEFAULT now(),
  total_amount numeric DEFAULT 0,
  flowers_amount numeric DEFAULT 0,
  goods_amount numeric DEFAULT 0,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid REFERENCES public.supplies(id) ON DELETE CASCADE,
  flower_id uuid REFERENCES public.flowers(id) ON DELETE SET NULL,
  good_id uuid REFERENCES public.goods(id) ON DELETE SET NULL,
  quantity numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  quantity integer DEFAULT 0,
  min_quantity integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sale_price numeric DEFAULT 0,
  cost_price numeric DEFAULT 0,
  profit numeric DEFAULT 0,
  order_date timestamptz DEFAULT now(),
  delivery_date timestamptz,
  delivery_address text,
  customer_phone text,
  recipient_phone text,
  customer_email text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  card_text text,
  courier_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  florist_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  payment_method text,
  payment_status text,
  delivery_status text,
  sales_channel text,
  occasion text,
  items jsonb DEFAULT '[]'::jsonb,
  is_pickup boolean DEFAULT false,
  delivery_method text,
  is_custom boolean DEFAULT false,
  custom_name text,
  custom_composition jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  quantity integer DEFAULT 0,
  transaction_type text NOT NULL,
  reference_id uuid,
  cost_price numeric DEFAULT 0,
  notes text,
  reason text,
  created_by uuid,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.showcase_bouquets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  composition jsonb DEFAULT '[]'::jsonb,
  cost_price numeric DEFAULT 0,
  sale_price numeric DEFAULT 0,
  status text DEFAULT 'active',
  notes text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  sold_at timestamptz,
  written_off_at timestamptz,
  waste_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric DEFAULT 0,
  date date DEFAULT current_date,
  comment text,
  payment_method text,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  shift_type text DEFAULT 'day',
  notes text,
  start_time timestamptz,
  end_time timestamptz,
  opening_cash numeric DEFAULT 0,
  closing_cash numeric DEFAULT 0,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, shift_date)
);

CREATE TABLE IF NOT EXISTS public.employee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  payment_type text,
  period_date date,
  paid_at timestamptz DEFAULT now(),
  note text
);

CREATE TABLE IF NOT EXISTS public.customer_important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  date_type text,
  event_date date,
  notes text,
  source_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY,
  email text,
  permissions jsonb DEFAULT '[]'::jsonb,
  role text DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role text DEFAULT 'user',
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_order_date ON public.sales(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_date ON public.sales(delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_item ON public.stock(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON public.stock_transactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created ON public.stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_showcase_bouquets_status ON public.showcase_bouquets(status);
CREATE INDEX IF NOT EXISTS idx_showcase_bouquets_created ON public.showcase_bouquets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_supplies_supplier ON public.supplies(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supply_items_supply ON public.supply_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON public.shifts(employee_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(lower(email));
CREATE INDEX IF NOT EXISTS idx_app_users_active ON public.app_users(is_active);

INSERT INTO public.settings (id, markup_percentage, delivery_cost)
VALUES (1, 100, 0)
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;

NOTIFY pgrst, 'reload schema';
SQL
