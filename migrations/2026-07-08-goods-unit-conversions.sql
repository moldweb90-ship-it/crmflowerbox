-- Unit conversion for additional goods.
-- Goods can be bought as packs/rolls/boxes, but consumed from stock as sheets/meters/bricks.

ALTER TABLE goods
    ADD COLUMN IF NOT EXISTS purchase_unit text DEFAULT 'шт',
    ADD COLUMN IF NOT EXISTS stock_unit text DEFAULT 'шт',
    ADD COLUMN IF NOT EXISTS units_per_purchase numeric DEFAULT 1;

UPDATE goods
SET purchase_unit = COALESCE(NULLIF(purchase_unit, ''), 'шт'),
    stock_unit = COALESCE(NULLIF(stock_unit, ''), 'шт'),
    units_per_purchase = CASE
        WHEN units_per_purchase IS NULL OR units_per_purchase <= 0 THEN 1
        ELSE units_per_purchase
    END;

ALTER TABLE supply_items
    ADD COLUMN IF NOT EXISTS purchase_quantity numeric,
    ADD COLUMN IF NOT EXISTS purchase_unit_cost numeric,
    ADD COLUMN IF NOT EXISTS purchase_unit text,
    ADD COLUMN IF NOT EXISTS stock_unit text,
    ADD COLUMN IF NOT EXISTS units_per_purchase numeric DEFAULT 1;

UPDATE supply_items
SET purchase_quantity = COALESCE(purchase_quantity, quantity),
    purchase_unit_cost = COALESCE(purchase_unit_cost, unit_cost),
    purchase_unit = COALESCE(NULLIF(purchase_unit, ''), 'шт'),
    stock_unit = COALESCE(NULLIF(stock_unit, ''), 'шт'),
    units_per_purchase = CASE
        WHEN units_per_purchase IS NULL OR units_per_purchase <= 0 THEN 1
        ELSE units_per_purchase
    END;

COMMENT ON COLUMN goods.purchase_unit IS 'Unit used when buying the good, e.g. roll, pack, box.';
COMMENT ON COLUMN goods.stock_unit IS 'Unit used in stock and bouquet consumption, e.g. m, sheet, brick.';
COMMENT ON COLUMN goods.units_per_purchase IS 'How many stock units are inside one purchase unit.';
COMMENT ON COLUMN supply_items.purchase_quantity IS 'Original purchase quantity entered by florist.';
COMMENT ON COLUMN supply_items.purchase_unit_cost IS 'Cost per purchase unit entered by florist.';
