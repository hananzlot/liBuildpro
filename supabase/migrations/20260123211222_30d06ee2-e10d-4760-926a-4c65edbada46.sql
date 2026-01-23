-- Create opportunity for Danielle Koch
INSERT INTO opportunities (
  id,
  ghl_id,
  name,
  contact_id,
  contact_uuid,
  status,
  stage_name,
  pipeline_name,
  company_id,
  location_id
) VALUES (
  gen_random_uuid(),
  'local_' || gen_random_uuid()::text,
  'Danielle Koch - Aviator Nation Office Remodel',
  'VmFylzFvh6h6WFKPL7cm',
  '7b8e7858-d520-4df9-95ba-84e2d343c973',
  'open',
  'Estimate Prepared',
  'Sales Pipeline',
  '00000000-0000-0000-0000-000000000002',
  'pVeFrqvtYWNIPRIi0Fmr'
)
RETURNING id, ghl_id;