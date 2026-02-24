-- Add qb_customer_name to project_invoices for unlinked QB invoices
ALTER TABLE public.project_invoices ADD COLUMN IF NOT EXISTS qb_customer_name text;