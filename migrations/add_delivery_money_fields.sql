ALTER TABLE sales
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_payout numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pickup_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_pricing_note text;

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS pickup_discount numeric DEFAULT 100;

UPDATE settings
SET pickup_discount = 100
WHERE pickup_discount IS NULL;

UPDATE sales
SET
    delivery_fee = COALESCE(delivery_fee, extra_delivery_cost, 0),
    courier_payout = COALESCE(courier_payout, extra_delivery_cost, 0),
    pickup_discount = COALESCE(pickup_discount, 0)
WHERE TRUE;
