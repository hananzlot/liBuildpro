-- Backfill sold_dispatch_value for project fcac283f from its linked opportunity
UPDATE public.projects p
SET sold_dispatch_value = o.monetary_value
FROM public.opportunities o
WHERE p.id = 'fcac283f-aff4-4e27-91e0-9bd4509063ce'
  AND o.id = p.opportunity_uuid
  AND p.sold_dispatch_value IS NULL
  AND o.monetary_value IS NOT NULL;