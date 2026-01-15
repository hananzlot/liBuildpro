-- Add company logo setting
INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES ('company_logo_url', NULL, 'text', 'Company logo URL - displayed in portal, emails, and favicon')
ON CONFLICT (setting_key) DO NOTHING;