CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  order_number text,
  old_status text,
  new_status text,
  customer_notified boolean DEFAULT false,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_open ON public.notifications(customer_notified, created_at DESC);

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
    WHEN 'returned' THEN 'возврат'
    WHEN 'cancelled' THEN 'отменен'
    WHEN 'not_delivered' THEN 'не доставлен'
    ELSE COALESCE(NEW.delivery_status, 'обновлен')
  END;

  order_label := COALESCE(NULLIF(NEW.order_number, ''), substring(NEW.id::text from 1 for 8));
  notification_title := 'Заказ #' || order_label || ' ' || status_label;
  notification_body := COALESCE(NEW.delivery_address, 'Адрес не указан');

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

DROP TRIGGER IF EXISTS trg_notify_delivery_status_change ON public.sales;
CREATE TRIGGER trg_notify_delivery_status_change
AFTER UPDATE OF delivery_status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.notify_delivery_status_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
NOTIFY pgrst, 'reload schema';
