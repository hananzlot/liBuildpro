-- Add created_by_source field to track where estimates originated
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS created_by_source text DEFAULT 'office';

-- Add salesperson_id to link back to who created it (for portal access)
ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id);

COMMENT ON COLUMN public.estimates.created_by_source IS 'Source of estimate creation: office, salesperson_portal, customer_portal';
COMMENT ON COLUMN public.estimates.salesperson_id IS 'Salesperson who created the estimate (if from salesperson portal)';