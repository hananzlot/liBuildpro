-- 1. Update the anonymous branding policy to include compliance_package_enabled
DROP POLICY IF EXISTS "Anonymous can view public branding settings" ON public.company_settings;

CREATE POLICY "Anonymous can view public branding settings"
ON public.company_settings
FOR SELECT
TO anon
USING (
  setting_key = ANY (ARRAY[
    'company_name'::text,
    'company_logo_url'::text,
    'company_address'::text,
    'company_phone'::text,
    'company_website'::text,
    'portal_upload_limit_mb'::text,
    'compliance_package_enabled'::text
  ])
);

-- 2. Create a helper function to check if a valid portal token exists for a company
CREATE OR REPLACE FUNCTION public.has_valid_portal_token_for_company(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    WHERE cpt.company_id = target_company_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
$$;

-- 3. Add policy for anonymous users to view active compliance templates (for fallback check)
CREATE POLICY "Portal visitors can view active compliance templates"
ON public.compliance_document_templates
FOR SELECT
TO anon
USING (
  is_active = true
  AND public.has_valid_portal_token_for_company(company_id)
);