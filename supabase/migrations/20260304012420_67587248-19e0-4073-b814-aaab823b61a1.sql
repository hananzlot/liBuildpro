-- Drop existing portal SELECT policy
DROP POLICY IF EXISTS "Portal visitors can view their signed docs" ON signed_compliance_documents;

-- Create updated portal SELECT policy that also handles project_id queries
CREATE POLICY "Portal visitors can view their signed docs" 
ON signed_compliance_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM client_portal_tokens cpt
    WHERE cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
      AND (
        cpt.estimate_id = signed_compliance_documents.estimate_id
        OR cpt.project_id = signed_compliance_documents.project_id
      )
  )
);