-- Create table for salesperson scope submissions
CREATE TABLE public.scope_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.salespeople(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  contact_id TEXT,
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  job_address TEXT,
  
  -- Scope details
  project_type TEXT,
  scope_description TEXT NOT NULL,
  measurements TEXT,
  special_requirements TEXT,
  photos_urls TEXT[], -- Array of storage URLs
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'priced', 'proposal_sent', 'declined')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Office response
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  office_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scope_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users with company access to view/manage submissions
CREATE POLICY "Company users can view their submissions"
ON public.scope_submissions
FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Company users can insert submissions"
ON public.scope_submissions
FOR INSERT
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Company users can update submissions"
ON public.scope_submissions
FOR UPDATE
USING (public.has_company_access(company_id));

CREATE POLICY "Company users can delete submissions"
ON public.scope_submissions
FOR DELETE
USING (public.has_company_access(company_id));

-- Allow salesperson portal token holders to insert submissions for their company
CREATE POLICY "Salesperson portal can insert submissions"
ON public.scope_submissions
FOR INSERT
WITH CHECK (
  public.has_valid_salesperson_portal_token(company_id)
);

-- Allow salesperson portal to view their own submissions
CREATE POLICY "Salesperson portal can view own submissions"
ON public.scope_submissions
FOR SELECT
USING (
  public.has_valid_salesperson_portal_token(company_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_scope_submissions_updated_at
BEFORE UPDATE ON public.scope_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_scope_submissions_company ON public.scope_submissions(company_id);
CREATE INDEX idx_scope_submissions_salesperson ON public.scope_submissions(salesperson_id);
CREATE INDEX idx_scope_submissions_status ON public.scope_submissions(status);
CREATE INDEX idx_scope_submissions_created ON public.scope_submissions(created_at DESC);