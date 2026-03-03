
-- Create company_email_domains table
CREATE TABLE public.company_email_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  dns_records JSONB,
  from_name TEXT,
  from_email TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_email_domains ENABLE ROW LEVEL SECURITY;

-- Users can view their own company's email domain
CREATE POLICY "Users can view own company email domain"
ON public.company_email_domains
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id()
  OR public.is_super_admin(auth.uid())
);

-- Admins can insert their own company's email domain
CREATE POLICY "Admins can insert own company email domain"
ON public.company_email_domains
FOR INSERT
TO authenticated
WITH CHECK (
  (company_id = public.get_user_company_id() AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Admins can update their own company's email domain
CREATE POLICY "Admins can update own company email domain"
ON public.company_email_domains
FOR UPDATE
TO authenticated
USING (
  (company_id = public.get_user_company_id() AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Admins can delete their own company's email domain
CREATE POLICY "Admins can delete own company email domain"
ON public.company_email_domains
FOR DELETE
TO authenticated
USING (
  (company_id = public.get_user_company_id() AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Index for lookups
CREATE INDEX idx_company_email_domains_company_id ON public.company_email_domains(company_id);
