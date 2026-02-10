
-- Step 1: Delete the non-synced payment (fdadbd4c)
DELETE FROM bill_payments WHERE id = 'fdadbd4c-d3d2-4fb7-8d33-21470fbe2f31';

-- Step 2: Re-insert the QB-synced payment with original data from audit log
INSERT INTO bill_payments (id, bill_id, payment_amount, payment_date, payment_method, payment_reference, bank_name, company_id, created_at, updated_at)
VALUES (
  '900b76ba-c460-4f20-856f-b115284f4e60',
  '70f08628-aa35-4cf4-8e5b-059f7827aab0',
  7000,
  '2026-02-06',
  'check',
  '50040',
  'PLAT BUS CHECKING (8981) - 1',
  '00000000-0000-0000-0000-000000000002',
  '2026-02-04T17:13:57.212276+00:00',
  now()
);

-- Step 3: Restore the sync log entry back to synced
UPDATE quickbooks_sync_log
SET sync_status = 'synced', synced_at = now()
WHERE record_id = '900b76ba-c460-4f20-856f-b115284f4e60'
AND record_type = 'bill_payment';
