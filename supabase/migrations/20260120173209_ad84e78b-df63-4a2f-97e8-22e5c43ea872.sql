-- Update auto-created opportunities with oldest note dates where available
UPDATE opportunities o
SET 
  created_at = cn.oldest_note_date,
  ghl_date_added = cn.oldest_note_date,
  updated_at = now()
FROM (
  SELECT 
    contact_id,
    MIN(ghl_date_added) as oldest_note_date
  FROM contact_notes
  WHERE contact_id IN (
    SELECT contact_id FROM opportunities 
    WHERE ghl_id LIKE 'local_%' 
    AND stage_name = 'Follow up'
  )
  GROUP BY contact_id
) cn
WHERE o.contact_id = cn.contact_id
  AND o.ghl_id LIKE 'local_%'
  AND cn.oldest_note_date IS NOT NULL