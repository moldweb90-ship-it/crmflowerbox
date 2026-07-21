CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  comment text,
  performed_by text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  reference_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, reference_stage)
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_created
  ON public.cash_movements(created_at DESC);

COMMENT ON TABLE public.cash_movements IS 'Движения физической кассы, не являющиеся продажами или операционными расходами';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;

NOTIFY pgrst, 'reload schema';
