-- Backfill lead_source in estimates from linked contacts
UPDATE public.estimates e
SET lead_source = c.source
FROM contacts c
WHERE e.lead_source IS NULL
  AND c.source IS NOT NULL
  AND (e.contact_uuid = c.id OR e.contact_id = c.ghl_id);

-- Backfill lead_source in projects from linked contacts
UPDATE public.projects p
SET lead_source = c.source
FROM contacts c
WHERE p.lead_source IS NULL
  AND c.source IS NOT NULL
  AND (p.contact_uuid = c.id OR p.contact_id = c.ghl_id);