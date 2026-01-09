-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  description TEXT
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to insert audit logs (needed for triggers/functions)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- Create function to log audit entries
CREATE OR REPLACE FUNCTION public.log_audit(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_changes JSONB;
  v_audit_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get user email from profiles
  SELECT email INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Calculate changes for updates
  IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('old', p_old_values->key, 'new', value))
    INTO v_changes
    FROM jsonb_each(p_new_values)
    WHERE p_old_values->key IS DISTINCT FROM value;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    user_email,
    old_values,
    new_values,
    changes,
    description
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    v_user_id,
    v_user_email,
    p_old_values,
    p_new_values,
    v_changes,
    p_description
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;