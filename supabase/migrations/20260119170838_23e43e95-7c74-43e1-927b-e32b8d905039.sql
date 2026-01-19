-- Create estimate_signers table to track multiple signers per estimate
CREATE TABLE public.estimate_signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  signature_id UUID REFERENCES public.estimate_signatures(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create estimate_portal_tokens table for individual signer tokens
CREATE TABLE public.estimate_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES public.estimate_signers(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.estimate_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_portal_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for estimate_signers
-- Authenticated users can view all signers (for internal management)
CREATE POLICY "Authenticated users can view estimate signers"
ON public.estimate_signers
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert signers
CREATE POLICY "Authenticated users can insert estimate signers"
ON public.estimate_signers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can update signers
CREATE POLICY "Authenticated users can update estimate signers"
ON public.estimate_signers
FOR UPDATE
TO authenticated
USING (true);

-- Authenticated users can delete signers
CREATE POLICY "Authenticated users can delete estimate signers"
ON public.estimate_signers
FOR DELETE
TO authenticated
USING (true);

-- Public access via valid portal token (for signers viewing/signing)
CREATE POLICY "Public can view signer via valid token"
ON public.estimate_signers
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.estimate_portal_tokens
    WHERE estimate_portal_tokens.signer_id = estimate_signers.id
    AND estimate_portal_tokens.is_active = true
    AND (estimate_portal_tokens.expires_at IS NULL OR estimate_portal_tokens.expires_at > now())
  )
);

-- Public can update their own signer record via valid token
CREATE POLICY "Public can update signer via valid token"
ON public.estimate_signers
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.estimate_portal_tokens
    WHERE estimate_portal_tokens.signer_id = estimate_signers.id
    AND estimate_portal_tokens.is_active = true
    AND (estimate_portal_tokens.expires_at IS NULL OR estimate_portal_tokens.expires_at > now())
  )
);

-- RLS policies for estimate_portal_tokens
-- Authenticated users can manage tokens
CREATE POLICY "Authenticated users can view estimate portal tokens"
ON public.estimate_portal_tokens
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert estimate portal tokens"
ON public.estimate_portal_tokens
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update estimate portal tokens"
ON public.estimate_portal_tokens
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete estimate portal tokens"
ON public.estimate_portal_tokens
FOR DELETE
TO authenticated
USING (true);

-- Public can view their own token (for validation)
CREATE POLICY "Public can view active portal tokens"
ON public.estimate_portal_tokens
FOR SELECT
TO anon
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

-- Public can update access count on their token
CREATE POLICY "Public can update portal token access"
ON public.estimate_portal_tokens
FOR UPDATE
TO anon
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

-- Create indexes for performance
CREATE INDEX idx_estimate_signers_estimate_id ON public.estimate_signers(estimate_id);
CREATE INDEX idx_estimate_signers_status ON public.estimate_signers(status);
CREATE INDEX idx_estimate_portal_tokens_token ON public.estimate_portal_tokens(token);
CREATE INDEX idx_estimate_portal_tokens_signer_id ON public.estimate_portal_tokens(signer_id);

-- Add trigger for updated_at on estimate_signers
CREATE TRIGGER update_estimate_signers_updated_at
BEFORE UPDATE ON public.estimate_signers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();