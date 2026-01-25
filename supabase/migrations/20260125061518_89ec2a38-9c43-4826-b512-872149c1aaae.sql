-- Allow anon to read companies via salesperson portal token
-- This is needed for the portal to display company branding
CREATE POLICY "Anon can read companies via salesperson portal"
ON public.companies
FOR SELECT
TO anon
USING (has_valid_salesperson_portal_token(id));