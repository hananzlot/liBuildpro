
-- Delete duplicate AI Analysis notes, keeping only the most recent per contact
WITH ranked_notes AS (
  SELECT id, contact_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY created_at DESC) as rn
  FROM contact_notes
  WHERE body LIKE '%[SYSTEM - AI Analysis]%'
),
notes_to_delete AS (
  SELECT id FROM ranked_notes WHERE rn > 1
)
DELETE FROM contact_notes
WHERE id IN (SELECT id FROM notes_to_delete);
