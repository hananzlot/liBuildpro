-- Drop the overly permissive policy on client_portal_tokens
DROP POLICY IF EXISTS "Public can read tokens by token value" ON public.client_portal_tokens;

-- Create a secure security definer function for token validation
-- This function safely validates and returns token data without exposing all tokens
CREATE OR REPLACE FUNCTION public.validate_portal_token(p_token text)
RETURNS TABLE (
  id uuid,
  token text,
  project_id uuid,
  estimate_id uuid,
  client_name text,
  client_email text,
  company_id uuid,
  is_active boolean,
  expires_at timestamptz,
  created_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, token, project_id, estimate_id, client_name, client_email,
    company_id, is_active, expires_at, created_at, last_accessed_at,
    access_count, created_by
  FROM client_portal_tokens
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

-- Grant execute permission to public (anonymous users)
GRANT EXECUTE ON FUNCTION public.validate_portal_token(text) TO public;
GRANT EXECUTE ON FUNCTION public.validate_portal_token(text) TO anon;

-- Keep authenticated access for company users
CREATE POLICY "Authenticated users view company tokens"
ON public.client_portal_tokens
FOR SELECT
TO authenticated
USING (has_company_access(company_id));