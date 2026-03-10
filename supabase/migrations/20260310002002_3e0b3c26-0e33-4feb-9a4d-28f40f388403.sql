INSERT INTO company_settings (company_id, setting_key, setting_value, setting_type, description)
SELECT cs.company_id, 'company_email', '', 'text', 'Company email address displayed on invoices and documents'
FROM company_settings cs
WHERE cs.setting_key = 'company_phone'
AND NOT EXISTS (
  SELECT 1 FROM company_settings cs2 
  WHERE cs2.company_id = cs.company_id AND cs2.setting_key = 'company_email'
)