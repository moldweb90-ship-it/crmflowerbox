ALTER TABLE sales
ADD COLUMN IF NOT EXISTS courier_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS courier_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS courier_payment_id uuid,
ADD COLUMN IF NOT EXISTS courier_paid_amount numeric DEFAULT 0;

UPDATE sales
SET courier_paid = false
WHERE courier_paid IS NULL;
