-- Function to backfill contact addresses from linked project records
CREATE OR REPLACE FUNCTION public.backfill_contact_addresses_from_projects()
RETURNS TABLE(contacts_updated int, opportunities_updated int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contacts_updated int := 0;
  v_opportunities_updated int := 0;
  v_address_field_id text := 'b7oTVsUQrLgZt84bHpCn';
  rec RECORD;
BEGIN
  -- Update contacts that have no address in custom_fields but have a linked project with address
  FOR rec IN 
    SELECT DISTINCT ON (c.id)
      c.id as contact_id,
      c.custom_fields,
      p.project_address
    FROM contacts c
    INNER JOIN projects p ON (
      p.contact_uuid = c.id 
      OR p.contact_id = c.ghl_id
    )
    WHERE p.project_address IS NOT NULL 
      AND p.project_address != ''
      AND p.deleted_at IS NULL
      AND (
        -- No custom_fields at all
        c.custom_fields IS NULL
        -- Or empty array
        OR c.custom_fields::text = '[]'
        -- Or doesn't contain the address field
        OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(c.custom_fields::jsonb) = 'array' 
            THEN c.custom_fields::jsonb 
            ELSE '[]'::jsonb END
          ) elem
          WHERE elem->>'id' = v_address_field_id 
            AND elem->>'value' IS NOT NULL 
            AND elem->>'value' != ''
        )
      )
    ORDER BY c.id, p.created_at DESC
  LOOP
    -- Build new custom_fields with address
    UPDATE contacts
    SET custom_fields = CASE
      WHEN custom_fields IS NULL OR custom_fields::text = '[]' OR custom_fields::text = 'null' THEN
        jsonb_build_array(jsonb_build_object('id', v_address_field_id, 'value', rec.project_address))
      ELSE
        -- Append to existing array (remove old address field first if exists)
        (
          SELECT jsonb_agg(elem) || jsonb_build_array(jsonb_build_object('id', v_address_field_id, 'value', rec.project_address))
          FROM jsonb_array_elements(custom_fields::jsonb) elem
          WHERE elem->>'id' != v_address_field_id
        )
    END
    WHERE id = rec.contact_id;
    
    v_contacts_updated := v_contacts_updated + 1;
  END LOOP;

  -- Update opportunities that have null/empty address but have a linked project with address
  -- First check if opportunities has an address column, if not just skip
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'opportunities' 
    AND column_name = 'address'
  ) THEN
    UPDATE opportunities o
    SET address = p.project_address
    FROM projects p
    WHERE (p.opportunity_uuid = o.id OR p.opportunity_id = o.ghl_id)
      AND p.project_address IS NOT NULL 
      AND p.project_address != ''
      AND p.deleted_at IS NULL
      AND (o.address IS NULL OR o.address = '');
    
    GET DIAGNOSTICS v_opportunities_updated = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_contacts_updated, v_opportunities_updated;
END;
$$;

-- Run the backfill immediately
SELECT * FROM public.backfill_contact_addresses_from_projects();