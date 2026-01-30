-- Create lead_sources table for company-defined sources
CREATE TABLE public.lead_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view lead sources for their company"
ON public.lead_sources
FOR SELECT
USING (has_company_access(company_id));

CREATE POLICY "Admins can insert lead sources"
ON public.lead_sources
FOR INSERT
WITH CHECK (has_company_access(company_id));

CREATE POLICY "Admins can update lead sources"
ON public.lead_sources
FOR UPDATE
USING (has_company_access(company_id));

CREATE POLICY "Admins can delete lead sources"
ON public.lead_sources
FOR DELETE
USING (has_company_access(company_id));

-- Create index for faster lookups
CREATE INDEX idx_lead_sources_company ON public.lead_sources(company_id);
CREATE INDEX idx_lead_sources_active ON public.lead_sources(company_id, is_active);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lead_sources_updated_at
BEFORE UPDATE ON public.lead_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();