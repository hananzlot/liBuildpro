-- Drop the existing policy and create a new one with the additional settings
DROP POLICY IF EXISTS "Portal can read company settings" ON public.app_settings;

CREATE POLICY "Portal can read company settings"
ON public.app_settings
FOR SELECT
TO anon
USING (setting_key IN ('company_name', 'company_address', 'company_phone', 'company_website', 'company_logo_url', 'portal_upload_limit_mb'));