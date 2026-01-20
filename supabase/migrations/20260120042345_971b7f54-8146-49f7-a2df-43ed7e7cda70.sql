-- Step 4: Backfill company_id to existing GHL-synced data
-- Maps location_id to company_id using company_integrations table

-- Update contacts
UPDATE public.contacts c
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE c.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND c.company_id IS NULL;

-- Update opportunities
UPDATE public.opportunities o
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE o.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND o.company_id IS NULL;

-- Update appointments
UPDATE public.appointments a
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE a.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND a.company_id IS NULL;

-- Update ghl_users
UPDATE public.ghl_users u
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE u.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND u.company_id IS NULL;

-- Update ghl_pipelines
UPDATE public.ghl_pipelines p
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE p.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND p.company_id IS NULL;

-- Update ghl_calendars
UPDATE public.ghl_calendars cal
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE cal.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND cal.company_id IS NULL;

-- Update ghl_tasks
UPDATE public.ghl_tasks t
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE t.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND t.company_id IS NULL;

-- Update conversations
UPDATE public.conversations conv
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE conv.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND conv.company_id IS NULL;

-- Update contact_notes
UPDATE public.contact_notes n
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE n.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND n.company_id IS NULL;

-- Update call_logs
UPDATE public.call_logs cl
SET company_id = ci.company_id
FROM public.company_integrations ci
WHERE cl.location_id = ci.location_id
  AND ci.provider = 'ghl'
  AND ci.is_active = true
  AND cl.company_id IS NULL;