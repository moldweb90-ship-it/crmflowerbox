-- Уровень сотрудника и подтверждение photo_url
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_level TEXT DEFAULT 'standard' CHECK (employee_level IN ('standard', 'top', 'star', 'lead'));

COMMENT ON COLUMN employees.employee_level IS 'standard | top | star | lead';
