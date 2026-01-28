-- Table for compliance document templates that companies upload
CREATE TABLE public.compliance_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  
  -- The PDF template file
  template_file_url TEXT NOT NULL,
  template_file_name TEXT NOT NULL,
  
  -- Signing configuration
  requires_separate_signature BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.compliance_document_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view templates in their company"
  ON public.compliance_document_templates
  FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage templates in their company"
  ON public.compliance_document_templates
  FOR ALL
  USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Table for tracking which compliance docs were sent with each estimate/proposal
CREATE TABLE public.estimate_compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.compliance_document_templates(id) ON DELETE CASCADE,
  
  -- The generated/filled PDF for this specific estimate
  generated_file_url TEXT,
  
  -- If requires separate signature, link to signature document
  signature_document_id UUID REFERENCES public.signature_documents(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, generated, sent, signed
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(estimate_id, template_id)
);

-- Enable RLS
ALTER TABLE public.estimate_compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view compliance docs in their company"
  ON public.estimate_compliance_documents
  FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage compliance docs in their company"
  ON public.estimate_compliance_documents
  FOR ALL
  USING (public.has_company_access(company_id));

-- Update triggers
CREATE TRIGGER update_compliance_document_templates_updated_at
  BEFORE UPDATE ON public.compliance_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_estimate_compliance_documents_updated_at
  BEFORE UPDATE ON public.estimate_compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_compliance_templates_company ON public.compliance_document_templates(company_id);
CREATE INDEX idx_compliance_templates_active ON public.compliance_document_templates(company_id, is_active);
CREATE INDEX idx_estimate_compliance_docs_estimate ON public.estimate_compliance_documents(estimate_id);
CREATE INDEX idx_estimate_compliance_docs_template ON public.estimate_compliance_documents(template_id);

-- Storage bucket for compliance templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-templates', 'compliance-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for compliance templates bucket
CREATE POLICY "Authenticated users can upload compliance templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'compliance-templates');

CREATE POLICY "Users can view compliance templates in their company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'compliance-templates');

CREATE POLICY "Admins can delete compliance templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'compliance-templates');