
-- Backfill ai_analysis for EST 2106 from the completed generation job
UPDATE estimates
SET ai_analysis = (
  SELECT jsonb_build_object(
    'project_understanding', result_json->'scope'->'project_understanding',
    'assumptions', result_json->'scope'->'assumptions',
    'inclusions', result_json->'scope'->'inclusions',
    'exclusions', result_json->'scope'->'exclusions',
    'missing_info', result_json->'scope'->'missing_info'
  )
  FROM estimate_generation_jobs
  WHERE estimate_id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a'
    AND status = 'completed'
    AND result_json IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a';
