-- Add bank_id columns to project_payments and bill_payments
-- These will reference the banks table for normalized lookups

-- Add bank_id to project_payments
ALTER TABLE public.project_payments
ADD COLUMN bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;

-- Add bank_id to bill_payments  
ALTER TABLE public.bill_payments
ADD COLUMN bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;

-- Backfill existing records: match bank_name text to banks.name
UPDATE public.project_payments pp
SET bank_id = b.id
FROM public.banks b
WHERE pp.bank_name = b.name
  AND pp.company_id = b.company_id
  AND pp.bank_id IS NULL;

UPDATE public.bill_payments bp
SET bank_id = b.id
FROM public.banks b
WHERE bp.bank_name = b.name
  AND bp.company_id = b.company_id
  AND bp.bank_id IS NULL;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_project_payments_bank_id ON public.project_payments(bank_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bank_id ON public.bill_payments(bank_id);