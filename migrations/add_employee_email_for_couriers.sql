ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_employees_email_lower
ON public.employees (lower(email));
