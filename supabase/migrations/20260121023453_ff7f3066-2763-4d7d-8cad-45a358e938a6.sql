-- Fix all Deposit phases to have exact $1000 amount and correct percent
UPDATE estimate_payment_schedule ps
SET 
  amount = LEAST((SELECT e.total FROM estimates e WHERE e.id = ps.estimate_id) * ps.percent / 100, 
                 (SELECT COALESCE(e.deposit_max_amount, 1000) FROM estimates e WHERE e.id = ps.estimate_id)),
  percent = ROUND(
    (LEAST(
      (SELECT e.total FROM estimates e WHERE e.id = ps.estimate_id) * (SELECT COALESCE(e.deposit_percent, 10) FROM estimates e WHERE e.id = ps.estimate_id) / 100,
      (SELECT COALESCE(e.deposit_max_amount, 1000) FROM estimates e WHERE e.id = ps.estimate_id)
    ) / NULLIF((SELECT e.total FROM estimates e WHERE e.id = ps.estimate_id), 0) * 100)::numeric, 
    4  -- Use 4 decimal places for more precision
  )
WHERE ps.phase_name = 'Deposit';