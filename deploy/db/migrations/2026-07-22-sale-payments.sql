CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_type text NOT NULL CHECK (payment_type IN ('advance', 'balance', 'refund')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'terminal', 'paynet', 'card_transfer', 'card_ru')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  comment text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale
  ON public.sale_payments(sale_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_payments_paid_at
  ON public.sale_payments(paid_at DESC);

COMMENT ON TABLE public.sale_payments IS 'Фактические частичные оплаты и возвраты по продажам.';

CREATE OR REPLACE FUNCTION public.validate_sale_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sale_total numeric(12,2);
  paid_before numeric(12,2);
BEGIN
  SELECT COALESCE(sale_price, 0)
  INTO sale_total
  FROM public.sales
  WHERE id = NEW.sale_id
  FOR UPDATE;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END), 0)
    INTO paid_before
    FROM public.sale_payments
    WHERE sale_id = NEW.sale_id AND id <> OLD.id;
  ELSE
    SELECT COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END), 0)
    INTO paid_before
    FROM public.sale_payments
    WHERE sale_id = NEW.sale_id;
  END IF;

  IF NEW.payment_type = 'refund' AND NEW.amount > GREATEST(paid_before, 0) + 0.009 THEN
    RAISE EXCEPTION 'Refund exceeds paid amount';
  END IF;

  IF NEW.payment_type <> 'refund' AND paid_before + NEW.amount > sale_total + 0.009 THEN
    RAISE EXCEPTION 'Payment exceeds remaining order amount';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sale_payment_amount ON public.sale_payments;
CREATE TRIGGER trg_validate_sale_payment_amount
BEFORE INSERT OR UPDATE ON public.sale_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_sale_payment_amount();

INSERT INTO public.sale_payments (sale_id, amount, payment_type, payment_method, paid_at, comment, performed_by)
SELECT
  sale.id,
  sale.sale_price,
  'balance',
  CASE
    WHEN sale.payment_method IN ('cash', 'terminal', 'paynet', 'card_transfer', 'card_ru') THEN sale.payment_method
    ELSE 'card_transfer'
  END,
  COALESCE(sale.order_date, sale.created_at, now()),
  'Перенесено из прежнего статуса оплаты',
  'Система'
FROM public.sales sale
WHERE sale.payment_status = 'paid'
  AND COALESCE(sale.sale_price, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.sale_payments payment WHERE payment.sale_id = sale.id
  );

CREATE OR REPLACE FUNCTION public.sync_sale_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_sale_id uuid;
  sale_total numeric(12,2);
  paid_total numeric(12,2);
  latest_method text;
  next_status text;
BEGIN
  target_sale_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;

  SELECT COALESCE(sale_price, 0)
  INTO sale_total
  FROM public.sales
  WHERE id = target_sale_id;

  SELECT
    COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END), 0),
    (ARRAY_AGG(payment_method ORDER BY paid_at DESC, created_at DESC))[1]
  INTO paid_total, latest_method
  FROM public.sale_payments
  WHERE sale_id = target_sale_id;

  next_status := CASE
    WHEN paid_total <= 0.009 THEN 'unpaid'
    WHEN paid_total + 0.009 < sale_total THEN 'partial'
    WHEN paid_total > sale_total + 0.009 THEN 'overpaid'
    ELSE 'paid'
  END;

  UPDATE public.sales
  SET payment_status = next_status,
      payment_method = COALESCE(latest_method, payment_method)
  WHERE id = target_sale_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_payment_status ON public.sale_payments;
CREATE TRIGGER trg_sync_sale_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_status();

CREATE OR REPLACE FUNCTION public.sync_sale_status_after_price_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  paid_total numeric(12,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END), 0)
  INTO paid_total
  FROM public.sale_payments
  WHERE sale_id = NEW.id;

  NEW.payment_status := CASE
    WHEN paid_total <= 0.009 THEN 'unpaid'
    WHEN paid_total + 0.009 < COALESCE(NEW.sale_price, 0) THEN 'partial'
    WHEN paid_total > COALESCE(NEW.sale_price, 0) + 0.009 THEN 'overpaid'
    ELSE 'paid'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_status_after_price_change ON public.sales;
CREATE TRIGGER trg_sync_sale_status_after_price_change
BEFORE UPDATE OF sale_price ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_status_after_price_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
