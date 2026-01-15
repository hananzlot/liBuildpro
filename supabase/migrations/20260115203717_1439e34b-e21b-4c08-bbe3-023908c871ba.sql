-- Allow customer portal (anon) to read only company fields from app_settings
DROP POLICY IF EXISTS "Portal can read company settings" ON public.app_settings;

CREATE POLICY "Portal can read company settings"
ON public.app_settings
FOR SELECT
TO anon
USING (setting_key IN ('company_name', 'company_address', 'company_phone'));