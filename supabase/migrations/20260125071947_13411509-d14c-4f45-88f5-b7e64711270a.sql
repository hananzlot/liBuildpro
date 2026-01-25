-- Backfill opportunities: set assigned_to from salesperson's ghl_user_id where missing
UPDATE opportunities o
SET assigned_to = s.ghl_user_id
FROM salespeople s
WHERE o.salesperson_id = s.id
  AND s.ghl_user_id IS NOT NULL
  AND (o.assigned_to IS NULL OR o.assigned_to = '');