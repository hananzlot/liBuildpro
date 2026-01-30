-- Drop the admin-only policy and replace with one that allows any company user to manage mappings
DROP POLICY IF EXISTS "Admins can manage their company's QB mappings" ON public.quickbooks_mappings;

-- Allow any authenticated user with company access to manage QB mappings
CREATE POLICY "Users can manage their company's QB mappings"
ON public.quickbooks_mappings
FOR ALL
TO authenticated
USING (has_company_access(company_id))
WITH CHECK (has_company_access(company_id));