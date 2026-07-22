UPDATE public.sales s
SET stock_deducted = false
WHERE s.stock_deducted = true
  AND COALESCE(s.production_status, 'in_work') <> 'assembled'
  AND COALESCE(s.delivery_status, 'not_delivered') NOT IN ('delivered', 'cancelled', 'canceled', 'returned')
  AND NOT EXISTS (
    SELECT 1
    FROM public.stock_transactions st
    WHERE st.reference_id = s.id
      AND st.transaction_type = 'sale'
      AND st.quantity < 0
  );

NOTIFY pgrst, 'reload schema';
