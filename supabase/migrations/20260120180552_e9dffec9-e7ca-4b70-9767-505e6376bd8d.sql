-- Backfill company_id for projects missing it (based on linked estimates or portal tokens)
UPDATE projects p
SET company_id = COALESCE(
  -- First try to get company_id from linked estimate
  (SELECT e.company_id FROM estimates e WHERE e.project_id = p.id AND e.company_id IS NOT NULL LIMIT 1),
  -- Then try from portal token
  (SELECT cpt.company_id FROM client_portal_tokens cpt WHERE cpt.project_id = p.id AND cpt.company_id IS NOT NULL LIMIT 1)
)
WHERE p.company_id IS NULL;