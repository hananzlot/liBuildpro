-- Create an opportunity for contact "ron clark" who has an orphaned task
INSERT INTO opportunities (
  name,
  contact_id,
  contact_uuid,
  location_id,
  company_id,
  status,
  pipeline_id,
  pipeline_name,
  pipeline_stage_id,
  stage_name,
  monetary_value,
  ghl_date_added,
  provider
) VALUES (
  'Pool replastering - Ron Clark',
  '7xzizldrlmaapMvQTqba',
  '3a2e46f8-a66b-47cb-8cc1-055eb7fbf576',
  'pVeFrqvtYWNIPRIi0Fmr',
  '00000000-0000-0000-0000-000000000002',
  'open',
  '0e565af5-df51-4b97-9365-e1af66e7f400',
  'Vanessa',
  '43fe8e79-7c9c-461b-8fd2-9f8901ce82ff',
  'Follow up',
  0,
  NOW(),
  'manual'
);