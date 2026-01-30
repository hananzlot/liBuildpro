-- Backfill: Set auto_sync_to_quickbooks = true for all projects whose contact is mapped to a QuickBooks customer
UPDATE public.projects p
SET auto_sync_to_quickbooks = true
WHERE auto_sync_to_quickbooks = false
  AND (
    -- Match by contact_uuid
    EXISTS (
      SELECT 1 FROM public.quickbooks_mappings qm
      WHERE qm.mapping_type = 'customer'
        AND qm.source_value = p.contact_uuid::text
        AND qm.company_id = p.company_id
    )
    OR
    -- Match by contact_id (legacy GHL ID)
    EXISTS (
      SELECT 1 FROM public.quickbooks_mappings qm
      WHERE qm.mapping_type = 'customer'
        AND qm.source_value = p.contact_id
        AND qm.company_id = p.company_id
    )
  );

-- Create trigger function to auto-enable sync when customer is mapped
CREATE OR REPLACE FUNCTION public.auto_enable_qb_sync_on_customer_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process customer mappings
  IF NEW.mapping_type = 'customer' THEN
    -- Update all projects linked to this contact to enable auto sync
    UPDATE public.projects
    SET auto_sync_to_quickbooks = true
    WHERE company_id = NEW.company_id
      AND auto_sync_to_quickbooks = false
      AND (
        contact_uuid::text = NEW.source_value
        OR contact_id = NEW.source_value
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on quickbooks_mappings table
DROP TRIGGER IF EXISTS trigger_auto_enable_qb_sync_on_customer_mapping ON public.quickbooks_mappings;
CREATE TRIGGER trigger_auto_enable_qb_sync_on_customer_mapping
  AFTER INSERT ON public.quickbooks_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enable_qb_sync_on_customer_mapping();