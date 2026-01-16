-- Add app_base_url setting for configurable portal URLs
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'app_base_url', 
  'https://crm.ca-probuilders.com', 
  'text',
  'Base URL for all portal links sent in emails (e.g., https://crm.ca-probuilders.com)'
)
ON CONFLICT (setting_key) DO NOTHING;