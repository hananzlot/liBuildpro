-- Restore the voided bill for Urban Luxury Outdoors Inc
-- Bill ID: fcb15aa3-5c7a-4964-b298-84e66ad8002c
-- Original amount: $23,000, Payments: $13,500, Balance should be: $9,500

UPDATE project_bills
SET 
  is_voided = false,
  balance = 9500,
  amount_paid = 13500,
  updated_at = now()
WHERE id = 'fcb15aa3-5c7a-4964-b298-84e66ad8002c';