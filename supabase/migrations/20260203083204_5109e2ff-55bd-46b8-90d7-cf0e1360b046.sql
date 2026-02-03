-- Create a function to auto-create a contact when a project is created without one
CREATE OR REPLACE FUNCTION public.auto_create_contact_for_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact_id UUID;
  v_contact_name TEXT;
BEGIN
  -- Only proceed if:
  -- 1. The project has no contact_uuid
  -- 2. There's customer info to create a contact from (name or email)
  IF NEW.contact_uuid IS NULL AND NEW.company_id IS NOT NULL AND (
    (NEW.customer_first_name IS NOT NULL AND NEW.customer_first_name != '') OR
    (NEW.customer_last_name IS NOT NULL AND NEW.customer_last_name != '') OR
    (NEW.customer_email IS NOT NULL AND NEW.customer_email != '')
  ) THEN
    -- Build the contact name
    v_contact_name := NULLIF(TRIM(COALESCE(NEW.customer_first_name, '') || ' ' || COALESCE(NEW.customer_last_name, '')), '');
    
    -- Try to find an existing contact by email (if provided) within the same company
    IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
      SELECT id INTO v_contact_id
      FROM public.contacts
      WHERE company_id = NEW.company_id
        AND LOWER(email) = LOWER(NEW.customer_email)
      LIMIT 1;
    END IF;
    
    -- If no match by email, try to find by exact name match
    IF v_contact_id IS NULL AND v_contact_name IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM public.contacts
      WHERE company_id = NEW.company_id
        AND LOWER(contact_name) = LOWER(v_contact_name)
      LIMIT 1;
    END IF;
    
    -- If still no match, create a new contact
    IF v_contact_id IS NULL THEN
      INSERT INTO public.contacts (
        company_id,
        location_id,
        first_name,
        last_name,
        contact_name,
        email,
        phone,
        provider,
        ghl_id
      ) VALUES (
        NEW.company_id,
        COALESCE(NEW.location_id, 'mMXD49n5UApITSmKlWdr'),
        NEW.customer_first_name,
        NEW.customer_last_name,
        v_contact_name,
        NEW.customer_email,
        COALESCE(NEW.cell_phone, NEW.home_phone),
        'local',
        'local_' || gen_random_uuid()::text
      )
      RETURNING id INTO v_contact_id;
    END IF;
    
    -- Link the project to the contact
    NEW.contact_uuid := v_contact_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS auto_create_contact_for_project_trigger ON public.projects;

CREATE TRIGGER auto_create_contact_for_project_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_contact_for_project();