CREATE OR REPLACE FUNCTION public.notify_delivery_status_change()
RETURNS trigger AS $$
DECLARE
  notification_id uuid;
  status_label text;
  order_label text;
  notification_title text;
  notification_body text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status THEN
    RETURN NEW;
  END IF;

  status_label := CASE NEW.delivery_status
    WHEN 'delivered' THEN 'доставлен'
    WHEN 'delivering' THEN 'в пути'
    WHEN 'postponed' THEN 'перенесен'
    WHEN 'returned' THEN 'возвращен'
    WHEN 'cancelled' THEN 'отменен'
    WHEN 'not_delivered' THEN 'не доставлен'
    ELSE COALESCE(NEW.delivery_status, 'обновлен')
  END;

  order_label := COALESCE(NULLIF(NEW.order_number, ''), substring(NEW.id::text from 1 for 8));
  notification_title := 'Заказ #' || order_label || ' ' || status_label;
  notification_body := COALESCE(NEW.delivery_address, 'Адрес не указан');

  IF NEW.delivery_status = 'delivering' THEN
    PERFORM pg_notify('crm_events', json_build_object(
      'type', 'delivery_status_changed',
      'silent', true,
      'sale_id', NEW.id,
      'order_number', NEW.order_number,
      'old_status', OLD.delivery_status,
      'new_status', NEW.delivery_status,
      'title', notification_title,
      'body', notification_body,
      'created_at', now()
    )::text);

    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    event_type,
    title,
    body,
    sale_id,
    order_number,
    old_status,
    new_status
  )
  VALUES (
    'delivery_status_changed',
    notification_title,
    notification_body,
    NEW.id,
    NEW.order_number,
    OLD.delivery_status,
    NEW.delivery_status
  )
  RETURNING id INTO notification_id;

  PERFORM pg_notify('crm_events', json_build_object(
    'type', 'delivery_status_changed',
    'notification_id', notification_id,
    'sale_id', NEW.id,
    'order_number', NEW.order_number,
    'old_status', OLD.delivery_status,
    'new_status', NEW.delivery_status,
    'title', notification_title,
    'body', notification_body,
    'created_at', now()
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
