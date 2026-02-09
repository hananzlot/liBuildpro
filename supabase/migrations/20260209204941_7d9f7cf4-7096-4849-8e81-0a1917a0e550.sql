
-- Remove duplicate payment phases for EST 2106
-- Keep the set with the correct automated structure (Materials Delivered at 15%, group-aligned phases, 10% final)
-- Delete the older/duplicate rows

DELETE FROM estimate_payment_schedule 
WHERE estimate_id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a'
AND id IN (
  -- Remove the duplicate "Phase 1" rows (keep neither - they shouldn't exist per the automated schedule)
  'b325cbab-024a-4fe2-bb69-e7d4f64b7f89',
  '062226dd-e9cb-48e8-94cf-4853ba89db6b',
  -- Remove the duplicate Materials Delivered (keep 7733073e)
  '8629b89c-fc2e-4243-8ca7-19f5563f0246',
  -- Remove duplicate Phase 2 (keep 234ad771 at 40%)
  'cd3f69a8-843a-41d0-bb6c-a1fe8520ac87',
  -- Remove duplicate Phase 3 (keep 9ecc5872 at 28%)
  'ccc7b0cb-6ac2-4b03-b165-15b9c4eb1efe',
  -- Remove duplicate Phase 4 (keep 66f1fb14 at 10%)
  'b61b48a7-7404-462b-8772-c2a488e09ca7'
);

-- Fix sort_order to be sequential
UPDATE estimate_payment_schedule SET sort_order = 0 WHERE id = '32987008-3535-4ba7-bdf6-777977f132d2'; -- Deposit
UPDATE estimate_payment_schedule SET sort_order = 1 WHERE id = '7733073e-b8d2-4855-94a5-d8b30e98d751'; -- Materials Delivered
UPDATE estimate_payment_schedule SET sort_order = 2 WHERE id = '234ad771-8570-4f1b-94b3-2009d1d58c52'; -- Phase 2
UPDATE estimate_payment_schedule SET sort_order = 3 WHERE id = '9ecc5872-745f-4e0d-a424-24a8dfe1f64f'; -- Phase 3
UPDATE estimate_payment_schedule SET sort_order = 4 WHERE id = '66f1fb14-d5f3-4ad2-8a5a-d74296675ace'; -- Phase 4
