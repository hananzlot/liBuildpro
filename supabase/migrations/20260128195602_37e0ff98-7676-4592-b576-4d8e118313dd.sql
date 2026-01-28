-- Function to extract UTM campaign from contact attributions and clean it
CREATE OR REPLACE FUNCTION public.get_scope_from_contact_attributions(p_contact_id text, p_contact_uuid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
DECLARE
  v_attributions jsonb;
  v_utm_campaign text;
  v_cleaned text;
BEGIN
  -- Try to find contact by UUID first, then by ghl_id
  IF p_contact_uuid IS NOT NULL THEN
    SELECT attributions INTO v_attributions
    FROM contacts
    WHERE id = p_contact_uuid;
  END IF;
  
  IF v_attributions IS NULL AND p_contact_id IS NOT NULL THEN
    SELECT attributions INTO v_attributions
    FROM contacts
    WHERE ghl_id = p_contact_id;
  END IF;
  
  IF v_attributions IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Extract utmCampaign from first attribution in array
  IF jsonb_typeof(v_attributions) = 'array' AND jsonb_array_length(v_attributions) > 0 THEN
    v_utm_campaign := v_attributions->0->>'utmCampaign';
  END IF;
  
  IF v_utm_campaign IS NULL OR v_utm_campaign = '' THEN
    RETURN NULL;
  END IF;
  
  -- Clean the campaign name: extract product name before pipe if present
  IF v_utm_campaign LIKE '%|%' THEN
    v_cleaned := trim(split_part(v_utm_campaign, '|', 1));
  ELSE
    -- Remove (Lead Gen) or [Lead Gen] prefix and date prefixes
    v_cleaned := regexp_replace(v_utm_campaign, '^\(Lead Gen\)\s*', '', 'i');
    v_cleaned := regexp_replace(v_cleaned, '^\[Lead Gen\]\s*', '', 'i');
    v_cleaned := regexp_replace(v_cleaned, '^\d{4}/\d{2}/\d{2}\s*', '');
    v_cleaned := regexp_replace(v_cleaned, '^\(Lead Gen\)\s*', '', 'i');
    v_cleaned := regexp_replace(v_cleaned, '^\[Lead Gen\]\s*', '', 'i');
    v_cleaned := trim(v_cleaned);
  END IF;
  
  RETURN NULLIF(v_cleaned, '');
END;
$$;

-- Trigger function to auto-populate scope_of_work from contact attributions
CREATE OR REPLACE FUNCTION public.auto_populate_opportunity_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_scope text;
BEGIN
  -- Only populate if scope_of_work is NULL
  IF NEW.scope_of_work IS NULL THEN
    v_scope := public.get_scope_from_contact_attributions(NEW.contact_id, NEW.contact_uuid);
    IF v_scope IS NOT NULL THEN
      NEW.scope_of_work := v_scope;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on opportunities table
DROP TRIGGER IF EXISTS auto_populate_scope_on_insert ON opportunities;
CREATE TRIGGER auto_populate_scope_on_insert
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_opportunity_scope();

-- Also run on update when scope becomes null or contact changes
DROP TRIGGER IF EXISTS auto_populate_scope_on_update ON opportunities;
CREATE TRIGGER auto_populate_scope_on_update
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  WHEN (NEW.scope_of_work IS NULL AND (OLD.scope_of_work IS NOT NULL OR OLD.contact_id IS DISTINCT FROM NEW.contact_id OR OLD.contact_uuid IS DISTINCT FROM NEW.contact_uuid))
  EXECUTE FUNCTION public.auto_populate_opportunity_scope();

-- Backfill existing opportunities that have null scope_of_work
UPDATE opportunities o
SET scope_of_work = public.get_scope_from_contact_attributions(o.contact_id, o.contact_uuid)
WHERE o.scope_of_work IS NULL
  AND public.get_scope_from_contact_attributions(o.contact_id, o.contact_uuid) IS NOT NULL;