
-- Fix cross-company payment linkage: re-link Demo Co #1's payment to Demo Co #1's invoice
UPDATE public.project_payments 
SET invoice_id = '06b6687c-d76e-43ac-8f63-a291f7f3c3a4'
WHERE id = 'b9adb32b-7a5f-4382-8588-075e6374dbfd'
  AND company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
  AND invoice_id = '9265fe23-f957-4645-bb9f-aa0c4a0dba19';

-- The update_invoice_payment_totals trigger will automatically recalculate:
-- 1. CA Pro Builders' invoice 9265fe23: payments_received should drop from $24,000 to $12,000
-- 2. Demo Co #1's invoice 06b6687c: payments_received should stay at $12,000 (already correct from other payment)
