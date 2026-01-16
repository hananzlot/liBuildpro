-- Allow public access to document signatures when accessed via a valid portal token
CREATE POLICY "Public can view signatures via valid portal token"
ON public.document_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_portal_tokens dpt
    WHERE dpt.document_id = document_signatures.document_id
    AND dpt.is_active = true
    AND (dpt.expires_at IS NULL OR dpt.expires_at > now())
  )
);

-- Allow public to update document signers status via valid portal token (for viewed/signed status updates)
CREATE POLICY "Public can update signers via valid portal token"
ON public.document_signers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.document_portal_tokens dpt
    WHERE dpt.document_id = document_signers.document_id
    AND dpt.is_active = true
    AND (dpt.expires_at IS NULL OR dpt.expires_at > now())
  )
);

-- Allow public to update signature documents status via valid portal token
CREATE POLICY "Public can update documents via valid portal token"
ON public.signature_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.document_portal_tokens dpt
    WHERE dpt.document_id = signature_documents.id
    AND dpt.is_active = true
    AND (dpt.expires_at IS NULL OR dpt.expires_at > now())
  )
);

-- Allow public to update portal token access tracking
CREATE POLICY "Public can update token access tracking"
ON public.document_portal_tokens
FOR UPDATE
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));