-- Create a function to automatically create a portal token for new projects
CREATE OR REPLACE FUNCTION public.auto_create_portal_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create portal token if project has a company_id and is not a pre-estimate/proposal status
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO public.client_portal_tokens (
      project_id,
      client_name,
      client_email,
      company_id,
      is_active,
      created_by
    ) VALUES (
      NEW.id,
      COALESCE(
        NULLIF(TRIM(COALESCE(NEW.customer_first_name, '') || ' ' || COALESCE(NEW.customer_last_name, '')), ''),
        NEW.project_name
      ),
      NEW.customer_email,
      NEW.company_id,
      true,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run on project insert
DROP TRIGGER IF EXISTS trigger_auto_create_portal_token ON projects;
CREATE TRIGGER trigger_auto_create_portal_token
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_portal_token();

-- Backfill: Create portal tokens for existing projects that don't have one
INSERT INTO public.client_portal_tokens (project_id, client_name, client_email, company_id, is_active)
SELECT 
  p.id,
  COALESCE(
    NULLIF(TRIM(COALESCE(p.customer_first_name, '') || ' ' || COALESCE(p.customer_last_name, '')), ''),
    p.project_name
  ),
  p.customer_email,
  p.company_id,
  true
FROM public.projects p
WHERE p.deleted_at IS NULL
  AND p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt 
    WHERE cpt.project_id = p.id
  );