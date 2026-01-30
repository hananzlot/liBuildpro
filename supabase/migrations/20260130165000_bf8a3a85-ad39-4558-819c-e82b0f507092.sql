-- Add default expense account fields to vendor mappings
ALTER TABLE public.quickbooks_mappings 
ADD COLUMN IF NOT EXISTS default_expense_account_id text,
ADD COLUMN IF NOT EXISTS default_expense_account_name text;

-- Add comment for documentation
COMMENT ON COLUMN public.quickbooks_mappings.default_expense_account_id IS 'Default G/L expense account ID for vendor mappings';
COMMENT ON COLUMN public.quickbooks_mappings.default_expense_account_name IS 'Default G/L expense account name for vendor mappings';