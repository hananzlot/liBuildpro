import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface GHLModeState {
  isGHLEnabled: boolean;
  isLoading: boolean;
}

export function useGHLMode(): GHLModeState {
  const { companyId } = useCompanyContext();

  const { data, isLoading } = useQuery({
    queryKey: ["ghl-integration-enabled", companyId],
    queryFn: async () => {
      if (!companyId) return true; // Default to enabled if no company

      // First try company_settings (preferred, scoped to company)
      const { data: companyData, error: companyError } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "ghl_integration_enabled")
        .maybeSingle();

      if (!companyError && companyData) {
        return companyData.setting_value !== "false";
      }

      // Fall back to app_settings for backward compatibility
      const { data: appData, error: appError } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ghl_integration_enabled")
        .maybeSingle();
      
      if (appError) {
        console.error("Error fetching GHL mode setting:", appError);
        return true; // Default to enabled if error
      }
      
      // Parse the boolean value - default to true if not set
      return appData?.setting_value !== "false";
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000, // 30 minutes - config rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  return {
    isGHLEnabled: data ?? true, // Default to enabled
    isLoading,
  };
}
