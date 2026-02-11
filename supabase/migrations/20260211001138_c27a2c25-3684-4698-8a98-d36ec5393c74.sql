UPDATE quickbooks_sync_log 
SET sync_status = 'synced', sync_error = NULL, synced_at = now()
WHERE id IN ('72772b12-6211-472b-b7e4-96201a259c61', '20763da5-d97e-4849-8c87-c8a1289d97f8')
AND sync_status = 'pending_refresh';