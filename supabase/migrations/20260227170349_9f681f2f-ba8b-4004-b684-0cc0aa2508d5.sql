
-- Bulk fix: Re-link all 84 Demo Co #1 payments from CA Pro Builders' invoices to Demo Co #1's matching invoices
UPDATE public.project_payments pp
SET invoice_id = pi_target.id
FROM project_invoices pi_source
JOIN project_invoices pi_target 
  ON pi_target.invoice_number = pi_source.invoice_number 
  AND pi_target.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
WHERE pp.invoice_id = pi_source.id
  AND pi_source.company_id = '00000000-0000-0000-0000-000000000002'
  AND pp.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc';
