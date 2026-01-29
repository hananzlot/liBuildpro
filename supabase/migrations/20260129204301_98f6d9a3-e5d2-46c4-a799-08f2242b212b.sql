-- Create QuickBooks mapping configuration table
CREATE TABLE public.quickbooks_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mapping_type TEXT NOT NULL, -- 'income_account', 'expense_account', 'item', 'payment_method'
  source_value TEXT, -- local value (e.g., payment method name, service type)
  qbo_id TEXT NOT NULL, -- QuickBooks entity ID
  qbo_name TEXT NOT NULL, -- QuickBooks entity name for display
  qbo_type TEXT, -- Additional type info (e.g., 'Account', 'Item')
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, mapping_type, source_value)
);

-- Add RLS
ALTER TABLE public.quickbooks_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's QB mappings"
  ON public.quickbooks_mappings FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage their company's QB mappings"
  ON public.quickbooks_mappings FOR ALL
  USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Add company selection field to quickbooks_connections
-- realm_id already stores the QB company ID, add display name
ALTER TABLE public.quickbooks_connections 
  ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Create index for faster lookups
CREATE INDEX idx_quickbooks_mappings_company_type 
  ON public.quickbooks_mappings(company_id, mapping_type);

-- Trigger for updated_at
CREATE TRIGGER update_quickbooks_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();