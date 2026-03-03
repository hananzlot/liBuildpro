
-- Backfill from pipeline_stages table (UUID-based stage IDs)
UPDATE opportunities o
SET stage_name = ps.name
FROM pipeline_stages ps
WHERE o.stage_name IS NULL
  AND o.pipeline_stage_id = ps.id::text;

-- Backfill legacy local_stage_X IDs using position
UPDATE opportunities o
SET stage_name = ps.name
FROM pipeline_stages ps
WHERE o.stage_name IS NULL
  AND o.pipeline_stage_id LIKE 'local_stage_%'
  AND ps.company_id = o.company_id
  AND ps.position = CAST(REPLACE(o.pipeline_stage_id, 'local_stage_', '') AS int);
