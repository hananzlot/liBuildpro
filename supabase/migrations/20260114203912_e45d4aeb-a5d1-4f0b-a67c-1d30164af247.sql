-- Create table for document signers (multiple recipients per document)
CREATE TABLE public.document_signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  signature_id UUID REFERENCES public.document_signatures(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for signature field placements on PDFs
CREATE TABLE public.document_signature_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.document_signers(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position NUMERIC NOT NULL,
  y_position NUMERIC NOT NULL,
  width NUMERIC NOT NULL DEFAULT 200,
  height NUMERIC NOT NULL DEFAULT 60,
  field_type TEXT NOT NULL DEFAULT 'signature' CHECK (field_type IN ('signature', 'date', 'name', 'email')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add signer_id to document_signatures to link to specific signer
ALTER TABLE public.document_signatures 
ADD COLUMN signer_id UUID REFERENCES public.document_signers(id);

-- Enable RLS on new tables
ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signature_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_signers
CREATE POLICY "Anyone can view document signers" 
ON public.document_signers 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create document signers" 
ON public.document_signers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update document signers" 
ON public.document_signers 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete document signers" 
ON public.document_signers 
FOR DELETE 
USING (true);

-- RLS policies for document_signature_fields
CREATE POLICY "Anyone can view signature fields" 
ON public.document_signature_fields 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create signature fields" 
ON public.document_signature_fields 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update signature fields" 
ON public.document_signature_fields 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete signature fields" 
ON public.document_signature_fields 
FOR DELETE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_document_signers_document_id ON public.document_signers(document_id);
CREATE INDEX idx_document_signers_status ON public.document_signers(status);
CREATE INDEX idx_document_signature_fields_document_id ON public.document_signature_fields(document_id);
CREATE INDEX idx_document_signature_fields_signer_id ON public.document_signature_fields(signer_id);

-- Add trigger for updated_at
CREATE TRIGGER update_document_signers_updated_at
BEFORE UPDATE ON public.document_signers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();