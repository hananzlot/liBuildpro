-- Create salesperson_portal_tokens table for unique calendar portal links
CREATE TABLE public.salesperson_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_id UUID NOT NULL REFERENCES public.salespeople(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex') UNIQUE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for token lookups
CREATE INDEX idx_salesperson_portal_tokens_token ON public.salesperson_portal_tokens(token);
CREATE INDEX idx_salesperson_portal_tokens_salesperson ON public.salesperson_portal_tokens(salesperson_id);

-- Enable RLS
ALTER TABLE public.salesperson_portal_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Admins can manage tokens in their company
CREATE POLICY "Admins can manage salesperson portal tokens"
ON public.salesperson_portal_tokens FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Users can view tokens in their company
CREATE POLICY "Users can view salesperson portal tokens"
ON public.salesperson_portal_tokens FOR SELECT
USING (public.has_company_access(company_id));

-- Public can lookup active tokens (for portal access)
CREATE POLICY "Public can lookup active tokens"
ON public.salesperson_portal_tokens FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Public can update access tracking on valid tokens
CREATE POLICY "Public can update access tracking"
ON public.salesperson_portal_tokens FOR UPDATE
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Add trigger for updated_at
CREATE TRIGGER update_salesperson_portal_tokens_updated_at
  BEFORE UPDATE ON public.salesperson_portal_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add ghl_user_id column to salespeople table to link with appointments
ALTER TABLE public.salespeople ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;