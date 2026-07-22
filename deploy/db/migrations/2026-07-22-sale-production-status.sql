ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS production_status text NOT NULL DEFAULT 'in_work',
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

UPDATE public.sales
SET stock_deducted = true
WHERE stock_deducted = false
  AND (
    product_id IS NOT NULL
    OR jsonb_array_length(COALESCE(custom_composition, '[]'::jsonb)) > 0
  );

UPDATE public.sales
SET production_status = 'assembled'
WHERE delivery_status IN ('delivered', 'delivering');

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_production_status_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_production_status_check
  CHECK (production_status IN ('planned', 'in_work', 'assembled'));

NOTIFY pgrst, 'reload schema';
