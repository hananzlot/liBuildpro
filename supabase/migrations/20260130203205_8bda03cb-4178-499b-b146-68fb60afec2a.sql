-- Create table to store ignored duplicate pairs
CREATE TABLE public.ignored_duplicate_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id_1 UUID NOT NULL,
  opportunity_id_2 UUID NOT NULL,
  ignored_by UUID REFERENCES auth.users(id),
  ignored_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE(company_id, opportunity_id_1, opportunity_id_2)
);

-- Enable RLS
ALTER TABLE public.ignored_duplicate_opportunities ENABLE ROW LEVEL SECURITY;

-- Create policies using existing has_company_access function
CREATE POLICY "Users can view ignored duplicates for their company"
ON public.ignored_duplicate_opportunities
FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert ignored duplicates for their company"
ON public.ignored_duplicate_opportunities
FOR INSERT
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can delete ignored duplicates for their company"
ON public.ignored_duplicate_opportunities
FOR DELETE
USING (public.has_company_access(company_id));

-- Index for faster lookups
CREATE INDEX idx_ignored_duplicates_company ON public.ignored_duplicate_opportunities(company_id);
CREATE INDEX idx_ignored_duplicates_opp1 ON public.ignored_duplicate_opportunities(opportunity_id_1);
CREATE INDEX idx_ignored_duplicates_opp2 ON public.ignored_duplicate_opportunities(opportunity_id_2);