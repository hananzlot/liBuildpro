-- Add lead_source column to estimates table
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.estimates.lead_source IS 'Lead source inherited from contact when estimate is created from opportunity';