import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SidebarFinancials {
  arDueByFocusDay: number;
  apDueByFocusDay: number;
  focusDate: Date;
  isLoading: boolean;
}

function getNextFocusDay(today: Date, focusDayOfWeek: number): Date {
  const currentDay = today.getDay();
  
  // If today is the focus day, return today
  if (currentDay === focusDayOfWeek) {
    return today;
  }
  
  // Calculate days until the next focus day
  const daysUntilFocus = (focusDayOfWeek - currentDay + 7) % 7;
  const nextFocus = new Date(today);
  nextFocus.setDate(today.getDate() + daysUntilFocus);
  return nextFocus;
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function useSidebarFinancials(): SidebarFinancials & { formatCompactCurrency: (amount: number) => string } {
  // Fetch the payment focus day setting
  const { data: focusDaySetting } = useQuery({
    queryKey: ["payment-focus-day-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "payment_focus_day")
        .single();
      
      if (error) {
        console.error("Error fetching payment focus day:", error);
        return 5; // Default to Friday
      }
      return parseInt(data?.setting_value || "5", 10);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const focusDayOfWeek = focusDaySetting ?? 5; // Default Friday
  const today = new Date();
  const focusDate = getNextFocusDay(today, focusDayOfWeek);
  const focusDateStr = focusDate.toISOString().split('T')[0];

  // Fetch AR (invoices with open balance) due by focus day
  // AR is due based on payment phase due_date
  const { data: arData, isLoading: arLoading } = useQuery({
    queryKey: ["sidebar-ar-due", focusDateStr],
    queryFn: async () => {
      // Get invoices with open balance that have payment phases due by focus day
      const { data: invoices, error } = await supabase
        .from("project_invoices")
        .select(`
          id,
          open_balance,
          payment_phase_id,
          project_payment_phases!inner (
            due_date
          )
        `)
        .gt("open_balance", 0)
        .lte("project_payment_phases.due_date", focusDateStr);

      if (error) {
        console.error("Error fetching AR data:", error);
        return 0;
      }

      return invoices?.reduce((sum, inv) => sum + (Number(inv.open_balance) || 0), 0) || 0;
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    enabled: focusDaySetting !== undefined,
  });

  // Fetch AP (bills with balance) due by focus day
  const { data: apData, isLoading: apLoading } = useQuery({
    queryKey: ["sidebar-ap-due", focusDateStr],
    queryFn: async () => {
      // Get bills with balance that have scheduled_payment_date by focus day
      const { data: bills, error } = await supabase
        .from("project_bills")
        .select("id, balance, scheduled_payment_date")
        .gt("balance", 0)
        .eq("is_voided", false)
        .lte("scheduled_payment_date", focusDateStr);

      if (error) {
        console.error("Error fetching AP data:", error);
        return 0;
      }

      return bills?.reduce((sum, bill) => sum + (Number(bill.balance) || 0), 0) || 0;
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    enabled: focusDaySetting !== undefined,
  });

  return {
    arDueByFocusDay: arData || 0,
    apDueByFocusDay: apData || 0,
    focusDate,
    isLoading: arLoading || apLoading,
    formatCompactCurrency,
  };
}
