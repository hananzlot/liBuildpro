-- Backfill null company_id on project_agreements by inheriting from the project
UPDATE project_agreements pa
SET company_id = p.company_id
FROM projects p
WHERE pa.project_id = p.id
  AND pa.company_id IS NULL
  AND p.company_id IS NOT NULL;