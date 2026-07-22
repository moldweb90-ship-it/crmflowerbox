ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS calculated_sale_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_adjustment_reason text,
  ADD COLUMN IF NOT EXISTS price_adjusted_by text,
  ADD COLUMN IF NOT EXISTS price_adjusted_at timestamptz;

COMMENT ON COLUMN public.sales.calculated_sale_price IS 'Расчётная цена заказа до ручной корректировки итоговой цены.';
COMMENT ON COLUMN public.sales.price_adjustment_reason IS 'Обязательная причина последней ручной корректировки цены.';
COMMENT ON COLUMN public.sales.price_adjusted_by IS 'Сотрудник, выполнивший последнюю ручную корректировку цены.';
COMMENT ON COLUMN public.sales.price_adjusted_at IS 'Время последней ручной корректировки цены.';

UPDATE public.sales
SET calculated_sale_price = sale_price
WHERE calculated_sale_price IS NULL;

NOTIFY pgrst, 'reload schema';
