-- Add portal upload limit and company website settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('portal_upload_limit_mb', '15', 'number', 'Maximum file upload size in MB for customer portal'),
  ('company_website', '', 'text', 'Company website URL for portal footer')
ON CONFLICT (setting_key) DO NOTHING;