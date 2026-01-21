-- Fix all Deposit phases: amount is capped at deposit_max_amount (default $1000)
-- and percent is recalculated based on the capped amount
UPDATE estimate_payment_schedule ps
SET 
  amount = LEAST(
    (SELECT e.total * COALESCE(e.deposit_percent, 10) / 100 FROM estimates e WHERE e.id = ps.estimate_id),
    (SELECT COALESCE(e.deposit_max_amount, 1000) FROM estimates e WHERE e.id = ps.estimate_id)
  ),
  percent = ROUND(
    (LEAST(
      (SELECT e.total * COALESCE(e.deposit_percent, 10) / 100 FROM estimates e WHERE e.id = ps.estimate_id),
      (SELECT COALESCE(e.deposit_max_amount, 1000) FROM estimates e WHERE e.id = ps.estimate_id)
    ) / NULLIF((SELECT e.total FROM estimates e WHERE e.id = ps.estimate_id), 0) * 100)::numeric, 
    2
  )
WHERE ps.phase_name = 'Deposit';

-- Also update the second phase (sort_order = 1 or 2) to be reduced by the deposit percent
-- First, get the original intended percent and subtract the deposit percent
UPDATE estimate_payment_schedule ps
SET 
  percent = GREATEST(0, ps.percent),
  amount = (SELECT e.total FROM estimates e WHERE e.id = ps.estimate_id) * GREATEST(0, ps.percent) / 100
WHERE ps.sort_order IN (1, 2) 
AND ps.phase_name != 'Deposit';

-- Update all estimates deposit_amount to be capped
UPDATE estimates
SET deposit_amount = LEAST(
  total * COALESCE(deposit_percent, 10) / 100, 
  COALESCE(deposit_max_amount, 1000)
)
WHERE total > 0;