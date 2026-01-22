-- Backfill missing company_id for the affected CA Pro Builders project/token so portal branding resolves correctly

UPDATE public.projects
SET company_id = '00000000-0000-0000-0000-000000000002'
WHERE id = '70733bf4-61e2-49db-8ef3-c90d6eb1cbda'
  AND company_id IS NULL;

UPDATE public.client_portal_tokens
SET company_id = '00000000-0000-0000-0000-000000000002'
WHERE id = '44a9aa18-504b-4b2d-bba3-e24d61bac12c'
  AND company_id IS NULL;
