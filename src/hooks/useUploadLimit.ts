import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_UPLOAD_LIMIT_MB = 20;

export function useUploadLimit() {
  const { data: limitMb } = useQuery({
    queryKey: ["upload-limit-mb"],
    queryFn: async () => {
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
