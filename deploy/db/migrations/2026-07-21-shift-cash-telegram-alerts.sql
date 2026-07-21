CREATE OR REPLACE FUNCTION public.notify_shift_cash_discrepancy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_name text;
  payload jsonb;
  opening_changed boolean := false;
  closing_changed boolean := false;
BEGIN
  SELECT COALESCE(name, 'Сотрудник')
    INTO employee_name
    FROM public.employees
   WHERE id = NEW.employee_id;
  employee_name := COALESCE(employee_name, 'Сотрудник');

  IF TG_OP = 'INSERT' THEN
    opening_changed := NEW.start_time IS NOT NULL;
    closing_changed := NEW.end_time IS NOT NULL;
  ELSE
    opening_changed := OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.opening_cash_difference IS DISTINCT FROM NEW.opening_cash_difference;
    closing_changed := OLD.end_time IS DISTINCT FROM NEW.end_time
      OR OLD.closing_cash_difference IS DISTINCT FROM NEW.closing_cash_difference;
  END IF;

  IF NEW.start_time IS NOT NULL
     AND opening_changed THEN
    IF ABS(COALESCE(NEW.opening_cash_difference, 0)) < 0.01 THEN
      DELETE FROM public.cash_movements
       WHERE shift_id = NEW.id AND reference_stage = 'opening';
    ELSE
      INSERT INTO public.cash_movements (
        movement_type, amount, comment, performed_by, employee_id, shift_id, reference_stage, created_at
      ) VALUES (
        CASE WHEN NEW.opening_cash_difference < 0 THEN 'cash_shortage' ELSE 'cash_overage' END,
        ABS(NEW.opening_cash_difference),
        NEW.opening_cash_note,
        employee_name,
        NEW.employee_id,
        NEW.id,
        'opening',
        NEW.start_time
      )
      ON CONFLICT (shift_id, reference_stage) DO UPDATE SET
        movement_type = EXCLUDED.movement_type,
        amount = EXCLUDED.amount,
        comment = EXCLUDED.comment,
        performed_by = EXCLUDED.performed_by,
        created_at = EXCLUDED.created_at;
    END IF;

    IF ABS(COALESCE(NEW.opening_cash_difference, 0)) >= 0.01 THEN
    payload := jsonb_build_object(
      'type', 'shift_cash_discrepancy',
      'stage', 'opening',
      'shift_id', NEW.id,
      'employee_id', NEW.employee_id,
      'employee_name', employee_name,
      'expected_cash', COALESCE(NEW.opening_cash_expected, 0),
      'actual_cash', COALESCE(NEW.opening_cash, 0),
      'difference', COALESCE(NEW.opening_cash_difference, 0),
      'note', NEW.opening_cash_note,
      'occurred_at', NEW.start_time
    );
    PERFORM pg_notify('crm_events', payload::text);
    END IF;
  END IF;

  IF NEW.end_time IS NOT NULL
     AND closing_changed THEN
    IF ABS(COALESCE(NEW.closing_cash_difference, 0)) < 0.01 THEN
      DELETE FROM public.cash_movements
       WHERE shift_id = NEW.id AND reference_stage = 'closing';
    ELSE
      INSERT INTO public.cash_movements (
        movement_type, amount, comment, performed_by, employee_id, shift_id, reference_stage, created_at
      ) VALUES (
        CASE WHEN NEW.closing_cash_difference < 0 THEN 'cash_shortage' ELSE 'cash_overage' END,
        ABS(NEW.closing_cash_difference),
        NEW.closing_cash_note,
        employee_name,
        NEW.employee_id,
        NEW.id,
        'closing',
        NEW.end_time
      )
      ON CONFLICT (shift_id, reference_stage) DO UPDATE SET
        movement_type = EXCLUDED.movement_type,
        amount = EXCLUDED.amount,
        comment = EXCLUDED.comment,
        performed_by = EXCLUDED.performed_by,
        created_at = EXCLUDED.created_at;
    END IF;

    IF ABS(COALESCE(NEW.closing_cash_difference, 0)) >= 0.01 THEN
    payload := jsonb_build_object(
      'type', 'shift_cash_discrepancy',
      'stage', 'closing',
      'shift_id', NEW.id,
      'employee_id', NEW.employee_id,
      'employee_name', employee_name,
      'expected_cash', COALESCE(NEW.closing_cash_expected, 0),
      'actual_cash', COALESCE(NEW.closing_cash, 0),
      'difference', COALESCE(NEW.closing_cash_difference, 0),
      'note', NEW.closing_cash_note,
      'occurred_at', NEW.end_time
    );
    PERFORM pg_notify('crm_events', payload::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shifts_cash_discrepancy_notify ON public.shifts;
CREATE TRIGGER shifts_cash_discrepancy_notify
AFTER INSERT OR UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.notify_shift_cash_discrepancy();
