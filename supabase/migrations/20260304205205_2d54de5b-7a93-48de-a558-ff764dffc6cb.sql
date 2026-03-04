
-- Backfill: Create opportunity for project 134 (Demo Co) and link it
DO $$
DECLARE
  v_opp_id UUID;
  v_project RECORD;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_stage_name TEXT;
  v_pipeline_name TEXT;
BEGIN
  -- Get project details
  SELECT * INTO v_project FROM projects WHERE id = '97b3232b-dbf5-45d7-9ef0-f72f623ac640';
  
  -- Get pipeline info
  SELECT id, name INTO v_pipeline_id, v_pipeline_name
  FROM pipelines WHERE company_id = v_project.company_id
  ORDER BY name = 'Main' DESC, created_at ASC LIMIT 1;
  
  SELECT id, name INTO v_stage_id, v_stage_name
  FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND company_id = v_project.company_id
  ORDER BY name = 'New Lead' DESC, created_at ASC LIMIT 1;
  
  -- Create opportunity
  INSERT INTO opportunities (
    company_id, location_id, name, contact_uuid, address,
    monetary_value, status, pipeline_name, pipeline_id,
    stage_name, pipeline_stage_id, provider, ghl_id, entered_by
  ) VALUES (
    v_project.company_id,
    COALESCE(v_project.location_id, 'mMXD49n5UApITSmKlWdr'),
    COALESCE(NULLIF(TRIM(COALESCE(v_project.customer_first_name,'') || ' ' || COALESCE(v_project.customer_last_name,'')), ''), v_project.project_name),
    v_project.contact_uuid,
    v_project.project_address,
    v_project.estimated_cost,
    'open',
    v_pipeline_name,
    v_pipeline_id::text,
    v_stage_name,
    v_stage_id::text,
    'local',
    'local_' || gen_random_uuid()::text,
    v_project.created_by
  ) RETURNING id INTO v_opp_id;
  
  -- Link to project
  UPDATE projects SET opportunity_uuid = v_opp_id WHERE id = v_project.id;
END $$;
