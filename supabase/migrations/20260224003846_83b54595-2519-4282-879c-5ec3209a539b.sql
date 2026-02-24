-- Unlink one invoice from project for testing the remediation flow
-- This is a one-time test data change
UPDATE public.project_invoices 
SET project_id = NULL, qb_customer_name = 'Anthony Santa Ana'
WHERE id = '92d6c19f-1a44-446d-954f-bf14d44339fe';