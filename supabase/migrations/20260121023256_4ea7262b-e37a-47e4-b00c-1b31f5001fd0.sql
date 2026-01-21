-- First, shift all existing payment phases sort_order up by 1 to make room for Deposit at position 0
UPDATE estimate_payment_schedule
SET sort_order = sort_order + 1
WHERE phase_name != 'Deposit';

-- Insert Deposit phase for estimates that don't have one
INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order, company_id)
SELECT 
  e.id as estimate_id,
  'Deposit' as phase_name,
  -- Calculate what percent of total the deposit represents
  ROUND((LEAST(e.total * COALESCE(e.deposit_percent, 10) / 100, COALESCE(e.deposit_max_amount, 1000)) / NULLIF(e.total, 0) * 100)::numeric, 2) as percent,
  LEAST(e.total * COALESCE(e.deposit_percent, 10) / 100, COALESCE(e.deposit_max_amount, 1000)) as amount,
  'on_approval' as due_type,
  'Due upon contract signing' as description,
  0 as sort_order,
  e.company_id
FROM estimates e
WHERE NOT EXISTS (
  SELECT 1 FROM estimate_payment_schedule ps 
  WHERE ps.estimate_id = e.id AND ps.phase_name = 'Deposit'
)
AND e.total > 0;

-- Now reduce the first non-Deposit phase (sort_order = 1) by the deposit percentage
UPDATE estimate_payment_schedule ps
SET percent = GREATEST(0, ps.percent - (
  SELECT ROUND((LEAST(e.total * COALESCE(e.deposit_percent, 10) / 100, COALESCE(e.deposit_max_amount, 1000)) / NULLIF(e.total, 0) * 100)::numeric, 2)
  FROM estimates e 
  WHERE e.id = ps.estimate_id
)),
amount = GREATEST(0, ps.amount - (
  SELECT LEAST(e.total * COALESCE(e.deposit_percent, 10) / 100, COALESCE(e.deposit_max_amount, 1000))
  FROM estimates e 
  WHERE e.id = ps.estimate_id
))
WHERE ps.sort_order = 1
AND ps.phase_name != 'Deposit';

-- Update deposit_amount on all estimates to use the correct min(percent, max) calculation
UPDATE estimates
SET deposit_amount = LEAST(total * COALESCE(deposit_percent, 10) / 100, COALESCE(deposit_max_amount, 1000))
WHERE total > 0;