-- Delete duplicate opportunities, keeping only the oldest one per contact/name
DELETE FROM opportunities
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY contact_id, name ORDER BY ghl_date_added ASC) as rn
    FROM opportunities
    WHERE contact_id IS NOT NULL AND name IS NOT NULL
  ) duplicates
  WHERE rn > 1
);