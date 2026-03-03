-- Backfill project_id on signed_compliance_documents from their linked estimates
UPDATE signed_compliance_documents scd
SET project_id = e.project_id
FROM estimates e
WHERE scd.estimate_id = e.id
  AND scd.project_id IS NULL
  AND e.project_id IS NOT NULL;