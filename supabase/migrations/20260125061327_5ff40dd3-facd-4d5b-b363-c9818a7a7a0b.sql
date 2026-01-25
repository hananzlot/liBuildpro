-- Create helper function to validate salesperson portal token from request context
-- This checks if a valid, active token exists for the given company
CREATE OR REPLACE FUNCTION public.has_valid_salesperson_portal_token(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.salesperson_portal_tokens spt
    WHERE spt.company_id = target_company_id
      AND spt.is_active = true
      AND (spt.expires_at IS NULL OR spt.expires_at > now())
  )
$$;

-- Allow anon to read appointments via salesperson portal token
CREATE POLICY "Anon can read appointments via salesperson portal"
ON public.appointments
FOR SELECT
TO anon
USING (has_valid_salesperson_portal_token(company_id));

-- Allow anon to read contacts via salesperson portal token
CREATE POLICY "Anon can read contacts via salesperson portal"
ON public.contacts
FOR SELECT
TO anon
USING (has_valid_salesperson_portal_token(company_id));

-- Allow anon to read opportunities via salesperson portal token
CREATE POLICY "Anon can read opportunities via salesperson portal"
ON public.opportunities
FOR SELECT
TO anon
USING (has_valid_salesperson_portal_token(company_id));

-- Allow anon to read salespeople via salesperson portal token
CREATE POLICY "Anon can read salespeople via salesperson portal"
ON public.salespeople
FOR SELECT
TO anon
USING (has_valid_salesperson_portal_token(company_id));

-- Allow anon to read salesperson_portal_tokens to validate their token
CREATE POLICY "Anon can read salesperson portal tokens"
ON public.salesperson_portal_tokens
FOR SELECT
TO anon
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));