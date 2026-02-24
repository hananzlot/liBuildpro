
-- Unlink an invoice for testing the invoice linking workflow
UPDATE public.project_invoices 
SET project_id = NULL, qb_customer_name = 'Test Customer - Invoice'
WHERE id = 'a7ae0e2e-c335-4c8f-b91b-80abad331e21';

-- Unlink a payment for testing the payment linking workflow
UPDATE public.project_payments 
SET project_id = NULL
WHERE id = 'cd28b474-1bb2-44b0-b95c-f2852acf801e';
