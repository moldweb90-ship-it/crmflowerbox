# Миграция: Модуль Клиенты

## Что добавлено

1. **Таблица `customers`** - хранение данных клиентов
2. **Автоматическое создание/обновление** клиентов при заказе
3. **Страница "Клиенты"** с таблицей, фильтрами, статистикой
4. **Карточка клиента** с историей заказов и предпочтениями

## Шаги миграции

### 1. Применить SQL миграцию

Выполните SQL из файла `migrations/create_customers_table.sql` в вашей Supabase консоли:

```sql
-- SQL Editor -> New Query -> Вставить содержимое файла -> Run
```

Это создаст:
- Таблицу `customers` с полями: name, email, phone, status, preferences, total_orders, total_spent, average_check, last_order_date
- Индексы для быстрого поиска
- Столбец `customer_id` в таблице `sales`

### 2. Настроить права доступа (RLS)

В Supabase Dashboard -> Authentication -> Policies добавьте политики для таблицы `customers`:

```sql
-- Чтение
CREATE POLICY "Enable read access for authenticated users" ON customers
FOR SELECT USING (auth.role() = 'authenticated');

-- Вставка
CREATE POLICY "Enable insert for authenticated users" ON customers
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Обновление
CREATE POLICY "Enable update for authenticated users" ON customers
FOR UPDATE USING (auth.role() = 'authenticated');
```

### 3. Добавить permission "customers"

В настройках CRM (Settings -> Permissions) добавьте permission `customers` для ролей, которым нужен доступ к клиентам.

### 4. Проверить работу

1. Создайте новый заказ с указанием email/телефона клиента
2. Перейдите в раздел "Клиенты" - должен появиться новый клиент
3. Создайте ещё один заказ с тем же email - статистика клиента должна обновиться

## Как работает автоматика

### При создании заказа:

1. **Поиск клиента** по email или телефону
2. **Если не найден** - создаётся новая запись в `customers`
3. **Если найден** - используется существующий ID
4. Заказ привязывается к клиенту через `customer_id`
5. Обновляется статистика: `total_orders`, `total_spent`, `average_check`, `last_order_date`

### Уникальность клиента:

- По **email** (если указан)
- По **телефону** (нормализованному, без пробелов)
- Если при заказе указаны оба - сначала ищет по email, потом по телефону

## Что доступно в интерфейсе

### Страница "Клиенты"

- **Таблица** с фильтрами по статусу (Обычный/VIP/Чёрный список)
- **Поиск** по имени, email, телефону
- **Статистика**: количество клиентов, VIP, общая выручка, средний чек
- **Сортировка** по LTV (сумма покупок)

### Карточка клиента

- **Контакты**: телефон (клик = звонок), email (клик = письмо)
- **Статус**: Обычный/VIP/Чёрный список (переключение одним кликом)
- **Статистика**: количество заказов, LTV, средний чек
- **Предпочтения**: текстовое поле для заметок флористов
- **История заказов**: список всех букетов клиента

## Миграция существующих заказов (опционально)

Если у вас уже есть заказы в системе, можете создать клиентов из них:

```sql
INSERT INTO customers (name, email, phone, created_at)
SELECT DISTINCT
    COALESCE(customer_name, recipient_name, 'Клиент') as name,
    customer_email as email,
    customer_phone as phone,
    MIN(order_date) as created_at
FROM sales
WHERE customer_email IS NOT NULL OR customer_phone IS NOT NULL
GROUP BY customer_email, customer_phone, COALESCE(customer_name, recipient_name, 'Клиент')
ON CONFLICT (email) DO NOTHING;

-- Привязать заказы к клиентам
UPDATE sales s
SET customer_id = c.id
FROM customers c
WHERE s.customer_email = c.email OR s.customer_phone = c.phone;

-- Пересчитать статистику клиентов
UPDATE customers c
SET
    total_orders = (SELECT COUNT(*) FROM sales WHERE customer_id = c.id),
    total_spent = (SELECT COALESCE(SUM(sale_price), 0) FROM sales WHERE customer_id = c.id),
    last_order_date = (SELECT MAX(order_date) FROM sales WHERE customer_id = c.id),
    average_check = (SELECT COALESCE(AVG(sale_price), 0) FROM sales WHERE customer_id = c.id);
```

## Troubleshooting

### Клиенты не создаются при заказе

1. Проверьте, что миграция применена: `SELECT * FROM customers LIMIT 1;`
2. Проверьте RLS политики в Supabase
3. Проверьте консоль браузера на ошибки

### Дубликаты клиентов

Если клиент указал email в одном заказе и телефон в другом - создадутся 2 записи. Решение:
1. Вручную объедините через SQL
2. Или добавьте оба контакта в одну запись

### Permission denied

Добавьте `customers` в список permissions для вашей роли (Settings -> Permissions).
