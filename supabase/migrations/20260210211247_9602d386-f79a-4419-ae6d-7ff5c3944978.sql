-- Link orphaned bill_payments to correct banks by matching bank_name patterns
-- Chase / PLAT BUS CHECKING -> Chase bank
UPDATE bill_payments
SET bank_id = '5f69f957-08c9-4440-9c82-e1700e43d7fb',
    bank_name = 'Chase'
WHERE bank_id IS NULL
  AND (bank_name ILIKE '%PLAT BUS%' OR bank_name = 'Chase');

-- First Bank -> First Bank
UPDATE bill_payments
SET bank_id = '0cd96daf-9728-4c6a-b22d-ba01347bc21a',
    bank_name = 'First Bank'
WHERE bank_id IS NULL
  AND bank_name ILIKE '%First Bank%';

-- Also resolve any pending_refresh sync logs by marking them as synced
UPDATE quickbooks_sync_log
SET sync_status = 'synced',
    sync_error = NULL,
    updated_at = now()
WHERE sync_status = 'pending_refresh'
  AND record_type = 'bill_payment';