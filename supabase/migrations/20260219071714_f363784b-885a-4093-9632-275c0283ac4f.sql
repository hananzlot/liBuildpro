
-- Backfill existing estimates: copy contact_uuid from linked opportunity where null
UPDATE public.estimates e
SET contact_uuid = o.contact_uuid
FROM public.opportunities o
WHERE e.opportunity_uuid = o.id
  AND e.contact_uuid IS NULL
  AND o.contact_uuid IS NOT NULL;

-- Create trigger function to auto-sync contact_uuid on estimates from opportunity
CREATE OR REPLACE FUNCTION public.sync_estimate_contact_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when contact_uuid is missing but opportunity_uuid is present
  IF NEW.contact_uuid IS NULL AND NEW.opportunity_uuid IS NOT NULL THEN
    SELECT contact_uuid
    INTO NEW.contact_uuid
    FROM public.opportunities
    WHERE id = NEW.opportunity_uuid
      AND contact_uuid IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on estimates table
CREATE TRIGGER trg_sync_estimate_contact_uuid
BEFORE INSERT OR UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.sync_estimate_contact_uuid();
