-- Disable BOTH update triggers
ALTER TABLE public.opportunities DISABLE TRIGGER set_opportunities_updated_at;
ALTER TABLE public.opportunities DISABLE TRIGGER update_opportunities_updated_at;

-- Reset updated_at to match the GHL date so the UI logic ignores it
UPDATE public.opportunities 
SET updated_at = COALESCE(ghl_date_updated, ghl_date_added, created_at)
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc';

-- Re-enable both triggers
ALTER TABLE public.opportunities ENABLE TRIGGER set_opportunities_updated_at;
ALTER TABLE public.opportunities ENABLE TRIGGER update_opportunities_updated_at;