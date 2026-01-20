-- Auto-create opportunities for orphaned tasks (tasks without opportunities)
-- Places them in "Follow up" stage with date set to earliest task date

INSERT INTO opportunities (
  ghl_id,
  contact_id,
  location_id,
  company_id,
  name,
  status,
  pipeline_id,
  pipeline_stage_id,
  pipeline_name,
  stage_name,
  created_at,
  ghl_date_added,
  provider
)
SELECT
  'local_' || gen_random_uuid()::text as ghl_id,
  orphaned.contact_id,
  orphaned.location_id,
  orphaned.company_id,
  orphaned.contact_name as name,
  'open' as status,
  '6bUqC98F6LCM9zuUitXw' as pipeline_id,
  '43fe8e79-7c9c-461b-8fd2-9f8901ce82ff' as pipeline_stage_id,
  'Vanessa' as pipeline_name,
  'Follow up' as stage_name,
  orphaned.earliest_task_date as created_at,
  orphaned.earliest_task_date as ghl_date_added,
  'local' as provider
FROM (
  SELECT 
    t.contact_id,
    t.location_id,
    t.company_id,
    c.contact_name,
    MIN(t.created_at) as earliest_task_date
  FROM ghl_tasks t
  JOIN contacts c ON c.ghl_id = t.contact_id
  WHERE t.contact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM opportunities o 
      WHERE o.contact_id = t.contact_id
    )
  GROUP BY t.contact_id, t.location_id, t.company_id, c.contact_name
) orphaned