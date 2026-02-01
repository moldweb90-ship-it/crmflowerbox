# Хранилище фото сотрудников (Supabase Storage)

## 1. Создание bucket
- **Storage** → **New bucket**
- Имя: `employee-photos`
- Public bucket: **Включить**

## 2. RLS-политики (обязательно)
Без политик загрузка даст ошибку "new row violates row-level security policy".

Выполните SQL из файла `storage_employee_photos_policies.sql` в Supabase **SQL Editor**.
