-- Migrate app_settings to company_settings for all existing companies
-- This creates a copy of each app_setting for each company

-- Insert settings for CA Pro Builders (primary company)
INSERT INTO company_settings (company_id, setting_key, setting_value, setting_type, description, updated_at)
SELECT 
  '00000000-0000-0000-0000-000000000002'::uuid,
  setting_key,
  setting_value,
  setting_type,
  description,
  updated_at
FROM app_settings
WHERE setting_key NOT IN (
  SELECT setting_key FROM company_settings 
  WHERE company_id = '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (company_id, setting_key) DO NOTHING;

-- Insert settings for test1 company with default values
INSERT INTO company_settings (company_id, setting_key, setting_value, setting_type, description, updated_at)
SELECT 
  '84fea605-ba30-458f-a17d-d2083eb3ec34'::uuid,
  setting_key,
  setting_value,
  setting_type,
  description,
  updated_at
FROM app_settings
WHERE setting_key NOT IN (
  SELECT setting_key FROM company_settings 
  WHERE company_id = '84fea605-ba30-458f-a17d-d2083eb3ec34'
)
ON CONFLICT (company_id, setting_key) DO NOTHING;