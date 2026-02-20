
-- Create contacts in Demo Co #1 for orphaned opportunities that reference CA Pro Builders contacts
-- and set the contact_uuid on the opportunities

-- Step 1: Create new contacts in Demo Co #1 by copying from CA Pro Builders contacts
INSERT INTO public.contacts (company_id, location_id, first_name, last_name, contact_name, email, phone, source, custom_fields, provider, ghl_id)
SELECT 
  'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'::uuid as company_id,
  c.location_id,
  c.first_name,
  c.last_name,
  COALESCE(c.contact_name, NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '')),
  c.email,
  c.phone,
  c.source,
  c.custom_fields,
  'local',
  'local_' || gen_random_uuid()::text
FROM opportunities o
JOIN contacts c ON c.ghl_id = o.contact_id AND c.company_id = '00000000-0000-0000-0000-000000000002'
WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
  AND o.contact_uuid IS NULL;

-- Step 2: Link the opportunities to the newly created contacts by matching name+email+phone
UPDATE public.opportunities o
SET contact_uuid = new_c.id
FROM contacts c_old, contacts new_c
WHERE c_old.ghl_id = o.contact_id
  AND c_old.company_id = '00000000-0000-0000-0000-000000000002'
  AND new_c.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
  AND new_c.provider = 'local'
  AND o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
  AND o.contact_uuid IS NULL
  -- Match by phone (most reliable) or email
  AND (
    (new_c.phone IS NOT NULL AND new_c.phone = c_old.phone)
    OR (new_c.email IS NOT NULL AND new_c.email = c_old.email)
    OR (new_c.contact_name IS NOT NULL AND new_c.contact_name = COALESCE(c_old.contact_name, NULLIF(TRIM(COALESCE(c_old.first_name, '') || ' ' || COALESCE(c_old.last_name, '')), '')))
  );
