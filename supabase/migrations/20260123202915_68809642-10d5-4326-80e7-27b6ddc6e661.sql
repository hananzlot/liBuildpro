-- Create function to store Resend API key encrypted (similar to GHL pattern)
CREATE OR REPLACE FUNCTION public.store_resend_api_key_encrypted(p_api_key text, p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_encryption_key text;
  v_caller_uid uuid;
BEGIN
  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to this company
    IF NOT public.has_company_access(p_company_id) THEN
      RAISE EXCEPTION 'Access denied: cannot store encryption key for different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;

  -- Get or generate the company's encryption key
  v_encryption_key := public.get_company_encryption_key(p_company_id);

  -- Upsert the encrypted API key into company_settings
  INSERT INTO public.company_settings (company_id, setting_key, setting_value, setting_type, description)
  VALUES (
    p_company_id,
    'resend_api_key_encrypted',
    encode(
      extensions.encrypt(
        p_api_key::bytea, 
        decode(v_encryption_key, 'hex'), 
        'aes'::text
      ),
      'base64'
    ),
    'secret',
    'Resend API key (encrypted) for email delivery'
  )
  ON CONFLICT (company_id, setting_key) DO UPDATE 
  SET setting_value = encode(
        extensions.encrypt(
          p_api_key::bytea, 
          decode(v_encryption_key, 'hex'), 
          'aes'::text
        ),
        'base64'
      ),
      updated_at = now();

  RETURN true;
END;
$function$;

-- Create function to get Resend API key decrypted
CREATE OR REPLACE FUNCTION public.get_resend_api_key_encrypted(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_encrypted text;
  v_encryption_key text;
  v_caller_uid uuid;
BEGIN
  -- Get caller's user ID
  v_caller_uid := auth.uid();

  -- If there's an authenticated user (not service role), verify access
  IF v_caller_uid IS NOT NULL THEN
    -- Verify user has access to this company
    IF NOT public.has_company_access(p_company_id) THEN
      RAISE EXCEPTION 'Access denied: cannot retrieve API key for different company';
    END IF;

    -- Verify user has appropriate role (admin or super_admin)
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
  END IF;

  -- Get the encrypted value
  SELECT setting_value INTO v_encrypted
  FROM public.company_settings
  WHERE company_id = p_company_id
    AND setting_key = 'resend_api_key_encrypted';

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the company's encryption key and decrypt
  v_encryption_key := public.get_company_encryption_key(p_company_id);

  RETURN convert_from(
    extensions.decrypt(
      decode(v_encrypted, 'base64'), 
      decode(v_encryption_key, 'hex'), 
      'aes'::text
    ),
    'UTF8'
  );
END;
$function$;