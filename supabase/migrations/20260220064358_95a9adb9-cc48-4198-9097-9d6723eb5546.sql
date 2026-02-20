ALTER TABLE public.opportunities DISABLE TRIGGER set_opportunities_updated_at;

UPDATE public.opportunities 
SET updated_at = COALESCE(ghl_date_updated, ghl_date_added, created_at)
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc';

ALTER TABLE public.opportunities ENABLE TRIGGER set_opportunities_updated_at;