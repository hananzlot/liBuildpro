
-- Fix Asher Peretz's old GHL ID (4hNWwIAQbQn6fs0eSl4c) in opportunities
UPDATE opportunities 
SET assigned_to = (
  SELECT s.id::text FROM salespeople s 
  WHERE LOWER(s.name) = 'asher peretz' AND s.company_id = opportunities.company_id 
  LIMIT 1
)
WHERE assigned_to = '4hNWwIAQbQn6fs0eSl4c';

-- Fix in contacts
UPDATE contacts 
SET assigned_to = (
  SELECT s.id::text FROM salespeople s 
  WHERE LOWER(s.name) = 'asher peretz' AND s.company_id = contacts.company_id 
  LIMIT 1
)
WHERE assigned_to = '4hNWwIAQbQn6fs0eSl4c';
