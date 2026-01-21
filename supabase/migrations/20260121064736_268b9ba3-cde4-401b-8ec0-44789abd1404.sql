-- Insert platform email settings into app_settings
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('platform_resend_from_email', NULL, 'string', 'Default sender email for platform auth emails (e.g., noreply@yourdomain.com)'),
  ('platform_resend_from_name', NULL, 'string', 'Default sender name for platform auth emails (e.g., YourApp)'),
  ('platform_support_email', NULL, 'string', 'Support email shown in auth email footers'),
  ('platform_logo_url', NULL, 'string', 'Logo URL for auth email branding'),
  ('platform_auth_emails_enabled', 'false', 'boolean', 'Enable/disable custom Resend auth emails')
ON CONFLICT (setting_key) DO NOTHING;