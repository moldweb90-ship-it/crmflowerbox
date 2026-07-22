ALTER TABLE public.stock
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric,
  ALTER COLUMN min_quantity TYPE numeric USING min_quantity::numeric;

ALTER TABLE public.stock_transactions
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public.stock_lots
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric,
  ALTER COLUMN remaining_quantity TYPE numeric USING remaining_quantity::numeric;

CREATE OR REPLACE FUNCTION public.receive_supply_inventory(p_supply_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supply_supplier_id uuid;
  item record;
  received_count integer := 0;
BEGIN
  SELECT supplier_id
    INTO supply_supplier_id
    FROM public.supplies
   WHERE id = p_supply_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply % was not found', p_supply_id;
  END IF;

  FOR item IN
    SELECT
      CASE WHEN flower_id IS NOT NULL THEN 'flower' ELSE 'good' END AS item_type,
      COALESCE(flower_id, good_id) AS item_id,
      SUM(quantity)::numeric AS quantity,
      CASE
        WHEN SUM(quantity) > 0 THEN SUM(quantity * unit_cost) / SUM(quantity)
        ELSE 0
      END::numeric AS unit_cost
    FROM public.supply_items
    WHERE supply_id = p_supply_id
      AND COALESCE(flower_id, good_id) IS NOT NULL
      AND quantity > 0
    GROUP BY 1, 2
  LOOP
    -- A transaction is the idempotency marker for an already received line.
    IF EXISTS (
      SELECT 1
        FROM public.stock_transactions
       WHERE reference_id = p_supply_id
         AND transaction_type = 'supply'
         AND item_type = item.item_type
         AND item_id = item.item_id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.stock (item_type, item_id, quantity, updated_at)
    VALUES (item.item_type, item.item_id, item.quantity, now())
    ON CONFLICT (item_type, item_id)
    DO UPDATE SET
      quantity = public.stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    INSERT INTO public.stock_lots (
      item_type, item_id, supplier_id, supply_id,
      quantity, remaining_quantity, unit_cost
    ) VALUES (
      item.item_type, item.item_id, supply_supplier_id, p_supply_id,
      item.quantity, item.quantity, item.unit_cost
    );

    INSERT INTO public.stock_transactions (
      item_type, item_id, quantity, transaction_type,
      reference_id, cost_price, supplier_id
    ) VALUES (
      item.item_type, item.item_id, item.quantity, 'supply',
      p_supply_id, item.unit_cost, supply_supplier_id
    );

    received_count := received_count + 1;
  END LOOP;

  RETURN received_count;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_supply_inventory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_supply_inventory(uuid) TO anon;

NOTIFY pgrst, 'reload schema';

-- Repair the partially received PROFLORIST supply. Lines already recorded as
-- received are skipped by the function, so the three successful rows are not doubled.
SELECT public.receive_supply_inventory('45e465d4-9a10-4b64-98a3-b0688ad5a1a8'::uuid);
