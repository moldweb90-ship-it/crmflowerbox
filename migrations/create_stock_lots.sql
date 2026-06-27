CREATE TABLE IF NOT EXISTS public.stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supply_id uuid REFERENCES public.supplies(id) ON DELETE SET NULL,
  quantity integer DEFAULT 0,
  remaining_quantity integer DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_item ON public.stock_lots(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_supplier ON public.stock_lots(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_lots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_lots TO authenticator;

UPDATE public.stock_transactions tx
SET supplier_id = s.supplier_id
FROM public.supplies s
WHERE tx.transaction_type = 'supply'
  AND tx.reference_id = s.id
  AND tx.supplier_id IS NULL;

WITH supply_rows AS (
  SELECT
    CASE WHEN si.flower_id IS NOT NULL THEN 'flower' ELSE 'good' END AS item_type,
    COALESCE(si.flower_id, si.good_id) AS item_id,
    s.supplier_id,
    s.id AS supply_id,
    si.quantity::integer AS quantity,
    si.unit_cost,
    COALESCE(s.date, s.created_at, now()) AS lot_date
  FROM public.supply_items si
  JOIN public.supplies s ON s.id = si.supply_id
  WHERE COALESCE(si.flower_id, si.good_id) IS NOT NULL
),
ranked AS (
  SELECT
    sr.*,
    COALESCE(SUM(sr.quantity) OVER (
      PARTITION BY sr.item_type, sr.item_id
      ORDER BY sr.lot_date DESC, sr.supply_id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS newer_qty
  FROM supply_rows sr
),
allocated AS (
  SELECT
    r.*,
    LEAST(r.quantity, GREATEST(st.quantity - r.newer_qty, 0))::integer AS remaining_quantity
  FROM ranked r
  JOIN public.stock st ON st.item_type = r.item_type AND st.item_id = r.item_id
  WHERE NOT EXISTS (SELECT 1 FROM public.stock_lots)
)
INSERT INTO public.stock_lots (
  item_type,
  item_id,
  supplier_id,
  supply_id,
  quantity,
  remaining_quantity,
  unit_cost,
  created_at,
  updated_at
)
SELECT
  item_type,
  item_id,
  supplier_id,
  supply_id,
  quantity,
  remaining_quantity,
  unit_cost,
  lot_date,
  now()
FROM allocated
WHERE remaining_quantity > 0;
