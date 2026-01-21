-- Fix estimate 2031: set Deposit percent correctly and reduce Mobilization phase
UPDATE estimate_payment_schedule
SET percent = ROUND((1000.0 / 46571.59575 * 100)::numeric, 2)
WHERE estimate_id = (SELECT id FROM estimates WHERE estimate_number = 2031)
AND phase_name = 'Deposit';

-- Reduce Mobilization phase (sort_order 2) by the deposit percent
UPDATE estimate_payment_schedule
SET percent = 30 - ROUND((1000.0 / 46571.59575 * 100)::numeric, 2),
    amount = (30 - ROUND((1000.0 / 46571.59575 * 100)::numeric, 2)) / 100 * 46571.59575
WHERE estimate_id = (SELECT id FROM estimates WHERE estimate_number = 2031)
AND phase_name = 'Mobilization & Plan Check';