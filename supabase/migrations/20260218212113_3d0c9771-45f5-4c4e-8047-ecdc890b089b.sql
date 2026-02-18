
-- Deactivate orphaned portal tokens for soft-deleted projects
UPDATE public.client_portal_tokens
SET is_active = false
WHERE project_id IN (
  SELECT id FROM public.projects WHERE deleted_at IS NOT NULL
)
AND is_active = true;
