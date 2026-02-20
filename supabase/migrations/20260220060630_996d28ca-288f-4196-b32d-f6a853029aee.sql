
-- Nullify stale GHL ID fields in Demo Co #1 (cloned from CA Pro Builders)
-- These legacy IDs point to the source company's records, causing cross-company errors

UPDATE opportunities SET contact_id = NULL 
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND contact_id IS NOT NULL;

UPDATE appointments SET contact_id = NULL 
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND contact_id IS NOT NULL;

UPDATE projects SET contact_id = NULL, opportunity_id = NULL 
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' 
AND (contact_id IS NOT NULL OR opportunity_id IS NOT NULL);

UPDATE estimates SET contact_id = NULL 
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND contact_id IS NOT NULL;

-- ghl_tasks.contact_id is NOT NULL, so remap stale IDs to a placeholder instead
-- Replace stale GHL contact IDs with 'local_orphan' to break cross-company lookups
UPDATE ghl_tasks SET contact_id = 'local_orphan_' || id::text
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' 
AND contact_id IS NOT NULL
AND contact_id NOT LIKE 'local_%';
