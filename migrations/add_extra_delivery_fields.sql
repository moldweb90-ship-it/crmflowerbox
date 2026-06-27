ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS extra_delivery_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_delivery_reason text;
