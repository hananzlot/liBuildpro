-- Re-link the wrong-company invoice back
UPDATE public.project_invoices 
SET project_id = 'f7b421f1-b980-4f2c-8244-a3f13de14421', qb_customer_name = NULL
WHERE id = '92d6c19f-1a44-446d-954f-bf14d44339fe';

-- Unlink the correct invoice in the user's company for testing
UPDATE public.project_invoices 
SET project_id = NULL, qb_customer_name = 'Anthony Santa Ana'
WHERE id = 'fb791b97-7067-4965-9a42-ae17c8a95e1f';