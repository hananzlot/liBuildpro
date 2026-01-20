
-- Update orphaned opportunities with their oldest appointment date
UPDATE opportunities o
SET 
  created_at = sub.oldest_appt_date,
  ghl_date_added = sub.oldest_appt_date
FROM (
  SELECT o2.id, MIN(a.start_time) as oldest_appt_date
  FROM opportunities o2
  JOIN appointments a ON a.contact_id = o2.contact_id
  WHERE o2.ghl_id LIKE 'local_opp_%'
  GROUP BY o2.id
) sub
WHERE o.id = sub.id
  AND sub.oldest_appt_date IS NOT NULL
