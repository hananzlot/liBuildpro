
-- Clean up duplicate payment phases for EST 2106 (again) - remove rows with null company_id
DELETE FROM estimate_payment_schedule 
WHERE estimate_id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a' 
AND company_id IS NULL;
