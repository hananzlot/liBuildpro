-- Backfill existing Estimate Photos to their associated estimates
-- This assigns photos to the FIRST estimate for each project (oldest by created_at)
-- For projects with multiple estimates, admins may need to manually reassign photos

UPDATE public.project_documents pd
SET estimate_id = (
  SELECT e.id 
  FROM public.estimates e 
  WHERE e.project_id = pd.project_id 
  ORDER BY e.created_at ASC 
  LIMIT 1
)
WHERE pd.category = 'Estimate Photo'
  AND pd.estimate_id IS NULL
  AND pd.project_id IS NOT NULL;