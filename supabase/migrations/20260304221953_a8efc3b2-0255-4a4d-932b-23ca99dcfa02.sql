
-- Trigger: when a project status changes to "New Job" or "In-Progress",
-- automatically mark the linked opportunity as "won" if it's still "open".
CREATE OR REPLACE FUNCTION public.auto_mark_opportunity_won_on_project_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when project_status changes to a production stage
  IF (TG_OP = 'UPDATE' AND OLD.project_status IS DISTINCT FROM NEW.project_status)
     OR TG_OP = 'INSERT' THEN

    IF NEW.project_status IN ('New Job', 'In-Progress', 'Awaiting Finance', 'On-Hold', 'Completed') THEN
      -- Update by opportunity_uuid first
      IF NEW.opportunity_uuid IS NOT NULL THEN
        UPDATE public.opportunities
        SET status = 'won',
            won_at = COALESCE(won_at, now()),
            updated_at = now()
        WHERE id = NEW.opportunity_uuid
          AND status != 'won';
      -- Fallback: update by opportunity_id (ghl_id)
      ELSIF NEW.opportunity_id IS NOT NULL THEN
        UPDATE public.opportunities
        SET status = 'won',
            won_at = COALESCE(won_at, now()),
            updated_at = now()
        WHERE ghl_id = NEW.opportunity_id
          AND status != 'won';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_mark_opportunity_won ON public.projects;
CREATE TRIGGER trg_auto_mark_opportunity_won
  AFTER INSERT OR UPDATE OF project_status
  ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_mark_opportunity_won_on_project_status();

-- Backfill: mark existing open opportunities as won if their project is already in production
UPDATE public.opportunities o
SET status = 'won',
    won_at = COALESCE(o.won_at, now()),
    updated_at = now()
FROM public.projects p
WHERE (p.opportunity_uuid = o.id OR p.opportunity_id = o.ghl_id)
  AND p.deleted_at IS NULL
  AND p.project_status IN ('New Job', 'In-Progress', 'Awaiting Finance', 'On-Hold', 'Completed')
  AND o.status != 'won';
