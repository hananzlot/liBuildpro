import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

const DEFAULT_UPLOAD_LIMIT_MB = 20;

export function useUploadLimit() {
  const { companyId } = useCompanyContext();

  const { data: limitMb } = useQuery({
    queryKey: ["upload-limit-mb", companyId],
    queryFn: async () => {
      // First try company_settings (per-company, set by admin)
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "portal_upload_limit_mb")
          .maybeSingle();

        if (companyData?.setting_value) {
          const val = parseInt(companyData.setting_value, 10);
          if (!isNaN(val) && val > 0) return val;
        }
      }

      // Fallback to app_settings (global default)
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "portal_upload_limit_mb")
        .maybeSingle();

      const val = parseInt(data?.setting_value ?? "", 10);
      return isNaN(val) || val <= 0 ? DEFAULT_UPLOAD_LIMIT_MB : val;
    },
    staleTime: 5 * 60 * 1000,
  });

  const maxMb = limitMb ?? DEFAULT_UPLOAD_LIMIT_MB;
  const maxBytes = maxMb * 1024 * 1024;

  const validateFileSize = (file: File): boolean => {
    if (file.size > maxBytes) {
      return false;
    }
    return true;
  };

  return { maxMb, maxBytes, validateFileSize };
}
