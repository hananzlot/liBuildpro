-- Add GHL integration enabled setting
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'ghl_integration_enabled',
  'true',
  'boolean',
  'Enable or disable GoHighLevel integration. When disabled, the app works in local-only mode.'
)
ON CONFLICT (setting_key) DO NOTHING;