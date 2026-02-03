-- Add display_order column to project_payment_phases
ALTER TABLE project_payment_phases 
ADD COLUMN display_order integer;

-- Initialize display_order based on existing due_date ordering
WITH ordered_phases AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY agreement_id ORDER BY due_date ASC NULLS LAST, created_at ASC) as row_num
  FROM project_payment_phases
)
UPDATE project_payment_phases 
SET display_order = ordered_phases.row_num
FROM ordered_phases 
WHERE project_payment_phases.id = ordered_phases.id;