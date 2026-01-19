-- Clean up duplicate estimate_line_items, keeping only the most recent record
-- First, identify and delete duplicates using a CTE

WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY estimate_id, description, quantity, unit_price, line_total, group_id
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM estimate_line_items
)
DELETE FROM estimate_line_items
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);