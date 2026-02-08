-- Create trigger to auto-populate company_id from project on portal_chat_messages
CREATE OR REPLACE FUNCTION public.set_portal_chat_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If company_id is not set, get it from the project
  IF NEW.company_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on insert
DROP TRIGGER IF EXISTS set_portal_chat_company_id_trigger ON public.portal_chat_messages;
CREATE TRIGGER set_portal_chat_company_id_trigger
  BEFORE INSERT ON public.portal_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_chat_company_id();

-- Backfill existing messages with null company_id
UPDATE public.portal_chat_messages pcm
SET company_id = p.company_id
FROM public.projects p
WHERE pcm.project_id = p.id
  AND pcm.company_id IS NULL
  AND p.company_id IS NOT NULL;