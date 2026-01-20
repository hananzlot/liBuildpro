-- Update get_ghl_api_key_encrypted with company access control
CREATE OR REPLACE FUNCTION public.get_ghl_api_key_encrypted(p_integration_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_encrypted text;
  v_integration_company_id uuid;
  v_encryption_key text;
  v_caller_uid uuid;
BEGIN
  -- Get the company_id for this integration
  SELECT company_id, api_key_encrypted 
  INTO v_integration_company_id, v_encrypted
  FROM public.company_integrations
  WHERE id = p_integration_id;

  IF v_integration_company_id IS NULL THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to the integration's company
    IF NOT public.has_company_access(v_integration_company_id) THEN
      RAISE EXCEPTION 'Access denied: integration belongs to different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;
  -- If v_caller_uid is NULL, this is a service role call from edge functions - allow it

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the company's encryption key and decrypt
  v_encryption_key := public.get_company_encryption_key(v_integration_company_id);

  RETURN convert_from(
    extensions.decrypt(
      decode(v_encrypted, 'base64'), 
      decode(v_encryption_key, 'hex'), 
      'aes'::text
    ),
    'UTF8'
  );
END;
$$;

-- Update store_ghl_api_key_encrypted with company access control
CREATE OR REPLACE FUNCTION public.store_ghl_api_key_encrypted(p_api_key text, p_integration_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_encryption_key text;
  v_caller_uid uuid;
BEGIN
  -- Get the company_id from the integration
  SELECT company_id INTO v_company_id
  FROM public.company_integrations
  WHERE id = p_integration_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to the integration's company
    IF NOT public.has_company_access(v_company_id) THEN
      RAISE EXCEPTION 'Access denied: integration belongs to different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;
  -- If v_caller_uid is NULL, this is a service role call from edge functions - allow it

  -- Get or generate the company's encryption key
  v_encryption_key := public.get_company_encryption_key(v_company_id);

  -- Encrypt and store the API key
  UPDATE public.company_integrations
  SET api_key_encrypted = encode(
        extensions.encrypt(
          p_api_key::bytea, 
          decode(v_encryption_key, 'hex'), 
          'aes'::text
        ),
        'base64'
      ),
      api_key_vault_id = p_integration_id,
      updated_at = now()
  WHERE id = p_integration_id;

  RETURN FOUND;
END;
$$;

-- Also secure get_company_encryption_key to prevent unauthorized access
CREATE OR REPLACE FUNCTION public.get_company_encryption_key(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_caller_uid uuid;
BEGIN
  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to this company
    IF NOT public.has_company_access(p_company_id) THEN
      RAISE EXCEPTION 'Access denied: cannot access encryption key for different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;

  -- Get existing key
  SELECT setting_value INTO v_key
  FROM public.company_settings
  WHERE company_id = p_company_id
    AND setting_key = 'encryption_key';

  -- If no key exists, generate one
  IF v_key IS NULL THEN
    v_key := public.generate_company_encryption_key(p_company_id);
  END IF;

  RETURN v_key;
END;
$$;

-- Also secure generate_company_encryption_key
CREATE OR REPLACE FUNCTION public.generate_company_encryption_key(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_key text;
  v_new_key text;
  v_caller_uid uuid;
BEGIN
  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to this company
    IF NOT public.has_company_access(p_company_id) THEN
      RAISE EXCEPTION 'Access denied: cannot generate encryption key for different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;

  -- Check if key already exists
  SELECT setting_value INTO v_existing_key
  FROM public.company_settings
  WHERE company_id = p_company_id
    AND setting_key = 'encryption_key';

  IF v_existing_key IS NOT NULL THEN
    RETURN v_existing_key;
  END IF;

  -- Generate a new 256-bit key (32 bytes = 64 hex chars)
  v_new_key := encode(extensions.gen_random_bytes(32), 'hex');

  -- Store the key
  INSERT INTO public.company_settings (company_id, setting_key, setting_value, setting_type, description)
  VALUES (
    p_company_id,
    'encryption_key',
    v_new_key,
    'secret',
    'Company-specific encryption key for secure data storage'
  )
  ON CONFLICT (company_id, setting_key) DO UPDATE SET setting_value = v_new_key;

  RETURN v_new_key;
END;
$$;