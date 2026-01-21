-- Update all existing estimates to have deposit_max_amount = 1000
-- and recalculate deposit_amount as min(total * percent, 1000)
UPDATE estimates
SET 
  deposit_max_amount = 1000,
  deposit_amount = LEAST(
    COALESCE(total, 0) * COALESCE(deposit_percent, 10) / 100,
    1000
  )
WHERE deposit_max_amount IS NULL OR deposit_max_amount != 1000;