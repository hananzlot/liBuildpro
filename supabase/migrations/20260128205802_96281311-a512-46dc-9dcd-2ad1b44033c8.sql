-- Backfill missing company_id on commission_payments from their linked projects
UPDATE commission_payments cp
SET company_id = p.company_id
FROM projects p
WHERE cp.project_id = p.id
  AND cp.company_id IS NULL
  AND p.company_id IS NOT NULL;