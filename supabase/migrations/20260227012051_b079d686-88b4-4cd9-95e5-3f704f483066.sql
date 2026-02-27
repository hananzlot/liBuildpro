-- Apply the $8,320 Vera Builder offset that was linked but never subtracted from the Urban Main bill
UPDATE public.project_bills
SET 
  bill_amount = bill_amount - 8320,
  balance = balance - 8320
WHERE id = '65fb4d88-e3df-441b-a672-96ed109da506';
