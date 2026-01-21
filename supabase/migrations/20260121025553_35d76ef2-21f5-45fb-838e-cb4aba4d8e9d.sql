-- Fix estimate 2031: Rescale non-deposit phases to add up to 100% of remaining balance
-- Current non-deposit sum: 27.85 + 30 + 30 + 10 = 97.85%
-- Need to scale by: 100 / 97.85 = 1.02197...

WITH estimate_data AS (
  SELECT 
    e.id as estimate_id,
    e.total,
    LEAST(e.total * COALESCE(e.deposit_percent, 10) / 100, COALESCE(e.deposit_max_amount, 1000)) as deposit_amount
  FROM estimates e
  WHERE e.estimate_number = 2031
),
non_deposit_sum AS (
  SELECT 
    ps.estimate_id,
    SUM(ps.percent) as total_percent
  FROM estimate_payment_schedule ps
  WHERE ps.phase_name != 'Deposit'
  AND ps.estimate_id = (SELECT id FROM estimates WHERE estimate_number = 2031)
  GROUP BY ps.estimate_id
)
UPDATE estimate_payment_schedule ps
SET 
  percent = CASE 
    WHEN ps.phase_name = 'Deposit' THEN 0
    ELSE ROUND((ps.percent * 100.0 / NULLIF(nds.total_percent, 0))::numeric, 2)
  END,
  amount = CASE 
    WHEN ps.phase_name = 'Deposit' THEN ed.deposit_amount
    ELSE ROUND(((ed.total - ed.deposit_amount) * (ps.percent * 100.0 / NULLIF(nds.total_percent, 0)) / 100)::numeric, 2)
  END
FROM estimate_data ed, non_deposit_sum nds
WHERE ps.estimate_id = ed.estimate_id
AND ps.estimate_id = nds.estimate_id;