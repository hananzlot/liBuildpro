
-- =====================================================
-- FIX: document_signatures INSERT policy
-- Currently uses WITH CHECK (true) - anyone can insert fake signatures
-- =====================================================

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert signatures via portal" ON public.document_signatures;

-- Create proper validation: signatures can only be inserted by:
-- 1. Authenticated users in the document's company, OR
-- 2. Public users with a valid active portal token for the document
CREATE POLICY "Insert signatures via valid portal token"
  ON public.document_signatures FOR INSERT
  WITH CHECK (
    -- Must have a valid active portal token for this document
    EXISTS (
      SELECT 1 FROM document_portal_tokens dpt
      WHERE dpt.document_id = document_signatures.document_id
        AND dpt.is_active = true
        AND (dpt.expires_at IS NULL OR dpt.expires_at > now())
    )
    OR
    -- Or be an authenticated user with company access
    (auth.uid() IS NOT NULL AND has_company_access(company_id))
  );

-- Also fix the estimate_signatures INSERT policy which has the same issue
DROP POLICY IF EXISTS "Anyone can insert signatures" ON public.estimate_signatures;

CREATE POLICY "Insert estimate_signatures via valid portal token"
  ON public.estimate_signatures FOR INSERT
  WITH CHECK (
    -- Must have a valid active portal token for this estimate
    EXISTS (
      SELECT 1 FROM client_portal_tokens cpt
      WHERE cpt.estimate_id = estimate_signatures.estimate_id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
    )
    OR
    -- Or be an authenticated user with company access
    (auth.uid() IS NOT NULL AND has_company_access(company_id))
  );
