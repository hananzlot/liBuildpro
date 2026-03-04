-- Remove the duplicate backfill opportunity and project from CA Pro Builders
-- The real records live in Demo Co #1

-- First delete the project (it references the opportunity)
DELETE FROM projects WHERE id = 'f4eb5cd3-1328-4168-b3f3-77fe73e2eadc';

-- Then delete the backfill opportunity
DELETE FROM opportunities WHERE id = '76ef00ae-b8cd-4c9d-ad3b-e025d773b699';