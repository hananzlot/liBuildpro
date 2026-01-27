-- Add default setting for estimate plans max file size
INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'estimate_plans_max_size_mb',
  '50',
  'number',
  'Maximum file size in MB for estimate plan uploads (default 50MB, max 100MB)'
)
ON CONFLICT (setting_key) DO NOTHING;