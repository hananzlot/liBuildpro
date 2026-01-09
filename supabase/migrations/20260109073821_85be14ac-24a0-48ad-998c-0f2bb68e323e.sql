-- Add agreement_id column to project_bills table
ALTER TABLE public.project_bills 
ADD COLUMN agreement_id UUID REFERENCES public.project_agreements(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_project_bills_agreement_id ON public.project_bills(agreement_id);