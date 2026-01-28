-- Backfill null invoice numbers with unique sequential values
-- Format: INV-XXXXXX where X is a sequential number
WITH numbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) + COALESCE(
      (SELECT MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INTEGER)) 
       FROM project_invoices 
       WHERE invoice_number IS NOT NULL AND invoice_number ~ '^[0-9]+$'),
      1000
    ) as new_number
  FROM project_invoices
  WHERE invoice_number IS NULL
)
UPDATE project_invoices 
SET invoice_number = numbered.new_number::text
FROM numbered
WHERE project_invoices.id = numbered.id;