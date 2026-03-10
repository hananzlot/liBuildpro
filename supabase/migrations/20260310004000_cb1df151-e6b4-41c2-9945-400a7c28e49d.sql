-- Fix invoices with open_balance = 0 despite having no payments
-- This is a data integrity fix for invoices created through handleInvoiceConfirm
-- which was missing open_balance, total_expected, and payments_received fields
UPDATE project_invoices 
SET open_balance = amount,
    total_expected = COALESCE(total_expected, amount),
    payments_received = COALESCE(payments_received, 0)
WHERE (open_balance IS NULL OR open_balance = 0)
  AND (payments_received IS NULL OR payments_received = 0)
  AND amount > 0
  AND (invoice_number IS NULL OR invoice_number NOT LIKE 'DELETED-%');