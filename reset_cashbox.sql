-- Technical Reset of Cashbox
-- WARNING: This will DELETE ALL sales and expenses data.
-- Use this only for resetting the system after testing.

TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE expenses CASCADE;

-- If you want to reset stock levels too, uncomment the next line:
-- TRUNCATE TABLE stock CASCADE;
