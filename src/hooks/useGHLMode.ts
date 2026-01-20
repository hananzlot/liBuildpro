import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GHLModeState {
  isGHLEnabled: boolean;
  isLoading: boolean;
}

export function useGHLMode(): GHLModeState {
  const { data, isLoading } = useQuery({
    queryKey: ["ghl-integration-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ghl_integration_enabled")
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching GHL mode setting:", error);
        return true; // Default to enabled if error
      }
      
      // Parse the boolean value - default to true if not set
      return data?.setting_value !== "false";
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    isGHLEnabled: data ?? true, // Default to enabled
    isLoading,
  };
}
