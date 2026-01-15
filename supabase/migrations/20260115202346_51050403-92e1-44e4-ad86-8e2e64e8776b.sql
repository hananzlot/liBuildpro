-- Add company address and phone settings if they don't exist
INSERT INTO public.app_settings (setting_key, setting_value, description, setting_type)
VALUES 
  ('company_address', '', 'Company address displayed in portal footer', 'text'),
  ('company_phone', '', 'Company phone number displayed in portal footer', 'text')
ON CONFLICT (setting_key) DO NOTHING;