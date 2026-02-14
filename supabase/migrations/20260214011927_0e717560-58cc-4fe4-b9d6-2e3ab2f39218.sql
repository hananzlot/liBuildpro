
-- Drop the existing anonymous policy and recreate with social links included
DROP POLICY IF EXISTS "Anonymous can view public branding settings" ON public.company_settings;

CREATE POLICY "Anonymous can view public branding settings"
ON public.company_settings
FOR SELECT
TO anon
USING (
  setting_key IN (
    'company_name',
    'company_logo_url',
    'company_address',
    'company_phone',
    'company_website',
    'portal_upload_limit_mb',
    'compliance_package_enabled',
    'company_header_bg_color'
  )
  OR setting_key LIKE 'social_%'
  OR setting_key LIKE 'license_cert_%'
  OR setting_key LIKE 'insurance_doc_%'
);
