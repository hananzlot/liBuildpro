-- Add default markup percent setting for estimates
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'default_markup_percent',
  '50',
  'number',
  'Default markup percentage for new estimates'
)
ON CONFLICT (setting_key) DO NOTHING;