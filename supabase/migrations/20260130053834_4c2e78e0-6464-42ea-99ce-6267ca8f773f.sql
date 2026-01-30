-- Create a function to bulk delete junk contacts, skipping those with FK violations
CREATE OR REPLACE FUNCTION public.bulk_delete_junk_contacts(
  p_company_id uuid,
  p_contact_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
  v_skipped integer := 0;
  v_contact_id uuid;
BEGIN
  -- First try bulk delete - this will fail if any FK constraints exist
  -- So we use a different approach: delete all that CAN be deleted
  
  -- Create a temp table of contacts to delete that aren't referenced anywhere
  CREATE TEMP TABLE IF NOT EXISTS contacts_to_delete AS
  SELECT unnest(p_contact_ids) AS id;
  
  -- Remove contacts that are referenced in projects
  DELETE FROM contacts_to_delete 
  WHERE id IN (
    SELECT contact_uuid FROM projects 
    WHERE company_id = p_company_id AND contact_uuid IS NOT NULL
  );
  
  -- Remove contacts that are referenced in opportunities
  DELETE FROM contacts_to_delete 
  WHERE id IN (
    SELECT contact_uuid FROM opportunities 
    WHERE company_id = p_company_id AND contact_uuid IS NOT NULL
  );
  
  -- Remove contacts that are referenced in appointments
  DELETE FROM contacts_to_delete 
  WHERE id IN (
    SELECT contact_uuid FROM appointments 
    WHERE company_id = p_company_id AND contact_uuid IS NOT NULL
  );
  
  -- Remove contacts that are referenced in contact_notes
  DELETE FROM contacts_to_delete 
  WHERE id IN (
    SELECT contact_uuid FROM contact_notes 
    WHERE company_id = p_company_id AND contact_uuid IS NOT NULL
  );
  
  -- Remove contacts that are referenced in estimates
  DELETE FROM contacts_to_delete 
  WHERE id IN (
    SELECT contact_uuid FROM estimates 
    WHERE company_id = p_company_id AND contact_uuid IS NOT NULL
  );
  
  -- Count how many we're about to delete vs skip
  SELECT COUNT(*) INTO v_deleted FROM contacts_to_delete;
  v_skipped := array_length(p_contact_ids, 1) - v_deleted;
  
  -- Bulk delete all remaining contacts
  DELETE FROM contacts 
  WHERE id IN (SELECT id FROM contacts_to_delete)
    AND company_id = p_company_id;
  
  -- Get actual deleted count
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Cleanup
  DROP TABLE IF EXISTS contacts_to_delete;
  
  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'skipped', v_skipped
  );
END;
$$;