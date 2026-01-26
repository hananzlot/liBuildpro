import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface KPIVisibilitySettings {
  leads_resell_visible: boolean;
  magazine_sales_visible: boolean;
}

const DEFAULT_VISIBILITY: KPIVisibilitySettings = {
  leads_resell_visible: false,
  magazine_sales_visible: false,
};

export function useKPIVisibility() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const { data: visibility = DEFAULT_VISIBILITY, isLoading } = useQuery({
    queryKey: ["kpi-visibility", companyId],
    queryFn: async () => {
      if (!companyId) return DEFAULT_VISIBILITY;

      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["kpi_leads_resell_visible", "kpi_magazine_sales_visible"]);

      if (error) throw error;

      const settingsMap = new Map(data?.map((s) => [s.setting_key, s.setting_value]) || []);

      return {
        leads_resell_visible: settingsMap.get("kpi_leads_resell_visible") === "true",
        magazine_sales_visible: settingsMap.get("kpi_magazine_sales_visible") === "true",
      };
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000, // 30 minutes - settings rarely change
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!companyId) throw new Error("No company ID");

      const { error } = await supabase
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            setting_key: key,
            setting_value: enabled ? "true" : "false",
            setting_type: "boolean",
            description: `KPI card visibility setting`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,setting_key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-visibility", companyId] });
      toast.success("KPI visibility updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update visibility: ${error.message}`);
    },
  });

  const toggleLeadsResell = (enabled: boolean) => {
    toggleMutation.mutate({ key: "kpi_leads_resell_visible", enabled });
  };

  const toggleMagazineSales = (enabled: boolean) => {
    toggleMutation.mutate({ key: "kpi_magazine_sales_visible", enabled });
  };

  return {
    visibility,
    isLoading,
    toggleLeadsResell,
    toggleMagazineSales,
    isToggling: toggleMutation.isPending,
  };
}
