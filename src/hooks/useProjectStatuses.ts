import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { PROJECT_STATUSES } from "@/components/production/AdminKPIFilters";

export interface ProjectStatus {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  company_id: string;
}

/**
 * Fetches project statuses from the database for the current company.
 * Falls back to hardcoded PROJECT_STATUSES when no DB records exist.
 */
export function useProjectStatuses() {
  const { companyId } = useCompanyContext();

  const { data: dbStatuses, isLoading, refetch } = useQuery({
    queryKey: ["project-statuses", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data as ProjectStatus[];
    },
    enabled: !!companyId,
  });

  // If DB has statuses, use them; otherwise fall back to hardcoded list
  const statusNames: string[] =
    dbStatuses && dbStatuses.length > 0
      ? dbStatuses.map((s) => s.name)
      : PROJECT_STATUSES;

  return {
    statuses: dbStatuses || [],
    statusNames,
    isLoading,
    refetch,
    hasDbStatuses: !!dbStatuses && dbStatuses.length > 0,
  };
}
