-- Create enum for sync direction
CREATE TYPE public.calendar_sync_direction AS ENUM ('import', 'export', 'bidirectional');

-- Create enum for sync source
CREATE TYPE public.appointment_sync_source AS ENUM ('google', 'local', 'ghl');

-- Create google_calendar_connections table
CREATE TABLE public.google_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  calendar_email TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_direction calendar_sync_direction NOT NULL DEFAULT 'bidirectional',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_company_calendar BOOLEAN NOT NULL DEFAULT false,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, calendar_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_calendar_connections
-- Users can view company calendars or their own personal calendars
CREATE POLICY "Users can view company calendars or own calendars"
  ON public.google_calendar_connections FOR SELECT
  USING (
    has_company_access(company_id) AND (
      is_company_calendar = true OR 
      user_id = auth.uid()
    )
  );

-- Admins can manage company calendars
CREATE POLICY "Admins can manage company calendars"
  ON public.google_calendar_connections FOR ALL
  USING (
    has_company_access(company_id) AND 
    is_admin(auth.uid()) AND 
    is_company_calendar = true
  )
  WITH CHECK (
    has_company_access(company_id) AND 
    is_admin(auth.uid()) AND 
    is_company_calendar = true
  );

-- Users can manage their own personal calendars
CREATE POLICY "Users can manage own calendars"
  ON public.google_calendar_connections FOR ALL
  USING (
    has_company_access(company_id) AND 
    user_id = auth.uid() AND 
    is_company_calendar = false
  )
  WITH CHECK (
    has_company_access(company_id) AND 
    user_id = auth.uid() AND 
    is_company_calendar = false
  );

-- Add Google Calendar fields to appointments table
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_source appointment_sync_source DEFAULT 'local';

-- Create index for Google event lookup
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id 
  ON public.appointments(google_event_id) 
  WHERE google_event_id IS NOT NULL;

-- Create index for calendar connection lookup
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_company 
  ON public.google_calendar_connections(company_id, is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to store Google OAuth tokens encrypted
CREATE OR REPLACE FUNCTION public.store_google_oauth_tokens(
  p_connection_id UUID,
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
  v_company_id UUID;
  v_encryption_key TEXT;
BEGIN
  -- Get the company_id from the connection
  SELECT company_id INTO v_company_id
  FROM public.google_calendar_connections
  WHERE id = p_connection_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  -- Get encryption key for the company
  v_encryption_key := public.get_company_encryption_key(v_company_id);

  -- Update the connection with encrypted tokens
  UPDATE public.google_calendar_connections
  SET 
    access_token_encrypted = encode(
      extensions.encrypt(p_access_token::bytea, decode(v_encryption_key, 'hex'), 'aes'),
      'base64'
    ),
    refresh_token_encrypted = CASE 
      WHEN p_refresh_token IS NOT NULL THEN encode(
        extensions.encrypt(p_refresh_token::bytea, decode(v_encryption_key, 'hex'), 'aes'),
        'base64'
      )
      ELSE refresh_token_encrypted
    END,
    token_expires_at = p_expires_at,
    updated_at = now()
  WHERE id = p_connection_id;

  RETURN FOUND;
END;
$$;

-- Function to get decrypted Google OAuth tokens
CREATE OR REPLACE FUNCTION public.get_google_oauth_tokens(p_connection_id UUID)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_encryption_key TEXT;
  v_access_token_encrypted TEXT;
  v_refresh_token_encrypted TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the connection details
  SELECT 
    gcc.company_id, 
    gcc.access_token_encrypted, 
    gcc.refresh_token_encrypted,
    gcc.token_expires_at
  INTO 
    v_company_id, 
    v_access_token_encrypted, 
    v_refresh_token_encrypted,
    v_expires_at
  FROM public.google_calendar_connections gcc
  WHERE gcc.id = p_connection_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  -- Get encryption key
  v_encryption_key := public.get_company_encryption_key(v_company_id);

  -- Return decrypted tokens
  RETURN QUERY SELECT
    CASE 
      WHEN v_access_token_encrypted IS NOT NULL THEN
        convert_from(
          extensions.decrypt(decode(v_access_token_encrypted, 'base64'), decode(v_encryption_key, 'hex'), 'aes'),
          'UTF8'
        )
      ELSE NULL
    END,
    CASE 
      WHEN v_refresh_token_encrypted IS NOT NULL THEN
        convert_from(
          extensions.decrypt(decode(v_refresh_token_encrypted, 'base64'), decode(v_encryption_key, 'hex'), 'aes'),
          'UTF8'
        )
      ELSE NULL
    END,
    v_expires_at;
END;
$$;