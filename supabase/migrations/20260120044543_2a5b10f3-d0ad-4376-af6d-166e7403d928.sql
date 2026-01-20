-- Ensure pgcrypto is available and referenced correctly
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Fix: pgcrypto functions live in the extensions schema, so schema-qualify encrypt/decrypt
CREATE OR REPLACE FUNCTION public.store_ghl_api_key_encrypted(p_api_key text, p_integration_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.company_integrations
  SET api_key_encrypted = encode(
        extensions.encrypt(p_api_key::bytea, 'ghl_encryption_key_v1'::bytea, 'aes'::text),
        'base64'
      ),
      api_key_vault_id = p_integration_id, -- marks as configured
      updated_at = now()
  WHERE id = p_integration_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ghl_api_key_encrypted(p_integration_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_encrypted text;
BEGIN
  SELECT api_key_encrypted
  INTO v_encrypted
  FROM public.company_integrations
  WHERE id = p_integration_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN convert_from(
    extensions.decrypt(decode(v_encrypted, 'base64'), 'ghl_encryption_key_v1'::bytea, 'aes'::text),
    'UTF8'
  );
END;
$$;

-- Lock down + re-grant execute
REVOKE ALL ON FUNCTION public.store_ghl_api_key_encrypted(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ghl_api_key_encrypted(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.store_ghl_api_key_encrypted(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_ghl_api_key_encrypted(text, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_ghl_api_key_encrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ghl_api_key_encrypted(uuid) TO service_role;