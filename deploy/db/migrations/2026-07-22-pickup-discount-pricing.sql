ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS price_before_discount numeric(12,2),
  ADD COLUMN IF NOT EXISTS pickup_discount_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sales.price_before_discount IS 'Цена заказа до скидки за самовывоз.';
COMMENT ON COLUMN public.sales.pickup_discount_applied IS 'Признак того, что pickup_discount уже вычтен из sale_price.';

NOTIFY pgrst, 'reload schema';
