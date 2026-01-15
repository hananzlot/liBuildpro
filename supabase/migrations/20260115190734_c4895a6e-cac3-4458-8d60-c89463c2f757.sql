-- Add column to link material/equipment bills to subcontractor bills for offset tracking
ALTER TABLE public.project_bills 
ADD COLUMN IF NOT EXISTS offset_bill_id uuid REFERENCES public.project_bills(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_project_bills_offset_bill_id ON public.project_bills(offset_bill_id);

-- Add a comment to explain the purpose
COMMENT ON COLUMN public.project_bills.offset_bill_id IS 'Links a material/equipment bill to a subcontractor bill, reducing the subcontractor balance by this bill amount';