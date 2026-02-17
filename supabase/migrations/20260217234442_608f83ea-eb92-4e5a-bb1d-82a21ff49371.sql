
-- Trigger function: auto-sync profiles.corporation_id when a company's corporation_id changes
CREATE OR REPLACE FUNCTION public.sync_profiles_corporation_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.corporation_id IS DISTINCT FROM NEW.corporation_id THEN
    UPDATE public.profiles
    SET corporation_id = NEW.corporation_id
    WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to companies table
CREATE TRIGGER trg_sync_profiles_corporation_id
AFTER UPDATE OF corporation_id ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_corporation_id();
