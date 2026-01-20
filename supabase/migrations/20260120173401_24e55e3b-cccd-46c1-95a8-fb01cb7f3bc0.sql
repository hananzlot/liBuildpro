-- Update ALL opportunities created today to use oldest note date where available
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
  WHERE ghl_date_added IS NOT NULL
  GROUP BY contact_id
) cn
WHERE o.contact_id = cn.contact_id
  AND DATE(o.created_at) = CURRENT_DATE
  AND cn.oldest_note_date < o.created_at