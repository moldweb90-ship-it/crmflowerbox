CREATE OR REPLACE FUNCTION public.refresh_sale_actual_cost(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_row public.sales%ROWTYPE;
  actual_items_cost numeric := 0;
  actual_total_cost numeric := 0;
  refreshed_composition jsonb;
BEGIN
  SELECT *
    INTO sale_row
    FROM public.sales
   WHERE id = p_sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale % was not found', p_sale_id;
  END IF;

  -- Stock transactions are the source of truth for COGS: they contain the
  -- actual FIFO lot cost used when the bouquet was physically deducted.
  SELECT COALESCE(SUM(
    (-transaction.quantity) * COALESCE(
      transaction.cost_price,
      CASE
        WHEN transaction.item_type = 'flower' THEN flower.cost
        WHEN transaction.item_type = 'good' THEN good.cost
        ELSE 0
      END,
      0
    )
  ), 0)
    INTO actual_items_cost
    FROM public.stock_transactions AS transaction
    LEFT JOIN public.flowers AS flower
      ON transaction.item_type = 'flower'
     AND flower.id = transaction.item_id
    LEFT JOIN public.goods AS good
      ON transaction.item_type = 'good'
     AND good.id = transaction.item_id
   WHERE transaction.reference_id = p_sale_id
     AND transaction.transaction_type = 'sale';

  actual_items_cost := GREATEST(actual_items_cost, 0);
  actual_total_cost := actual_items_cost + COALESCE(sale_row.courier_payout, 0);

  IF jsonb_typeof(sale_row.custom_composition) = 'array'
    AND jsonb_array_length(sale_row.custom_composition) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      element || jsonb_build_object(
        'cost',
        COALESCE(
          (
            SELECT SUM(
              (-transaction.quantity) * COALESCE(
                transaction.cost_price,
                CASE
                  WHEN transaction.item_type = 'flower' THEN flower.cost
                  WHEN transaction.item_type = 'good' THEN good.cost
                  ELSE 0
                END,
                0
              )
            ) / NULLIF(-SUM(transaction.quantity), 0)
              FROM public.stock_transactions AS transaction
              LEFT JOIN public.flowers AS flower
                ON transaction.item_type = 'flower'
               AND flower.id = transaction.item_id
              LEFT JOIN public.goods AS good
                ON transaction.item_type = 'good'
               AND good.id = transaction.item_id
             WHERE transaction.reference_id = p_sale_id
               AND transaction.transaction_type = 'sale'
               AND transaction.item_type = element->>'type'
               AND transaction.item_id = COALESCE(element->>'item_id', element->>'id')::uuid
          ),
          CASE
            WHEN element->>'type' = 'flower' THEN (
              SELECT cost
                FROM public.flowers
               WHERE id = COALESCE(element->>'item_id', element->>'id')::uuid
            )
            WHEN element->>'type' = 'good' THEN (
              SELECT cost
                FROM public.goods
               WHERE id = COALESCE(element->>'item_id', element->>'id')::uuid
            )
          END,
          NULLIF(element->>'cost', '')::numeric,
          0
        )
      )
      ORDER BY ordinal
    ), '[]'::jsonb)
      INTO refreshed_composition
      FROM jsonb_array_elements(sale_row.custom_composition)
        WITH ORDINALITY AS composition(element, ordinal);
  ELSE
    refreshed_composition := sale_row.custom_composition;
  END IF;

  UPDATE public.sales
     SET custom_composition = refreshed_composition,
         cost_price = ROUND(actual_total_cost, 2),
         profit = ROUND(COALESCE(sale_price, 0) - actual_total_cost, 2)
   WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'items_cost', ROUND(actual_items_cost, 2),
    'courier_payout', COALESCE(sale_row.courier_payout, 0),
    'cost_price', ROUND(actual_total_cost, 2),
    'profit', ROUND(COALESCE(sale_row.sale_price, 0) - actual_total_cost, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_sale_actual_cost_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_sale_id uuid;
  affected_transaction_type text;
BEGIN
  affected_sale_id := COALESCE(NEW.reference_id, OLD.reference_id);
  affected_transaction_type := COALESCE(NEW.transaction_type, OLD.transaction_type);

  IF affected_sale_id IS NOT NULL AND affected_transaction_type = 'sale' THEN
    PERFORM public.refresh_sale_actual_cost(affected_sale_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS stock_transactions_refresh_sale_actual_cost
  ON public.stock_transactions;

CREATE TRIGGER stock_transactions_refresh_sale_actual_cost
AFTER INSERT OR UPDATE OR DELETE ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.refresh_sale_actual_cost_from_transaction();

REVOKE ALL ON FUNCTION public.refresh_sale_actual_cost(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_sale_actual_cost(uuid) TO anon;

-- Repair the affected completed order from its already recorded stock lots.
SELECT public.refresh_sale_actual_cost(
  '7e57e83d-0617-4138-bdc8-6d3d3c0101e9'::uuid
);

NOTIFY pgrst, 'reload schema';
