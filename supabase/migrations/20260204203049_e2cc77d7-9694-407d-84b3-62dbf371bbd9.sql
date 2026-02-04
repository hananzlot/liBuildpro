-- Backfill lead_source in estimates via opportunity's contact
UPDATE public.estimates e
SET lead_source = c.source
FROM opportunities o
JOIN contacts c ON c.id = o.contact_uuid OR c.ghl_id = o.contact_id
WHERE e.lead_source IS NULL
  AND c.source IS NOT NULL
  AND (e.opportunity_uuid = o.id OR e.opportunity_id = o.ghl_id);

-- Backfill lead_source in projects via opportunity's contact  
UPDATE public.projects p
SET lead_source = c.source
FROM opportunities o
JOIN contacts c ON c.id = o.contact_uuid OR c.ghl_id = o.contact_id
WHERE p.lead_source IS NULL
  AND c.source IS NOT NULL
  AND (p.opportunity_uuid = o.id OR p.opportunity_id = o.ghl_id);

-- Also backfill contact_uuid in estimates and projects from opportunity
UPDATE public.estimates e
SET contact_uuid = o.contact_uuid, contact_id = o.contact_id
FROM opportunities o
WHERE e.contact_uuid IS NULL
  AND o.contact_uuid IS NOT NULL
  AND (e.opportunity_uuid = o.id OR e.opportunity_id = o.ghl_id);

UPDATE public.projects p
SET contact_uuid = o.contact_uuid, contact_id = o.contact_id
FROM opportunities o
WHERE p.contact_uuid IS NULL
  AND o.contact_uuid IS NOT NULL
  AND (p.opportunity_uuid = o.id OR p.opportunity_id = o.ghl_id);