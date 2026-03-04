-- Fix: Joel & Anna Cahn belongs to CA Pro Builders, not Demo Co #1
-- 1. Delete the Demo Co #1 project and opportunity
DELETE FROM projects WHERE id = '753a1dd4-35c5-4f05-aef9-21d2f4a77d8e';
DELETE FROM opportunities WHERE id = 'f7ecf59f-2714-4087-9a56-d7e3cb0874b9';
DELETE FROM contacts WHERE id = '46394a2f-1bb7-4b08-9850-19c3213ece2e';

-- 2. Re-create the opportunity and project in CA Pro Builders
INSERT INTO opportunities (id, ghl_id, location_id, name, monetary_value, status, pipeline_name, stage_name, provider, company_id, address, created_at, updated_at, last_synced_at)
VALUES (
  gen_random_uuid(),
  'local_opp_cahn_' || gen_random_uuid(),
  'mMXD49n5UApITSmKlWdr',
  'Joel & Anna Cahn',
  26800.00,
  'won',
  'Main',
  'Won',
  'local',
  '00000000-0000-0000-0000-000000000002',
  '904 Rose Ave, Venice, CA 90291',
  now(), now(), now()
);