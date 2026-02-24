
-- Step 1: Create missing salesperson records for Vanessa Sandoval (both companies)
INSERT INTO public.salespeople (name, email, ghl_user_id, company_id, is_active)
VALUES 
  ('Vanessa Sandoval', 'lahcdispatch3@gmail.com', '7xgXANv9seqscryAYw4D', 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc', true),
  ('Vanessa Sandoval', 'lahcdispatch3@gmail.com', '7xgXANv9seqscryAYw4D', '00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (name, company_id) DO UPDATE SET ghl_user_id = EXCLUDED.ghl_user_id;

-- Step 2: Create missing salesperson records for Moshe Edri (both companies)
INSERT INTO public.salespeople (name, email, ghl_user_id, company_id, is_active)
VALUES 
  ('Moshe Edri', 'Moshe@lahc-ca.com', 'ixf1yq51OhFXXWnp8d9U', 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc', true),
  ('Moshe Edri', 'Moshe@lahc-ca.com', 'ixf1yq51OhFXXWnp8d9U', '00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (name, company_id) DO UPDATE SET ghl_user_id = EXCLUDED.ghl_user_id;

-- Step 3: Create a function to backfill all GHL IDs to salesperson UUIDs
CREATE OR REPLACE FUNCTION public.backfill_ghl_ids_to_salesperson_uuids()
RETURNS TABLE(opportunities_updated integer, contacts_updated integer, appointments_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opps int := 0;
  v_contacts int := 0;
  v_appts int := 0;
BEGIN
  -- Update opportunities: replace GHL user IDs with salesperson UUIDs
  -- Match by ghl_user_id AND company_id to get the right salesperson per company
  UPDATE opportunities o
  SET assigned_to = s.id::text
  FROM salespeople s
  WHERE s.ghl_user_id = o.assigned_to
    AND s.company_id = o.company_id
    AND o.assigned_to IS NOT NULL
    AND o.assigned_to !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND o.assigned_to != '';
  GET DIAGNOSTICS v_opps = ROW_COUNT;

  -- Update contacts: replace GHL user IDs with salesperson UUIDs
  UPDATE contacts c
  SET assigned_to = s.id::text
  FROM salespeople s
  WHERE s.ghl_user_id = c.assigned_to
    AND s.company_id = c.company_id
    AND c.assigned_to IS NOT NULL
    AND c.assigned_to !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND c.assigned_to != '';
  GET DIAGNOSTICS v_contacts = ROW_COUNT;

  -- Update appointments: replace GHL user IDs with salesperson UUIDs
  UPDATE appointments a
  SET assigned_user_id = s.id::text
  FROM salespeople s
  WHERE s.ghl_user_id = a.assigned_user_id
    AND s.company_id = a.company_id
    AND a.assigned_user_id IS NOT NULL
    AND a.assigned_user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND a.assigned_user_id != '';
  GET DIAGNOSTICS v_appts = ROW_COUNT;

  RETURN QUERY SELECT v_opps, v_contacts, v_appts;
END;
$$;

-- Step 4: Run the backfill
SELECT * FROM public.backfill_ghl_ids_to_salesperson_uuids();
