-- Temporarily disable the trigger so the UPDATE doesn't re-set updated_at
ALTER TABLE public.opportunities DISABLE TRIGGER set_opportunities_updated_at;

-- Reset updated_at to NULL for Demo Co #1
UPDATE public.opportunities 
SET updated_at = NULL
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc';

-- Re-enable the trigger
ALTER TABLE public.opportunities ENABLE TRIGGER set_opportunities_updated_at;