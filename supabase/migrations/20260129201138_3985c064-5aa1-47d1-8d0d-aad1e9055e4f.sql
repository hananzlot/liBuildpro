-- Create QuickBooks connections table for per-company OAuth tokens
CREATE TABLE public.quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL, -- QuickBooks company ID
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  connected_by UUID REFERENCES public.profiles(id),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company QB connection"
ON public.quickbooks_connections FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage QB connections"
ON public.quickbooks_connections FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Create sync log table for tracking what's been synced
CREATE TABLE public.quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- 'invoice', 'payment', 'bill', 'bill_payment'
  record_id UUID NOT NULL,
  quickbooks_id TEXT, -- ID in QuickBooks
  sync_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  sync_error TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, record_type, record_id)
);

-- Enable RLS
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company sync logs"
ON public.quickbooks_sync_log FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "System can manage sync logs"
ON public.quickbooks_sync_log FOR ALL
TO authenticated
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

-- Helper function to store QuickBooks tokens (encrypted)
CREATE OR REPLACE FUNCTION public.store_quickbooks_tokens(
  p_company_id UUID,
  p_realm_id TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Get the company's encryption key
  v_encryption_key := public.get_company_encryption_key(p_company_id);

  -- Upsert the connection with encrypted tokens
  INSERT INTO public.quickbooks_connections (
    company_id,
    realm_id,
    access_token_encrypted,
    refresh_token_encrypted,
    token_expires_at,
    connected_at,
    connected_by,
    is_active
  ) VALUES (
    p_company_id,
    p_realm_id,
    encode(extensions.encrypt(p_access_token::bytea, decode(v_encryption_key, 'hex'), 'aes'), 'base64'),
    encode(extensions.encrypt(p_refresh_token::bytea, decode(v_encryption_key, 'hex'), 'aes'), 'base64'),
    p_expires_at,
    now(),
    auth.uid(),
    true
  )
  ON CONFLICT (company_id) DO UPDATE SET
    realm_id = p_realm_id,
    access_token_encrypted = encode(extensions.encrypt(p_access_token::bytea, decode(v_encryption_key, 'hex'), 'aes'), 'base64'),
    refresh_token_encrypted = encode(extensions.encrypt(p_refresh_token::bytea, decode(v_encryption_key, 'hex'), 'aes'), 'base64'),
    token_expires_at = p_expires_at,
    connected_at = now(),
    connected_by = auth.uid(),
    is_active = true,
    sync_error = NULL,
    updated_at = now();

  RETURN TRUE;
END;
$$;

-- Helper function to get decrypted QuickBooks tokens
CREATE OR REPLACE FUNCTION public.get_quickbooks_tokens(p_company_id UUID)
RETURNS TABLE(
  realm_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
  v_access_encrypted TEXT;
  v_refresh_encrypted TEXT;
  v_realm TEXT;
  v_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get connection details
  SELECT 
    qc.realm_id,
    qc.access_token_encrypted,
    qc.refresh_token_encrypted,
    qc.token_expires_at
  INTO v_realm, v_access_encrypted, v_refresh_encrypted, v_expires
  FROM public.quickbooks_connections qc
  WHERE qc.company_id = p_company_id AND qc.is_active = true;

  IF v_realm IS NULL THEN
    RETURN;
  END IF;

  -- Get encryption key
  v_encryption_key := public.get_company_encryption_key(p_company_id);

  -- Return decrypted tokens
  RETURN QUERY SELECT
    v_realm,
    convert_from(extensions.decrypt(decode(v_access_encrypted, 'base64'), decode(v_encryption_key, 'hex'), 'aes'), 'UTF8'),
    convert_from(extensions.decrypt(decode(v_refresh_encrypted, 'base64'), decode(v_encryption_key, 'hex'), 'aes'), 'UTF8'),
    v_expires;
END;
$$;

-- Add updated_at trigger
CREATE TRIGGER update_quickbooks_connections_updated_at
BEFORE UPDATE ON public.quickbooks_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quickbooks_sync_log_updated_at
BEFORE UPDATE ON public.quickbooks_sync_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();