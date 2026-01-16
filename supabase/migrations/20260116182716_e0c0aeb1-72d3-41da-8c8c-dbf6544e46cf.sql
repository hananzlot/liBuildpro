-- Allow public access to signature documents when accessed via a valid portal token
CREATE POLICY "Public can view documents via valid portal token"
ON public.signature_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_portal_tokens dpt
    WHERE dpt.document_id = signature_documents.id
    AND dpt.is_active = true
    AND (dpt.expires_at IS NULL OR dpt.expires_at > now())
  )
);