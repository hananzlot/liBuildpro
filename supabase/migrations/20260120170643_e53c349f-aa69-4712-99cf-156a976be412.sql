
-- Update Ron Clark's opportunity created date to match oldest contact note
UPDATE opportunities 
SET ghl_date_added = '2025-10-13 18:37:17.29+00',
    created_at = '2025-10-13 18:37:17.29+00'
WHERE contact_id = '7xzizldrlmaapMvQTqba'
  AND name = 'Pool replastering - Ron Clark';
