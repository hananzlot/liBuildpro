-- Clean duplicate opportunities again (keep oldest per contact_id + name)
DELETE FROM opportunities
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY contact_id, name
             ORDER BY ghl_date_added ASC NULLS LAST, created_at ASC
           ) AS rn
    FROM opportunities
    WHERE contact_id IS NOT NULL AND name IS NOT NULL
  ) d
  WHERE d.rn > 1
);
