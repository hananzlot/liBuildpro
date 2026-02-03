-- Recalculate bill balance for the Urban Luxury Outdoors bill
-- Total payments: $9,500 + $5,000 + $2,500 + $6,000 = $23,000
-- Bill amount: $23,000
-- New balance: $0

UPDATE project_bills 
SET 
  amount_paid = 23000,
  balance = 0,
  updated_at = now()
WHERE id = 'fcb15aa3-5c7a-4964-b298-84e66ad8002c';