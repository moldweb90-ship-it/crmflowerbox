CREATE TABLE IF NOT EXISTS public.supply_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'company_account', 'owner_funds')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  reference text,
  comment text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_payments_supply
  ON public.supply_payments(supply_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_supply_payments_paid_at
  ON public.supply_payments(paid_at DESC);

COMMENT ON TABLE public.supply_payments IS 'Фактические оплаты поставщикам. Поставка создаёт запас, а платеж отдельно меняет источник денежных средств.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_payments TO anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_payments TO authenticated;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
