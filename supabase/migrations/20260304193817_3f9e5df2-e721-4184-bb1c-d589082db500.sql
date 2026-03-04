-- One-time data fix: Mark Veronica Foreman's estimate as accepted
UPDATE estimates 
SET status = 'accepted', signed_at = '2026-02-27' 
WHERE id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a' 
  AND status = 'sent';