
-- Create archived salesperson for orphaned GHL ID gToMOIfmTtB7uebO3G6Y
-- This GHL ID is assigned to 4 opportunities but has no matching user record
INSERT INTO salespeople (name, ghl_user_id, company_id, is_active)
VALUES ('Unknown (Legacy GHL User)', 'gToMOIfmTtB7uebO3G6Y', '00000000-0000-0000-0000-000000000002', false);
