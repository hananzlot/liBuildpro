-- Fix estimate 2031 deposit amount (min of 30% or $1000)
-- For $46,571.60 total: 30% = $13,971.48, but max is $1000, so deposit = $1000
UPDATE estimates 
SET deposit_amount = LEAST(total * deposit_percent / 100, COALESCE(deposit_max_amount, 1000))
WHERE estimate_number = 2031;

-- Also update the Deposit payment phase to have the correct amount
UPDATE estimate_payment_schedule 
SET amount = (
  SELECT LEAST(e.total * e.deposit_percent / 100, COALESCE(e.deposit_max_amount, 1000))
  FROM estimates e 
  WHERE e.id = estimate_payment_schedule.estimate_id
)
WHERE phase_name = 'Deposit' 
AND estimate_id = (SELECT id FROM estimates WHERE estimate_number = 2031);