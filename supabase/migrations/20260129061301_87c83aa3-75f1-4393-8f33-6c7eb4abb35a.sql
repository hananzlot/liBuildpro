-- Backfill client_portal_tokens.company_id from projects
UPDATE client_portal_tokens cpt
SET company_id = p.company_id
FROM projects p
WHERE cpt.project_id = p.id
  AND cpt.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- Backfill any remaining from estimates (if project didn't have company_id)
UPDATE client_portal_tokens cpt
SET company_id = e.company_id
FROM estimates e
WHERE cpt.estimate_id = e.id
  AND cpt.company_id IS NULL
  AND e.company_id IS NOT NULL;