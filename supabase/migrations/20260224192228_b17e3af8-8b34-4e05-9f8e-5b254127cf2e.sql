-- Migrate opportunities.assigned_to from GHL user IDs to salesperson UUIDs (company-scoped)
UPDATE public.opportunities o
SET assigned_to = s.id::text
FROM public.salespeople s
WHERE s.ghl_user_id = o.assigned_to
  AND s.company_id = o.company_id;

-- Migrate appointments.assigned_user_id from GHL user IDs to salesperson UUIDs (company-scoped)
UPDATE public.appointments a
SET assigned_user_id = s.id::text
FROM public.salespeople s
WHERE s.ghl_user_id = a.assigned_user_id
  AND s.company_id = a.company_id;

-- Migrate contacts.assigned_to from GHL user IDs to salesperson UUIDs (company-scoped)
UPDATE public.contacts c
SET assigned_to = s.id::text
FROM public.salespeople s
WHERE s.ghl_user_id = c.assigned_to
  AND s.company_id = c.company_id;