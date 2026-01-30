-- Add exclude_from_qb flag to all financial tables
ALTER TABLE public.project_invoices 
ADD COLUMN IF NOT EXISTS exclude_from_qb boolean DEFAULT false;

ALTER TABLE public.project_payments 
ADD COLUMN IF NOT EXISTS exclude_from_qb boolean DEFAULT false;

ALTER TABLE public.project_bills 
ADD COLUMN IF NOT EXISTS exclude_from_qb boolean DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_project_invoices_exclude_qb ON public.project_invoices(exclude_from_qb) WHERE exclude_from_qb = false;
CREATE INDEX IF NOT EXISTS idx_project_payments_exclude_qb ON public.project_payments(exclude_from_qb) WHERE exclude_from_qb = false;
CREATE INDEX IF NOT EXISTS idx_project_bills_exclude_qb ON public.project_bills(exclude_from_qb) WHERE exclude_from_qb = false;