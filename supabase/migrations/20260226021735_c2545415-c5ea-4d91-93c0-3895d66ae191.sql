
-- Drop the old function first (parameter name changed)
DROP FUNCTION IF EXISTS public.archive_old_audit_logs(integer);

-- Create the new record-limit based archive function
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(p_max_records INTEGER DEFAULT 50000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_count INTEGER;
  v_to_archive INTEGER;
  v_archived INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_current_count FROM public.audit_logs;
  
  IF v_current_count <= p_max_records THEN
    RETURN 0;
  END IF;
  
  v_to_archive := v_current_count - p_max_records;
  
  WITH rows_to_archive AS (
    SELECT id, table_name, record_id, action, user_id, user_email,
           old_values, new_values, changes, description, changed_at, company_id
    FROM public.audit_logs
    ORDER BY changed_at ASC
    LIMIT v_to_archive
  ),
  inserted AS (
    INSERT INTO public.archived_audit_logs (
      id, table_name, record_id, action, user_id, user_email,
      old_values, new_values, changes, description, changed_at, company_id, archived_at
    )
    SELECT id, table_name, record_id, action, user_id, user_email,
           old_values, new_values, changes, description, changed_at, company_id, now()
    FROM rows_to_archive
    RETURNING id
  )
  DELETE FROM public.audit_logs
  WHERE id IN (SELECT id FROM inserted);
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  
  RETURN v_archived;
END;
$function$;

-- Add indexes on archived_audit_logs
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_company_changed ON public.archived_audit_logs (company_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_table_record ON public.archived_audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_action ON public.archived_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_user_email ON public.archived_audit_logs (user_email);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_record_id ON public.archived_audit_logs (record_id);

-- Update app_settings: replace retention_days with max_records
UPDATE public.app_settings 
SET setting_key = 'audit_log_max_records',
    setting_value = '50000',
    description = 'Maximum number of active audit log records before archiving oldest'
WHERE setting_key = 'audit_log_retention_days';

-- If the old setting didn't exist, insert the new one
INSERT INTO public.app_settings (setting_key, setting_value, description, setting_type)
SELECT 'audit_log_max_records', '50000', 'Maximum number of active audit log records before archiving oldest', 'number'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE setting_key = 'audit_log_max_records');
