-- Drop and recreate the vault helper functions with proper security context
DROP FUNCTION IF EXISTS public.store_ghl_api_key(text, text);
DROP FUNCTION IF EXISTS public.get_ghl_api_key(uuid);
DROP FUNCTION IF EXISTS public.delete_ghl_api_key(uuid);

-- Recreate with proper permissions - must be run by superuser/service role
CREATE OR REPLACE FUNCTION public.store_ghl_api_key(api_key text, integration_name text DEFAULT 'GHL API Key'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
BEGIN
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (api_key, integration_name, 'GHL API Key for company integration')
  RETURNING id INTO secret_id;
  
  RETURN secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ghl_api_key(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  api_key text;
BEGIN
  SELECT decrypted_secret INTO api_key
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  RETURN api_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_ghl_api_key(secret_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.store_ghl_api_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_ghl_api_key(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ghl_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ghl_api_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_ghl_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ghl_api_key(uuid) TO service_role;