-- Add payment focus day setting (default to Friday = 5, where 0=Sunday, 6=Saturday)
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES ('payment_focus_day', '5', 'number', 'Day of week to focus on for AR/AP due dates in sidebar (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)')
ON CONFLICT (setting_key) DO NOTHING;