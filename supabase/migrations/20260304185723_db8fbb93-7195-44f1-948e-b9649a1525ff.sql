INSERT INTO projects (id, project_name, opportunity_uuid, company_id, project_status, sold_dispatch_value, project_address, location_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Joel & Anna Cahn',
  '4f64060e-e53d-4ca2-a996-397f793f6206',
  '00000000-0000-0000-0000-000000000002',
  'Active',
  26800.00,
  '904 Rose Ave, Venice, CA 90291',
  'mMXD49n5UApITSmKlWdr',
  now(), now()
);