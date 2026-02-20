
-- Create proper "Alex Van" contact in Demo Co #1
INSERT INTO public.contacts (company_id, location_id, first_name, last_name, contact_name, phone, email, provider, ghl_id)
VALUES (
  'd95f6df1-ef3c-4e12-8743-69c6bfb280bc',
  'mMXD49n5UApITSmKlWdr',
  'Alex',
  'Van',
  'Alex Van',
  '(818) 968-0226',
  'info@caprobuilders.com',
  'local',
  'local_' || gen_random_uuid()::text
);

-- Link the opportunity to the new Alex Van contact
UPDATE public.opportunities
SET contact_uuid = (
  SELECT id FROM public.contacts 
  WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' 
    AND contact_name = 'Alex Van' 
    AND provider = 'local'
  ORDER BY created_at DESC LIMIT 1
)
WHERE id = 'a2347e6b-bc80-4b7b-a6a9-45738cfa8f5b';

-- Link the appointment to the new Alex Van contact
UPDATE public.appointments
SET contact_uuid = (
  SELECT id FROM public.contacts 
  WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' 
    AND contact_name = 'Alex Van' 
    AND provider = 'local'
  ORDER BY created_at DESC LIMIT 1
)
WHERE id = '99c1ef2a-8332-4d76-8d6d-2a8c165a64ff';

-- Also fix the test appointment
UPDATE public.appointments
SET contact_uuid = (
  SELECT id FROM public.contacts 
  WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' 
    AND ghl_id = 'local_' || (
      SELECT ghl_id FROM contacts WHERE id = 'e84a84cd-638c-4155-ab02-6549f0705aaa'
    )
  LIMIT 1
)
WHERE id = '00355c65-2ba4-4d97-8b82-c3d902108115';

-- Simpler: just link test appointment to the existing anthony mccord contact
UPDATE public.appointments
SET contact_uuid = 'e84a84cd-638c-4155-ab02-6549f0705aaa'
WHERE id = '00355c65-2ba4-4d97-8b82-c3d902108115'
  AND contact_uuid IS NULL;
