
-- Backfill: set salesperson_name from project's primary_salesperson where missing
UPDATE estimates e
SET salesperson_name = p.primary_salesperson,
    salesperson_id = (
      SELECT s.id FROM salespeople s
      WHERE s.name = p.primary_salesperson AND s.company_id = e.company_id
      LIMIT 1
    )
FROM projects p
WHERE e.project_id = p.id
  AND e.salesperson_name IS NULL
  AND p.primary_salesperson IS NOT NULL;

-- Trigger: auto-inherit salesperson from project when creating an estimate
CREATE OR REPLACE FUNCTION public.auto_inherit_salesperson_on_estimate()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only fill if salesperson_name is not already set and project_id exists
  IF NEW.salesperson_name IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT p.primary_salesperson INTO NEW.salesperson_name
    FROM public.projects p
    WHERE p.id = NEW.project_id
      AND p.primary_salesperson IS NOT NULL;

    -- Also set salesperson_id if we found a name
    IF NEW.salesperson_name IS NOT NULL AND NEW.salesperson_id IS NULL THEN
      SELECT s.id INTO NEW.salesperson_id
      FROM public.salespeople s
      WHERE s.name = NEW.salesperson_name
        AND s.company_id = NEW.company_id
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_inherit_salesperson_on_estimate ON public.estimates;
CREATE TRIGGER trg_auto_inherit_salesperson_on_estimate
  BEFORE INSERT ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_inherit_salesperson_on_estimate();
