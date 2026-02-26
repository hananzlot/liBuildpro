
-- 1. Create archived audit logs table (same structure as audit_logs)
CREATE TABLE public.archived_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  user_id UUID,
  user_email TEXT,
  company_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  description TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.archived_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived audit logs"
  ON public.archived_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_company_access(company_id));

-- 2. Add indexes on audit_logs for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_changed ON public.audit_logs (company_id, changed_at DESC);

-- Indexes on archived table
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_changed_at ON public.archived_audit_logs (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_company_id ON public.archived_audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_table_name ON public.archived_audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_archived_at ON public.archived_audit_logs (archived_at DESC);

-- 3. Create the generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_changes JSONB;
  v_user_id UUID;
  v_user_email TEXT;
  v_company_id UUID;
  v_action TEXT;
  v_record_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user email
  SELECT email INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  v_action := TG_OP;

  IF TG_OP = 'INSERT' THEN
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    v_changes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    
    -- Calculate only changed fields
    SELECT jsonb_object_agg(key, jsonb_build_object('old', v_old_values->key, 'new', value))
    INTO v_changes
    FROM jsonb_each(v_new_values)
    WHERE v_old_values->key IS DISTINCT FROM value
      AND key NOT IN ('updated_at', 'last_synced_at'); -- skip noisy timestamp fields
    
    -- If nothing meaningful changed, skip logging
    IF v_changes IS NULL OR v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    v_record_id := OLD.id;
    v_company_id := OLD.company_id;
    v_changes := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, user_id, user_email,
    company_id, old_values, new_values, changes, changed_at
  ) VALUES (
    TG_TABLE_NAME, v_record_id, v_action, v_user_id, v_user_email,
    v_company_id, v_old_values, v_new_values, v_changes, now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create triggers on projects, estimates, and opportunities
CREATE TRIGGER audit_projects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_estimates_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_opportunities_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 5. Create the archive function
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(p_retention_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_archived INTEGER;
BEGIN
  -- Move old logs to archive
  WITH moved AS (
    DELETE FROM public.audit_logs
    WHERE changed_at < (now() - (p_retention_days || ' days')::interval)
    RETURNING *
  )
  INSERT INTO public.archived_audit_logs (
    id, table_name, record_id, action, user_id, user_email,
    company_id, old_values, new_values, changes, description,
    changed_at, archived_at
  )
  SELECT 
    id, table_name, record_id, action, user_id, user_email,
    company_id, old_values, new_values, changes, description,
    changed_at, now()
  FROM moved;

  GET DIAGNOSTICS v_archived = ROW_COUNT;
  RETURN v_archived;
END;
$$;

-- 6. Insert default app setting for audit log retention
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'audit_log_retention_days',
  '7',
  'number',
  'Number of days to keep audit logs before auto-archiving. Controlled by admin.'
)
ON CONFLICT (setting_key) DO NOTHING;
