-- Allow anonymous portal users to read public branding settings
-- These are non-sensitive keys needed for portal display
CREATE POLICY "Anonymous can view public branding settings"
ON public.company_settings FOR SELECT TO anon
USING (
  setting_key IN (
    'company_name', 
    'company_logo_url', 
    'company_address', 
    'company_phone', 
    'company_website',
    'portal_upload_limit_mb'
  )
);