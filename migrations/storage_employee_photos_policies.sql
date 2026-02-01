-- RLS-политики для bucket employee-photos
-- Выполните в Supabase SQL Editor целиком

DROP POLICY IF EXISTS "employee_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_photos_update" ON storage.objects;

-- Загрузка — для anon и authenticated
CREATE POLICY "employee_photos_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'employee-photos');

-- Чтение
CREATE POLICY "employee_photos_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-photos');

-- Обновление (для upsert)
CREATE POLICY "employee_photos_update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'employee-photos');
