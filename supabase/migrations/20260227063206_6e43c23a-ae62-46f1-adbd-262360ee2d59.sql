
CREATE OR REPLACE FUNCTION public.archive_stale_projects(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_estimates int;
  v_expired_proposals int;
BEGIN
  -- Archive projects linked to old estimates (30+ days)
  UPDATE projects p
  SET deleted_at = now()
  FROM estimates e
  WHERE e.project_id = p.id
    AND p.company_id = p_company_id
    AND p.project_status = 'Estimate'
    AND p.deleted_at IS NULL
    AND e.estimate_date < now() - interval '30 days';
  GET DIAGNOSTICS v_old_estimates = ROW_COUNT;

  -- Archive projects linked to expired proposals (7+ days past expiration)
  UPDATE projects p
  SET deleted_at = now()
  FROM estimates e
  WHERE e.project_id = p.id
    AND p.company_id = p_company_id
    AND p.project_status = 'Proposal'
    AND p.deleted_at IS NULL
    AND e.expiration_date IS NOT NULL
    AND e.expiration_date < now() - interval '7 days';
  GET DIAGNOSTICS v_expired_proposals = ROW_COUNT;

  RETURN jsonb_build_object(
    'old_estimates_archived', v_old_estimates,
    'expired_proposals_archived', v_expired_proposals
  );
END;
$$;
