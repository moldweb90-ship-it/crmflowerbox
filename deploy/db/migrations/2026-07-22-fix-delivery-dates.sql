UPDATE public.sales
SET delivery_date = NULL
WHERE delivery_date IS NOT NULL
  AND delivery_date < TIMESTAMPTZ '1971-01-01 00:00:00+00';

COMMENT ON COLUMN public.sales.delivery_date IS 'Плановая дата и время доставки либо выдачи самовывоза.';
