-- Disable update triggers temporarily
ALTER TABLE public.opportunities DISABLE TRIGGER set_opportunities_updated_at;
ALTER TABLE public.opportunities DISABLE TRIGGER update_opportunities_updated_at;

-- Backfill updated_at from ghl_date_updated
UPDATE public.opportunities SET updated_at = ghl_date_updated WHERE ghl_date_updated IS NOT NULL;

-- Re-enable triggers
ALTER TABLE public.opportunities ENABLE TRIGGER set_opportunities_updated_at;
ALTER TABLE public.opportunities ENABLE TRIGGER update_opportunities_updated_at;