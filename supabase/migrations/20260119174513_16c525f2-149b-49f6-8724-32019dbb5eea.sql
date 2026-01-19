-- Add License Number and License Type settings
INSERT INTO public.app_settings (setting_key, setting_value, description, setting_type)
VALUES 
  ('license_number', '', 'Company license number', 'text'),
  ('license_type', '', 'Type of license held by the company', 'text')
ON CONFLICT (setting_key) DO NOTHING;