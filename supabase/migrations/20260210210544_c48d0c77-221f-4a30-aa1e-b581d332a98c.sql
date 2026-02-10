-- Backfill bill_payments.bank_name to match the current banks.name for all records with a bank_id
UPDATE bill_payments
SET bank_name = b.name
FROM banks b
WHERE bill_payments.bank_id = b.id
  AND bill_payments.bank_name IS DISTINCT FROM b.name;