-- First, fix the existing data inconsistency for bill 70f08628-aa35-4cf4-8e5b-059f7827aab0
UPDATE project_bills
SET amount_paid = 7000, balance = 21000, updated_at = now()
WHERE id = '70f08628-aa35-4cf4-8e5b-059f7827aab0';

-- Also fix any other bills that might have this issue (recalculate from actual payments)
WITH bill_totals AS (
  SELECT 
    bp.bill_id,
    COALESCE(SUM(bp.payment_amount), 0) as total_paid
  FROM bill_payments bp
  GROUP BY bp.bill_id
)
UPDATE project_bills pb
SET 
  amount_paid = bt.total_paid,
  balance = GREATEST(0, COALESCE(pb.bill_amount, 0) - bt.total_paid),
  updated_at = now()
FROM bill_totals bt
WHERE pb.id = bt.bill_id
  AND (pb.amount_paid != bt.total_paid OR pb.balance != GREATEST(0, COALESCE(pb.bill_amount, 0) - bt.total_paid));

-- Create a trigger to automatically update bill totals when payments change
CREATE OR REPLACE FUNCTION public.update_bill_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bill_id UUID;
  v_total_payments NUMERIC;
  v_bill_amount NUMERIC;
BEGIN
  -- Determine which bill_id to update
  IF TG_OP = 'DELETE' THEN
    v_bill_id := OLD.bill_id;
  ELSE
    v_bill_id := NEW.bill_id;
  END IF;

  -- If no bill linked, also check old bill_id for updates that unlink
  IF TG_OP = 'UPDATE' AND OLD.bill_id IS DISTINCT FROM NEW.bill_id AND OLD.bill_id IS NOT NULL THEN
    -- Update the old bill first
    SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_payments
    FROM bill_payments
    WHERE bill_id = OLD.bill_id;

    SELECT bill_amount INTO v_bill_amount
    FROM project_bills
    WHERE id = OLD.bill_id;

    UPDATE project_bills
    SET amount_paid = v_total_payments,
        balance = GREATEST(0, COALESCE(v_bill_amount, 0) - v_total_payments),
        updated_at = now()
    WHERE id = OLD.bill_id;
  END IF;

  -- Update the new/current bill
  IF v_bill_id IS NOT NULL THEN
    SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_payments
    FROM bill_payments
    WHERE bill_id = v_bill_id;

    SELECT bill_amount INTO v_bill_amount
    FROM project_bills
    WHERE id = v_bill_id;

    UPDATE project_bills
    SET amount_paid = v_total_payments,
        balance = GREATEST(0, COALESCE(v_bill_amount, 0) - v_total_payments),
        updated_at = now()
    WHERE id = v_bill_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_bill_totals_on_payment_change ON bill_payments;

-- Create the trigger
CREATE TRIGGER update_bill_totals_on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON bill_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_bill_payment_totals();