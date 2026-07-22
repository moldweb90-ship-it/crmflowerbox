ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS delivery_time_mode text NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS order_notes text,
  ADD COLUMN IF NOT EXISTS customer_name text;

UPDATE public.sales
SET delivery_time_mode = 'exact'
WHERE delivery_time_mode IS NULL OR delivery_time_mode NOT IN ('exact', 'day');

COMMENT ON COLUMN public.sales.delivery_time_mode IS 'Режим планового времени: exact — точное время, day — в течение выбранного дня.';
COMMENT ON COLUMN public.sales.order_notes IS 'Внутренняя рабочая заметка к заказу для флористов, менеджеров и курьеров.';
COMMENT ON COLUMN public.sales.customer_name IS 'Необязательное имя заказчика для карточки заказа и клиентской базы.';

NOTIFY pgrst, 'reload schema';
