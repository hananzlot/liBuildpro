-- Add License Holder Name setting
INSERT INTO public.app_settings (setting_key, setting_value, description, setting_type)
VALUES ('license_holder_name', '', 'Name of the license holder', 'text')
ON CONFLICT (setting_key) DO NOTHING;