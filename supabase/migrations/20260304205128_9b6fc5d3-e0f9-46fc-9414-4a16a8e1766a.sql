
-- Create a trigger function to auto-create an opportunity when a project is inserted without one
CREATE OR REPLACE FUNCTION public.auto_create_opportunity_for_project()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_opportunity_id UUID;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_stage_name TEXT;
  v_pipeline_name TEXT;
  v_opp_name TEXT;
BEGIN
  -- Only proceed if the project has no opportunity_uuid and has a company_id
  IF NEW.opportunity_uuid IS NULL AND NEW.company_id IS NOT NULL THEN
    
    -- Try to find a "Main" pipeline for this company
    SELECT id, name INTO v_pipeline_id, v_pipeline_name
    FROM public.pipelines
    WHERE company_id = NEW.company_id
    ORDER BY name = 'Main' DESC, created_at ASC
    LIMIT 1;
    
    -- Try to find a "New Lead" or first stage in the pipeline
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id, name INTO v_stage_id, v_stage_name
      FROM public.pipeline_stages
      WHERE pipeline_id = v_pipeline_id
        AND company_id = NEW.company_id
      ORDER BY name = 'New Lead' DESC, created_at ASC
      LIMIT 1;
    END IF;
    
    -- Build the opportunity name from project info
    v_opp_name := COALESCE(
      NULLIF(TRIM(COALESCE(NEW.customer_first_name, '') || ' ' || COALESCE(NEW.customer_last_name, '')), ''),
      NEW.project_name,
      'Project #' || COALESCE(NEW.project_number::text, NEW.id::text)
    );
    
    -- Create the opportunity
    INSERT INTO public.opportunities (
      company_id,
      location_id,
      name,
      contact_uuid,
      contact_id,
      address,
      monetary_value,
      status,
      pipeline_name,
      pipeline_id,
      stage_name,
      pipeline_stage_id,
      provider,
      ghl_id,
      entered_by
    ) VALUES (
      NEW.company_id,
      COALESCE(NEW.location_id, 'mMXD49n5UApITSmKlWdr'),
      v_opp_name,
      NEW.contact_uuid,
      NEW.contact_id,
      NEW.project_address,
      NEW.estimated_cost,
      'open',
      v_pipeline_name,
      v_pipeline_id::text,
      v_stage_name,
      v_stage_id::text,
      'local',
      'local_' || gen_random_uuid()::text,
      NEW.created_by
    )
    RETURNING id INTO v_opportunity_id;
    
    -- Link the opportunity to the project
    NEW.opportunity_uuid := v_opportunity_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger (BEFORE INSERT so we can modify NEW)
DROP TRIGGER IF EXISTS auto_create_opportunity_for_project_trigger ON public.projects;
CREATE TRIGGER auto_create_opportunity_for_project_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_opportunity_for_project();
