-- Allow public access to project_agreements via valid portal tokens
CREATE POLICY "Portal can read project_agreements via token"
ON public.project_agreements
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM client_portal_tokens cpt
    WHERE cpt.project_id = project_agreements.project_id
    AND cpt.is_active = true
    AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);