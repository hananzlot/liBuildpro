-- Allow public access to projects via valid portal tokens
CREATE POLICY "Public can view projects via portal token"
ON public.projects
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM client_portal_tokens cpt
    WHERE cpt.project_id = projects.id
    AND cpt.is_active = true
    AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);