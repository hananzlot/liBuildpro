-- Add estimate_id column to project_documents to segregate photos by estimate/proposal
ALTER TABLE public.project_documents 
ADD COLUMN estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL;

-- Add index for efficient querying by estimate
CREATE INDEX idx_project_documents_estimate_id ON public.project_documents(estimate_id);

-- Update RLS policies to allow access based on estimate tokens
-- First drop existing policies that might conflict
DROP POLICY IF EXISTS "Portal tokens can view project documents" ON public.project_documents;

-- Create updated policy that allows viewing by project token OR estimate token
CREATE POLICY "Portal tokens can view project documents"
ON public.project_documents
FOR SELECT
USING (
  -- Project-level access via project portal token
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.project_id = project_documents.project_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
  OR
  -- Estimate-level access via estimate portal token (for estimate-specific photos)
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.estimate_id = project_documents.estimate_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.project_documents.estimate_id IS 'Links document/photo to a specific estimate. When set, the photo is scoped to that estimate only and will only appear in that estimate''s portal view. NULL means the photo is shared across all estimates for the project.';