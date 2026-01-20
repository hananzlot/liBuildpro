-- Insert GHL integrations for both locations (without vault keys - those will be added via UI)
INSERT INTO company_integrations (company_id, provider, location_id, name, is_active, is_primary)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'ghl', 'pVeFrqvtYWNIPRIi0Fmr', 'CA Pro Builders - Primary', true, true),
  ('00000000-0000-0000-0000-000000000002', 'ghl', 'XYDIgpHivVWHii65sId5', 'CA Pro Builders - Secondary', true, false)
ON CONFLICT DO NOTHING;