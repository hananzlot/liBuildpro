-- 1. Backfill contact_uuid on opportunities from contacts.ghl_id
UPDATE opportunities o
SET contact_uuid = c.id
FROM contacts c
WHERE c.ghl_id = o.contact_id
  AND o.contact_uuid IS NULL
  AND o.contact_id IS NOT NULL;

-- 2. Backfill opportunity_uuid on projects from opportunities (by GHL ID)
UPDATE projects p
SET opportunity_uuid = o.id
FROM opportunities o
WHERE o.ghl_id = p.opportunity_id
  AND p.opportunity_uuid IS NULL
  AND p.opportunity_id IS NOT NULL
  AND p.deleted_at IS NULL;

-- 3. For orphan projects with no opportunity at all, create opportunities automatically
DO $$
DECLARE
  rec RECORD;
  v_opp_id UUID;
BEGIN
  FOR rec IN
    SELECT p.id as project_id, p.project_name, p.company_id, p.location_id,
           p.contact_uuid, p.customer_first_name, p.customer_last_name,
           p.estimated_cost, p.project_scope_dispatch, p.project_address
    FROM projects p
    WHERE p.opportunity_uuid IS NULL
      AND p.opportunity_id IS NULL
      AND p.deleted_at IS NULL
      AND p.company_id IS NOT NULL
  LOOP
    INSERT INTO opportunities (
      ghl_id, location_id, contact_uuid, name, status, stage_name,
      pipeline_name, provider, company_id, ghl_date_added,
      monetary_value, scope_of_work, address
    ) VALUES (
      'local_opp_backfill_' || gen_random_uuid()::text,
      COALESCE(rec.location_id, 'local'),
      rec.contact_uuid,
      COALESCE(rec.project_name, 'Backfilled Opportunity'),
      'won',
      'Won',
      'Main',
      'local',
      rec.company_id,
      now(),
      rec.estimated_cost,
      rec.project_scope_dispatch,
      rec.project_address
    )
    RETURNING id INTO v_opp_id;

    UPDATE projects SET opportunity_uuid = v_opp_id WHERE id = rec.project_id;
  END LOOP;
END $$;