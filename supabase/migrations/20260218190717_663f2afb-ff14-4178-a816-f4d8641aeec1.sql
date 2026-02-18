-- Create a security-definer function that allows any authenticated user to soft-delete
-- a project that is in an early stage (pre-estimate, estimate, or proposal), 
-- specifically for the "mark opportunity as lost" workflow.
CREATE OR REPLACE FUNCTION public.soft_delete_early_stage_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_status text;
  v_project_company_id uuid;
  v_caller_uid uuid;
BEGIN
  v_caller_uid := auth.uid();

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get project details
  SELECT project_status, company_id
  INTO v_project_status, v_project_company_id
  FROM public.projects
  WHERE id = p_project_id
    AND deleted_at IS NULL;

  IF v_project_company_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Verify the calling user has access to this company
  IF NOT public.has_company_access(v_project_company_id) THEN
    RAISE EXCEPTION 'Access denied: project belongs to a different company';
  END IF;

  -- Only allow deletion of early-stage projects
  IF v_project_status IS NULL OR NOT (
    LOWER(v_project_status) LIKE '%pre-estimate%' OR
    LOWER(v_project_status) LIKE '%estimate%' OR
    LOWER(v_project_status) LIKE '%proposal%'
  ) THEN
    RAISE EXCEPTION 'Project is not in an early stage (pre-estimate, estimate, or proposal)';
  END IF;

  -- Soft-delete the project
  UPDATE public.projects
  SET deleted_at = now()
  WHERE id = p_project_id;

  RETURN FOUND;
END;
$$;