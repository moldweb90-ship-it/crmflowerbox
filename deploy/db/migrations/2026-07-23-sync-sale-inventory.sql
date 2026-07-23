CREATE OR REPLACE FUNCTION public.sync_sale_inventory(
  p_sale_id uuid,
  p_composition jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_row public.sales%ROWTYPE;
  source_composition jsonb;
  item record;
  lot record;
  available_quantity numeric;
  delta_quantity numeric;
  remaining_quantity numeric;
  take_quantity numeric;
  deducted_quantity numeric := 0;
  restored_quantity numeric := 0;
BEGIN
  SELECT *
    INTO sale_row
    FROM public.sales
   WHERE id = p_sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale % was not found', p_sale_id;
  END IF;

  IF p_composition IS NOT NULL THEN
    IF jsonb_typeof(p_composition) <> 'array' THEN
      RAISE EXCEPTION 'Sale composition must be a JSON array';
    END IF;
    source_composition := p_composition;
  ELSIF jsonb_typeof(sale_row.custom_composition) = 'array'
    AND jsonb_array_length(sale_row.custom_composition) > 0 THEN
    source_composition := sale_row.custom_composition;
  ELSE
    SELECT COALESCE(composition, '[]'::jsonb)
      INTO source_composition
      FROM public.products
     WHERE id = sale_row.product_id;
    source_composition := COALESCE(source_composition, '[]'::jsonb);
  END IF;

  -- Lock and validate every stock row before changing anything. Any shortage
  -- raises an exception and PostgreSQL rolls the whole synchronization back.
  FOR item IN
    WITH desired AS (
      SELECT
        element->>'type' AS item_type,
        COALESCE(element->>'item_id', element->>'id')::uuid AS item_id,
        SUM(
          REPLACE(
            COALESCE(NULLIF(element->>'quantity', ''), NULLIF(element->>'qty', ''), '1'),
            ',',
            '.'
          )::numeric
        ) AS quantity
      FROM jsonb_array_elements(source_composition) AS element
      WHERE element->>'type' IN ('flower', 'good')
        AND COALESCE(element->>'item_id', element->>'id') IS NOT NULL
      GROUP BY 1, 2
    ),
    deducted AS (
      SELECT
        item_type,
        item_id,
        GREATEST(0, -SUM(quantity)) AS quantity
      FROM public.stock_transactions
      WHERE reference_id = p_sale_id
        AND transaction_type = 'sale'
      GROUP BY 1, 2
    )
    SELECT
      desired.item_type,
      desired.item_id,
      desired.quantity - COALESCE(deducted.quantity, 0) AS delta
    FROM desired
    LEFT JOIN deducted USING (item_type, item_id)
    WHERE desired.quantity > COALESCE(deducted.quantity, 0)
    ORDER BY desired.item_type, desired.item_id
  LOOP
    SELECT quantity
      INTO available_quantity
      FROM public.stock
     WHERE item_type = item.item_type
       AND item_id = item.item_id
     FOR UPDATE;

    IF NOT FOUND OR COALESCE(available_quantity, 0) < item.delta THEN
      RAISE EXCEPTION 'Not enough stock for %:% (need %, available %)',
        item.item_type,
        item.item_id,
        item.delta,
        COALESCE(available_quantity, 0);
    END IF;
  END LOOP;

  FOR item IN
    WITH desired AS (
      SELECT
        element->>'type' AS item_type,
        COALESCE(element->>'item_id', element->>'id')::uuid AS item_id,
        SUM(
          REPLACE(
            COALESCE(NULLIF(element->>'quantity', ''), NULLIF(element->>'qty', ''), '1'),
            ',',
            '.'
          )::numeric
        ) AS quantity
      FROM jsonb_array_elements(source_composition) AS element
      WHERE element->>'type' IN ('flower', 'good')
        AND COALESCE(element->>'item_id', element->>'id') IS NOT NULL
      GROUP BY 1, 2
    ),
    deducted AS (
      SELECT
        item_type,
        item_id,
        GREATEST(0, -SUM(quantity)) AS quantity
      FROM public.stock_transactions
      WHERE reference_id = p_sale_id
        AND transaction_type = 'sale'
      GROUP BY 1, 2
    )
    SELECT
      COALESCE(desired.item_type, deducted.item_type) AS item_type,
      COALESCE(desired.item_id, deducted.item_id) AS item_id,
      COALESCE(desired.quantity, 0) - COALESCE(deducted.quantity, 0) AS delta
    FROM desired
    FULL JOIN deducted USING (item_type, item_id)
    WHERE COALESCE(desired.quantity, 0) <> COALESCE(deducted.quantity, 0)
    ORDER BY 1, 2
  LOOP
    delta_quantity := item.delta;

    IF delta_quantity > 0 THEN
      UPDATE public.stock
         SET quantity = quantity - delta_quantity,
             updated_at = now()
       WHERE item_type = item.item_type
         AND item_id = item.item_id;

      remaining_quantity := delta_quantity;
      FOR lot IN
        SELECT sl.*
          FROM public.stock_lots sl
         WHERE sl.item_type = item.item_type
           AND sl.item_id = item.item_id
           AND sl.remaining_quantity > 0
         ORDER BY sl.created_at, sl.id
         FOR UPDATE
      LOOP
        EXIT WHEN remaining_quantity <= 0;
        take_quantity := LEAST(lot.remaining_quantity, remaining_quantity);

        UPDATE public.stock_lots
           SET remaining_quantity = lot.remaining_quantity - take_quantity,
               updated_at = now()
         WHERE id = lot.id;

        INSERT INTO public.stock_transactions (
          item_type,
          item_id,
          quantity,
          transaction_type,
          reference_id,
          cost_price,
          notes,
          supplier_id
        ) VALUES (
          item.item_type,
          item.item_id,
          -take_quantity,
          'sale',
          p_sale_id,
          lot.unit_cost,
          'Синхронизация состава заказа',
          lot.supplier_id
        );

        remaining_quantity := remaining_quantity - take_quantity;
      END LOOP;

      IF remaining_quantity > 0 THEN
        INSERT INTO public.stock_transactions (
          item_type,
          item_id,
          quantity,
          transaction_type,
          reference_id,
          notes
        ) VALUES (
          item.item_type,
          item.item_id,
          -remaining_quantity,
          'sale',
          p_sale_id,
          'Синхронизация состава заказа'
        );
      END IF;

      deducted_quantity := deducted_quantity + delta_quantity;
    ELSIF delta_quantity < 0 THEN
      delta_quantity := ABS(delta_quantity);

      INSERT INTO public.stock (item_type, item_id, quantity, updated_at)
      VALUES (item.item_type, item.item_id, delta_quantity, now())
      ON CONFLICT (item_type, item_id)
      DO UPDATE SET
        quantity = public.stock.quantity + EXCLUDED.quantity,
        updated_at = now();

      INSERT INTO public.stock_lots (
        item_type,
        item_id,
        supplier_id,
        supply_id,
        quantity,
        remaining_quantity,
        unit_cost
      ) VALUES (
        item.item_type,
        item.item_id,
        NULL,
        NULL,
        delta_quantity,
        delta_quantity,
        0
      );

      INSERT INTO public.stock_transactions (
        item_type,
        item_id,
        quantity,
        transaction_type,
        reference_id,
        notes
      ) VALUES (
        item.item_type,
        item.item_id,
        delta_quantity,
        'sale',
        p_sale_id,
        'Возврат после изменения состава заказа'
      );

      restored_quantity := restored_quantity + delta_quantity;
    END IF;
  END LOOP;

  UPDATE public.sales
     SET custom_composition = CASE
           WHEN p_composition IS NOT NULL THEN p_composition
           ELSE custom_composition
         END,
         stock_deducted = jsonb_array_length(source_composition) > 0
   WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'deducted', deducted_quantity,
    'restored', restored_quantity,
    'stock_deducted', jsonb_array_length(source_composition) > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_inventory(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_sale_inventory(uuid, jsonb) TO anon;

NOTIFY pgrst, 'reload schema';

-- Repair the completed order whose composition was filled after it had already
-- left the planning stage. Existing sale transactions are used as the baseline,
-- so the already deducted balloon is not deducted twice.
SELECT public.sync_sale_inventory('c0ddb63b-2ecd-443b-ab89-559826f93218'::uuid, NULL);
