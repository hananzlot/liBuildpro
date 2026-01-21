-- Update estimates missing terms & conditions with their company's default terms
UPDATE estimates 
SET terms_and_conditions = cs.setting_value
FROM company_settings cs
WHERE estimates.company_id = cs.company_id 
  AND cs.setting_key = 'default_terms_and_conditions'
  AND estimates.status IN ('sent', 'viewed', 'accepted', 'declined')
  AND (estimates.terms_and_conditions IS NULL OR estimates.terms_and_conditions = '');

-- Clear notes from all sent/active proposals (notes are now internal-only)
UPDATE estimates 
SET notes = NULL
WHERE status IN ('sent', 'viewed', 'accepted', 'declined')
  AND notes IS NOT NULL;