-- Add original_bill_amount column to store the original amount before any offsets are applied
ALTER TABLE public.project_bills 
ADD COLUMN IF NOT EXISTS original_bill_amount numeric;

COMMENT ON COLUMN public.project_bills.original_bill_amount IS 'Stores the original bill amount before offsets were applied. Only populated when a subcontractor bill has been offset by material/equipment bills.';