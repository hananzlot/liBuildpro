import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

interface AuditLogParams {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: unknown | null;
  newValues?: unknown | null;
  description?: string;
}

export const logAudit = async ({
  tableName,
  recordId,
  action,
  oldValues = null,
  newValues = null,
  description,
}: AuditLogParams): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_audit', {
      p_table_name: tableName,
      p_record_id: recordId,
      p_action: action,
      p_old_values: oldValues as Json,
      p_new_values: newValues as Json,
      p_description: description || null,
    });

    if (error) {
      console.error('Failed to log audit:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error logging audit:', err);
    return null;
  }
};

export const useAuditLog = () => {
  return { logAudit };
};
