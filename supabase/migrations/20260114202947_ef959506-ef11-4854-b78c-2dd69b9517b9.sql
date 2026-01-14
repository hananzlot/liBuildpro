-- Create a table for documents that need signatures
CREATE TABLE public.signature_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create table for document signatures
CREATE TABLE public.document_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('drawn', 'typed')),
  signature_data TEXT NOT NULL,
  signature_font TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create table for document portal tokens
CREATE TABLE public.document_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create storage bucket for signature documents
INSERT INTO storage.buckets (id, name, public) VALUES ('signature-documents', 'signature-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_portal_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signature_documents
CREATE POLICY "Admins can do everything with documents"
ON public.signature_documents FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view documents"
ON public.signature_documents FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create documents"
ON public.signature_documents FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for document_signatures
CREATE POLICY "Admins can manage document signatures"
ON public.document_signatures FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view signatures"
ON public.document_signatures FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can insert signatures via portal"
ON public.document_signatures FOR INSERT
WITH CHECK (true);

-- RLS Policies for document_portal_tokens
CREATE POLICY "Admins can manage portal tokens"
ON public.document_portal_tokens FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view tokens"
ON public.document_portal_tokens FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create tokens"
ON public.document_portal_tokens FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Public access for portal tokens (for recipients)
CREATE POLICY "Anyone can view active tokens by token value"
ON public.document_portal_tokens FOR SELECT
USING (is_active = true);

-- Storage policies for signature-documents bucket
CREATE POLICY "Authenticated users can upload signature documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'signature-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view signature documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'signature-documents');

CREATE POLICY "Admins can delete signature documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'signature-documents' AND public.is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_signature_documents_updated_at
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();