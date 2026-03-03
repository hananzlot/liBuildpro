
-- Delete all Demo Co #1 estimates (no child records exist, but ordering for safety)
-- Step 1: Delete any estimate_line_items (0 expected)
DELETE FROM estimate_line_items 
WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc');

-- Step 2: Delete any estimate_groups (0 expected)
DELETE FROM estimate_groups 
WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc');

-- Step 3: Delete all 42 estimates for Demo Co #1
DELETE FROM estimates 
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc';
