-- Backfill contact_uuid for all related tables
-- This populates missing contact_uuid values by looking up contacts by ghl_id

-- Backfill opportunities
UPDATE opportunities o
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = o.contact_id
  AND o.contact_uuid IS NULL
  AND o.contact_id IS NOT NULL;

-- Backfill appointments
UPDATE appointments a
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = a.contact_id
  AND a.contact_uuid IS NULL
  AND a.contact_id IS NOT NULL;

-- Backfill projects
UPDATE projects p
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = p.contact_id
  AND p.contact_uuid IS NULL
  AND p.contact_id IS NOT NULL;

UPDATE projects p
SET opportunity_uuid = o.id
FROM opportunities o
WHERE o.ghl_id = p.opportunity_id
  AND p.opportunity_uuid IS NULL
  AND p.opportunity_id IS NOT NULL;

-- Backfill estimates
UPDATE estimates e
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = e.contact_id
  AND e.contact_uuid IS NULL
  AND e.contact_id IS NOT NULL;

-- Backfill ghl_tasks
UPDATE ghl_tasks t
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = t.contact_id
  AND t.contact_uuid IS NULL
  AND t.contact_id IS NOT NULL;

-- Backfill contact_notes
UPDATE contact_notes n
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = n.contact_id
  AND n.contact_uuid IS NULL
  AND n.contact_id IS NOT NULL;