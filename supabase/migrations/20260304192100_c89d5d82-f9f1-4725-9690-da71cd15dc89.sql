
-- Create contact for Joel & Anna Cahn (from project data)
DO $$
DECLARE
  v_cahn_contact_id UUID;
  v_shirazi_contact_id UUID;
BEGIN
  -- 1. Create contact for Joel & Anna Cahn
  INSERT INTO public.contacts (
    company_id, location_id, first_name, last_name, contact_name,
    phone, email, provider, ghl_id
  ) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'mMXD49n5UApITSmKlWdr',
    'Joel',
    'Cahn',
    'Joel & Anna Cahn',
    NULL,
    NULL,
    'local',
    'local_backfill_' || gen_random_uuid()::text
  ) RETURNING id INTO v_cahn_contact_id;

  -- Add address custom field to Cahn contact
  UPDATE public.contacts
  SET custom_fields = jsonb_build_array(
    jsonb_build_object('id', 'b7oTVsUQrLgZt84bHpCn', 'value', '904 Rose Ave, Venice, CA 90291')
  )
  WHERE id = v_cahn_contact_id;

  -- 2. Create contact for Alex Shirazi
  INSERT INTO public.contacts (
    company_id, location_id, first_name, last_name, contact_name,
    phone, email, provider, ghl_id
  ) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'mMXD49n5UApITSmKlWdr',
    'Alex',
    'Shirazi',
    'Alex Shirazi',
    '+13109103410',
    '9103410@gmail.com',
    'local',
    'local_backfill_' || gen_random_uuid()::text
  ) RETURNING id INTO v_shirazi_contact_id;

  -- 3. Link opportunities to new contacts
  UPDATE public.opportunities
  SET contact_uuid = v_cahn_contact_id
  WHERE id = '4f64060e-e53d-4ca2-a996-397f793f6206';

  UPDATE public.opportunities
  SET contact_uuid = v_shirazi_contact_id
  WHERE id = 'fad001af-5376-4a0d-bb5e-a38b4521fd5b';

  -- 4. Link projects to new contacts
  UPDATE public.projects
  SET contact_uuid = v_cahn_contact_id
  WHERE id = 'd0555b09-a8ae-4987-853d-7c083b7dc228';

  UPDATE public.projects
  SET contact_uuid = v_shirazi_contact_id
  WHERE id = 'ede590ce-b2ff-4b07-a18b-5b1d3b601ebf';

  RAISE NOTICE 'Created Cahn contact: %, Shirazi contact: %', v_cahn_contact_id, v_shirazi_contact_id;
END $$;
