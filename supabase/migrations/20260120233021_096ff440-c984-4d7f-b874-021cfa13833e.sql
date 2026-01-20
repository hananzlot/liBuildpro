-- Fix the 4 orphaned notifications by assigning to CA Pro Builders
UPDATE notifications
SET company_id = '00000000-0000-0000-0000-000000000002'
WHERE company_id IS NULL