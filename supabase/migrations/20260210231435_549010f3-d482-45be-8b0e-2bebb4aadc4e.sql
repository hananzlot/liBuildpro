-- Delete the sync log entry for bill "CO - Framing & Addition" so duplicate detection triggers on next save
DELETE FROM quickbooks_sync_log WHERE id = '8f9fe4e7-8f7f-4adc-91bc-74aeb192c814';