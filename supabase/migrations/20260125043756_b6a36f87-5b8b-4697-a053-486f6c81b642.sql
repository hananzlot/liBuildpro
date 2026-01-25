-- Add proposal_link column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS proposal_link TEXT;

COMMENT ON COLUMN public.opportunities.proposal_link IS 'URL link to the signed proposal in the client portal';