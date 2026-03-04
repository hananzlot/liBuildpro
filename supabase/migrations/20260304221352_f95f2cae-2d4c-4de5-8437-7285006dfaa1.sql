-- Fix agreement types: agreements created after the first Contract should be Change Order
-- For each project, the first agreement (by created_at) stays as Contract, subsequent ones become Change Order
WITH ranked_agreements AS (
  SELECT id, project_id, agreement_type, agreement_number,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at ASC) as rn
  FROM project_agreements
  WHERE agreement_type = 'Contract'
)
UPDATE project_agreements pa
SET 
  agreement_type = 'Change Order',
  agreement_number = REPLACE(pa.agreement_number, 'CNT-', 'CO-')
FROM ranked_agreements ra
WHERE pa.id = ra.id 
  AND ra.rn > 1;

-- Backfill salesperson on estimates that are linked to a project but have null salesperson
UPDATE estimates e
SET 
  salesperson_name = p.primary_salesperson,
  salesperson_id = (
    SELECT s.id FROM salespeople s 
    WHERE s.name = p.primary_salesperson 
      AND s.company_id = e.company_id 
    LIMIT 1
  )
FROM projects p
WHERE e.project_id = p.id
  AND e.salesperson_name IS NULL
  AND p.primary_salesperson IS NOT NULL;