import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export function usePendingScopeSubmissionsCount() {
  const { companyId } = useCompanyContext();

  return useQuery({
    queryKey: ["pending-scope-submissions-count", companyId],
    queryFn: async () => {
      if (!companyId) return 0;

      const { count, error } = await supabase
        .from("scope_submissions")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending scope submissions count:", error);
        return 0;
      }

      return count ?? 0;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    enabled: !!companyId,
  });
}
