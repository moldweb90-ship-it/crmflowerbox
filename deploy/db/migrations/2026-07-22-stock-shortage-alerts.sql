ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shortage_status text,
  ADD COLUMN IF NOT EXISTS shortage_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_shortage_status_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_shortage_status_check
      CHECK (shortage_status IS NULL OR shortage_status IN ('unresolved', 'ordered'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_shortage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  alert_kind text NOT NULL DEFAULT 'new',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_shortage_alerts TO anon;
NOTIFY pgrst, 'reload schema';
