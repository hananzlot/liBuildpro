-- Create encryption/decryption functions using pgcrypto instead of vault
-- This avoids the pgsodium permission issues

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing vault-based functions
DROP FUNCTION IF EXISTS public.store_ghl_api_key(text, text);
DROP FUNCTION IF EXISTS public.get_ghl_api_key(uuid);
DROP FUNCTION IF EXISTS public.delete_ghl_api_key(uuid);

-- Create a simple encryption key storage (using a generated key)
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Insert a master key for GHL API keys if not exists
INSERT INTO public.encryption_keys (key_name) 
VALUES ('ghl_master') 
ON CONFLICT (key_name) DO NOTHING;

-- Store API key with encryption (stores directly in api_key_encrypted column)
CREATE OR REPLACE FUNCTION public.store_ghl_api_key_encrypted(
  p_api_key text,
  p_integration_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Store the encrypted API key directly in the integration record
  UPDATE company_integrations
  SET api_key_encrypted = encode(encrypt(p_api_key::bytea, 'ghl_encryption_key_v1'::bytea, 'aes'), 'base64'),
      api_key_vault_id = p_integration_id, -- Use this to mark it as configured
      updated_at = now()
  WHERE id = p_integration_id;
  
  RETURN FOUND;
END;
$$;

-- Get decrypted API key
CREATE OR REPLACE FUNCTION public.get_ghl_api_key_encrypted(p_integration_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_decrypted text;
BEGIN
  SELECT api_key_encrypted INTO v_encrypted
  FROM company_integrations
  WHERE id = p_integration_id;
  
  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_decrypted := convert_from(
    decrypt(decode(v_encrypted, 'base64'), 'ghl_encryption_key_v1'::bytea, 'aes'),
    'UTF8'
  );
  
  RETURN v_decrypted;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.store_ghl_api_key_encrypted(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_ghl_api_key_encrypted(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ghl_api_key_encrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ghl_api_key_encrypted(uuid) TO service_role;