-- Reverse: set secondary active, primary inactive
UPDATE company_integrations SET is_active = true WHERE id = '74ae93da-ca46-4a5f-868a-a270a3912e3d';
UPDATE company_integrations SET is_active = false WHERE id = 'fc6b0371-6b86-4251-94e0-b349a0fbbb1b';