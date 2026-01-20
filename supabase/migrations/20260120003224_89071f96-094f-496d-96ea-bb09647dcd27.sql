-- Phase 1: Add provider and external_id columns to synced tables
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE ghl_tasks ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE ghl_tasks ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE ghl_users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE ghl_users ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ghl';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Phase 2: Make ghl_id nullable for internally-created records
ALTER TABLE contacts ALTER COLUMN ghl_id DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN ghl_id DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN ghl_id DROP NOT NULL;
ALTER TABLE ghl_tasks ALTER COLUMN ghl_id DROP NOT NULL;
ALTER TABLE contact_notes ALTER COLUMN ghl_id DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN ghl_id DROP NOT NULL;

-- Phase 3: Add UUID-based relationship columns
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS opportunity_uuid UUID REFERENCES opportunities(id);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS opportunity_uuid UUID REFERENCES opportunities(id);
ALTER TABLE ghl_tasks ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS contact_uuid UUID REFERENCES contacts(id);

-- Phase 4: Backfill external_id from ghl_id
UPDATE contacts SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE opportunities SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE appointments SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE ghl_tasks SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE ghl_users SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE contact_notes SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;
UPDATE conversations SET external_id = ghl_id WHERE external_id IS NULL AND ghl_id IS NOT NULL;

-- Phase 5: Backfill UUID relationships
UPDATE opportunities o
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = o.contact_id
  AND o.contact_uuid IS NULL
  AND o.contact_id IS NOT NULL;

UPDATE appointments a
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = a.contact_id
  AND a.contact_uuid IS NULL
  AND a.contact_id IS NOT NULL;

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

UPDATE estimates e
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = e.contact_id
  AND e.contact_uuid IS NULL
  AND e.contact_id IS NOT NULL;

UPDATE ghl_tasks t
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = t.contact_id
  AND t.contact_uuid IS NULL
  AND t.contact_id IS NOT NULL;

UPDATE contact_notes n
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = n.contact_id
  AND n.contact_uuid IS NULL
  AND n.contact_id IS NOT NULL;

-- Phase 6: Add composite unique indexes for multi-provider support
CREATE UNIQUE INDEX IF NOT EXISTS contacts_provider_external_id_uniq 
ON contacts(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_provider_external_id_uniq 
ON opportunities(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_provider_external_id_uniq 
ON appointments(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ghl_tasks_provider_external_id_uniq 
ON ghl_tasks(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ghl_users_provider_external_id_uniq 
ON ghl_users(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contact_notes_provider_external_id_uniq 
ON contact_notes(provider, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_provider_external_id_uniq 
ON conversations(provider, external_id) WHERE external_id IS NOT NULL;

-- Phase 7: Create backfill function for ongoing sync operations
CREATE OR REPLACE FUNCTION public.backfill_contact_uuids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
END;
$$;