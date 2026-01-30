
-- Create or replace function to update invoice balance when payments change
CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_total_payments NUMERIC;
  v_invoice_amount NUMERIC;
BEGIN
  -- Determine which invoice_id to update
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- If no invoice linked, also check old invoice_id for updates that unlink
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
    -- Update the old invoice first
    SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_payments
    FROM project_payments
    WHERE invoice_id = OLD.invoice_id
      AND payment_status = 'Received'
      AND is_voided = false;

    SELECT amount INTO v_invoice_amount
    FROM project_invoices
    WHERE id = OLD.invoice_id;

    UPDATE project_invoices
    SET payments_received = v_total_payments,
        open_balance = GREATEST(0, COALESCE(v_invoice_amount, 0) - v_total_payments),
        updated_at = now()
    WHERE id = OLD.invoice_id;
  END IF;

  -- Update the new/current invoice
  IF v_invoice_id IS NOT NULL THEN
    SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_payments
    FROM project_payments
    WHERE invoice_id = v_invoice_id
      AND payment_status = 'Received'
      AND is_voided = false;

    SELECT amount INTO v_invoice_amount
    FROM project_invoices
    WHERE id = v_invoice_id;

    UPDATE project_invoices
    SET payments_received = v_total_payments,
        open_balance = GREATEST(0, COALESCE(v_invoice_amount, 0) - v_total_payments),
        updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on project_payments
DROP TRIGGER IF EXISTS trg_update_invoice_payment_totals ON project_payments;
CREATE TRIGGER trg_update_invoice_payment_totals
AFTER INSERT OR UPDATE OR DELETE ON project_payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_payment_totals();

-- Backfill: Recalculate all invoice balances based on current payments
UPDATE project_invoices pi
SET payments_received = COALESCE(sub.total_payments, 0),
    open_balance = GREATEST(0, pi.amount - COALESCE(sub.total_payments, 0)),
    updated_at = now()
FROM (
  SELECT invoice_id, SUM(payment_amount) as total_payments
  FROM project_payments
  WHERE invoice_id IS NOT NULL
    AND payment_status = 'Received'
    AND is_voided = false
  GROUP BY invoice_id
) sub
WHERE pi.id = sub.invoice_id;
