import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { startOfWeek, endOfWeek } from "date-fns";

export function useTodayAppointmentsCount() {
  const { companyId } = useCompanyContext();

  return useQuery({
    queryKey: ["today-appointments-count", companyId],
    queryFn: async () => {
      if (!companyId) return 0;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday

      const { count, error } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString());

      if (error) {
        console.error("Error fetching week's appointments count:", error);
        return 0;
      }

      return count ?? 0;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!companyId,
  });
}
