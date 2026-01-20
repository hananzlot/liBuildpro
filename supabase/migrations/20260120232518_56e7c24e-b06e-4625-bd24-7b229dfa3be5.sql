-- Backfill missing company_id on contact_notes from their associated contacts
UPDATE contact_notes
SET company_id = contacts.company_id
FROM contacts
WHERE contact_notes.contact_id = contacts.ghl_id
  AND contact_notes.company_id IS NULL
  AND contacts.company_id IS NOT NULL