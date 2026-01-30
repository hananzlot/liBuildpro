-- Create table to store QuickBooks field mappings
CREATE TABLE IF NOT EXISTS public.quickbooks_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- 'invoice', 'payment', 'bill', 'bill_payment'
  local_field TEXT NOT NULL, -- e.g., 'invoice_number', 'amount', etc.
  qb_field TEXT NOT NULL, -- e.g., 'DocNumber', 'TotalAmt', etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, record_type, local_field)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_field_mappings_company ON public.quickbooks_field_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_qb_field_mappings_type ON public.quickbooks_field_mappings(company_id, record_type);

-- Enable RLS
ALTER TABLE public.quickbooks_field_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for field mappings
CREATE POLICY "Users can view their company field mappings"
ON public.quickbooks_field_mappings
FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert their company field mappings"
ON public.quickbooks_field_mappings
FOR INSERT
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update their company field mappings"
ON public.quickbooks_field_mappings
FOR UPDATE
USING (public.has_company_access(company_id));

CREATE POLICY "Users can delete their company field mappings"
ON public.quickbooks_field_mappings
FOR DELETE
USING (public.has_company_access(company_id));

-- Trigger for updated_at
CREATE TRIGGER update_qb_field_mappings_updated_at
BEFORE UPDATE ON public.quickbooks_field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();