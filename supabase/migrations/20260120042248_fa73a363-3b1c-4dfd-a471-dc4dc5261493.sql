-- Step 1: Add new columns to company_integrations for vault-based storage
ALTER TABLE public.company_integrations 
ADD COLUMN IF NOT EXISTS api_key_vault_id uuid,
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS sync_error text,
ADD COLUMN IF NOT EXISTS last_sync_started_at timestamptz;

-- Create function to store GHL API key in vault and return the secret ID
CREATE OR REPLACE FUNCTION public.store_ghl_api_key(api_key text, integration_name text DEFAULT 'GHL API Key')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Create function to retrieve decrypted GHL API key from vault
CREATE OR REPLACE FUNCTION public.get_ghl_api_key(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Create function to delete GHL API key from vault
CREATE OR REPLACE FUNCTION public.delete_ghl_api_key(secret_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
  RETURN FOUND;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN public.company_integrations.api_key_vault_id IS 'Reference to encrypted API key in vault.secrets';
COMMENT ON COLUMN public.company_integrations.sync_status IS 'Current sync status: idle, syncing, success, error';
COMMENT ON COLUMN public.company_integrations.sync_error IS 'Last sync error message if any';
COMMENT ON COLUMN public.company_integrations.last_sync_started_at IS 'Timestamp when last sync started';