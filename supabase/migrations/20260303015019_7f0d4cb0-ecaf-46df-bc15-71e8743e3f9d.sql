INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES ('resend_api_key', NULL, 'secret', 'Platform Resend API key used for all email sending. Managed via Super Admin → App Default Settings.')
ON CONFLICT (setting_key) DO NOTHING;