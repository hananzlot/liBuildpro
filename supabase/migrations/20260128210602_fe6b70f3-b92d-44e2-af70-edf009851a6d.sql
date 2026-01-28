-- Backfill all existing payments to mark deposit as verified
UPDATE project_payments 
SET deposit_verified = true 
WHERE deposit_verified IS NULL OR deposit_verified = false;