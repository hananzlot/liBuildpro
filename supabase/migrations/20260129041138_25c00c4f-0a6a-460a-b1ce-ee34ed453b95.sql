-- Add is_main_contract flag to compliance_document_templates
ALTER TABLE public.compliance_document_templates
ADD COLUMN IF NOT EXISTS is_main_contract boolean NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.compliance_document_templates.is_main_contract IS 'When true, this template is the main contract that can only be signed after all required compliance documents are signed';

-- Create signed_compliance_documents table to track individual document signatures in the workflow
CREATE TABLE IF NOT EXISTS public.signed_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.compliance_document_templates(id) ON DELETE SET NULL,
  document_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'compliance', -- 'compliance' or 'main_contract'
  file_url text NOT NULL,
  signed_file_url text, -- URL to the signed/stamped PDF
  signer_name text,
  signer_email text,
  signature_data text, -- Base64 signature image
  signature_type text, -- 'draw' or 'type'
  signature_font text,
  ip_address text,
  user_agent text,
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'signed'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signed_compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for signed_compliance_documents
CREATE POLICY "Users can view signed docs in their company"
ON public.signed_compliance_documents FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert signed docs in their company"
ON public.signed_compliance_documents FOR INSERT
TO authenticated
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update signed docs in their company"
ON public.signed_compliance_documents FOR UPDATE
TO authenticated
USING (public.has_company_access(company_id));

-- Allow portal visitors to view their signed documents
CREATE POLICY "Portal visitors can view their signed docs"
ON public.signed_compliance_documents FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.estimate_id = signed_compliance_documents.estimate_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Allow portal visitors to insert signatures
CREATE POLICY "Portal visitors can sign documents"
ON public.signed_compliance_documents FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.estimate_id = estimate_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Allow portal visitors to update their signatures
CREATE POLICY "Portal visitors can update their signed docs"
ON public.signed_compliance_documents FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.estimate_id = signed_compliance_documents.estimate_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_signed_compliance_docs_estimate ON public.signed_compliance_documents(estimate_id);
CREATE INDEX IF NOT EXISTS idx_signed_compliance_docs_project ON public.signed_compliance_documents(project_id);

-- Add trigger for updated_at
CREATE TRIGGER update_signed_compliance_documents_updated_at
BEFORE UPDATE ON public.signed_compliance_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();