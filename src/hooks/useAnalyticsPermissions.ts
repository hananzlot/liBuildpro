import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export const ANALYTICS_REPORTS = [
  { key: "project_summary", label: "Projects Summary", route: "/analytics/project_summary" },
  { key: "profitability", label: "Profitability", route: "/analytics/profitability" },
  { key: "cashflow", label: "Cash Flow", route: "/analytics/cashflow" },
  { key: "receivables", label: "Accounts Receivable", route: "/analytics/receivables" },
  { key: "bank", label: "Bank Activity", route: "/analytics/bank" },
  { key: "commission", label: "Commission Report", route: "/analytics/commission" },
  { key: "pnl", label: "P&L Statement", route: "/analytics/pnl" },
  { key: "balance_sheet", label: "Balance Sheet", route: "/analytics/balance-sheet" },
  { key: "outstanding_ap", label: "Outstanding AP", route: "/outstanding-ap" },
  { key: "outstanding_ar", label: "Outstanding AR", route: "/outstanding-ar" },
] as const;

export type AnalyticsReportKey = typeof ANALYTICS_REPORTS[number]["key"];

// Admin and super_admin see all reports by default
const ADMIN_DEFAULT_REPORTS: AnalyticsReportKey[] = [
  "profitability", "cashflow", "receivables", "bank", "commission", "pnl", "balance_sheet", "project_summary", "outstanding_ap", "outstanding_ar"
];

// Default reports for production role when no company setting has been saved
const PRODUCTION_DEFAULT_REPORTS: AnalyticsReportKey[] = [
  "profitability", "cashflow", "receivables", "project_summary"
];

interface AnalyticsPermission {
  user_id: string;
  report_key: string;
  is_visible: boolean;
}

const PERMISSIONS_QUERY_KEY = "analytics-permissions";

/**
 * Hook to check which analytics reports the current user can see.
 * Admin/super_admin see all by default; other roles check role-based defaults,
 * then per-user overrides take priority.
 */
export function useAnalyticsPermissions() {
  const { user, isAdmin, isSuperAdmin, userRoles } = useAuth();
  const { companyId } = useCompanyContext();

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: [PERMISSIONS_QUERY_KEY, user?.id, companyId],
    queryFn: async () => {
      if (!user?.id || !companyId) return [];

      const { data, error } = await supabase
        .from("user_analytics_permissions")
        .select("report_key, is_visible")
        .eq("user_id", user.id)
        .eq("company_id", companyId);

      if (error) throw error;
      return data as { report_key: string; is_visible: boolean }[];
    },
    enabled: !!user?.id && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch role-based defaults from company_settings
  const { data: roleDefaults, isLoading: roleDefaultsLoading } = useQuery({
    queryKey: ["analytics-role-defaults", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "analytics_role_defaults")
        .maybeSingle();

      if (error) throw error;
      if (data?.setting_value) {
        try {
          return JSON.parse(data.setting_value) as Record<string, AnalyticsReportKey[]>;
        } catch {
          return {};
        }
      }
      return {};
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = permissionsLoading || roleDefaultsLoading;

  // Determine visible reports
  const visibleReports: AnalyticsReportKey[] = (() => {
    // If admin/super_admin with no overrides, show all
    if (isAdmin || isSuperAdmin) {
      if (permissions.length === 0) return [...ADMIN_DEFAULT_REPORTS];
      // If overrides exist, use them
      return ANALYTICS_REPORTS
        .filter(r => {
          const perm = permissions.find(p => p.report_key === r.key);
          // If no override for this report, default to visible for admins
          if (!perm) return true;
          return perm.is_visible;
        })
        .map(r => r.key);
    }

    // Non-admin: if per-user overrides exist, use them
    if (permissions.length > 0) {
      return permissions
        .filter(p => p.is_visible)
        .map(p => p.report_key as AnalyticsReportKey);
    }

    // Fall back to role-based defaults
    if (roleDefaults && userRoles.length > 0) {
      const merged = new Set<AnalyticsReportKey>();
      for (const role of userRoles) {
        const defaults = roleDefaults[role];
        if (defaults) {
          defaults.forEach(k => merged.add(k));
        }
      }
      if (merged.size > 0) return Array.from(merged);
    }

    // Code-level defaults for production role when no company setting exists
    if (userRoles.includes('production')) {
      return [...PRODUCTION_DEFAULT_REPORTS];
    }

    return [];
  })();

  const canViewReport = (reportKey: AnalyticsReportKey): boolean => {
    return visibleReports.includes(reportKey);
  };

  const hasAnyAnalyticsAccess = visibleReports.length > 0;

  return {
    visibleReports,
    canViewReport,
    hasAnyAnalyticsAccess,
    isLoading,
  };
}

/**
 * Hook for admins to manage analytics permissions for any user.
 */
export function useManageAnalyticsPermissions(targetUserId: string | null) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: [PERMISSIONS_QUERY_KEY, "manage", targetUserId, companyId],
    queryFn: async () => {
      if (!targetUserId || !companyId) return [];

      const { data, error } = await supabase
        .from("user_analytics_permissions")
        .select("report_key, is_visible")
        .eq("user_id", targetUserId)
        .eq("company_id", companyId);

      if (error) throw error;
      return data as { report_key: string; is_visible: boolean }[];
    },
    enabled: !!targetUserId && !!companyId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ reportKey, isVisible }: { reportKey: AnalyticsReportKey; isVisible: boolean }) => {
      if (!targetUserId || !companyId) throw new Error("Missing user or company context");

      const { error } = await supabase
        .from("user_analytics_permissions")
        .upsert(
          {
            user_id: targetUserId,
            company_id: companyId,
            report_key: reportKey,
            is_visible: isVisible,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,company_id,report_key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update permission: ${error.message}`);
    },
  });

  const setAllReports = useMutation({
    mutationFn: async (isVisible: boolean) => {
      if (!targetUserId || !companyId) throw new Error("Missing user or company context");

      const records = ANALYTICS_REPORTS.map(r => ({
        user_id: targetUserId,
        company_id: companyId,
        report_key: r.key,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("user_analytics_permissions")
        .upsert(records, { onConflict: "user_id,company_id,report_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
      toast.success("Analytics permissions updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update permissions: ${error.message}`);
    },
  });

  const isReportVisible = (reportKey: AnalyticsReportKey): boolean => {
    const perm = userPermissions.find(p => p.report_key === reportKey);
    return perm?.is_visible ?? false;
  };

  return {
    userPermissions,
    isLoading,
    isReportVisible,
    toggleReport: (reportKey: AnalyticsReportKey, isVisible: boolean) => toggleMutation.mutate({ reportKey, isVisible }),
    setAllReports: (isVisible: boolean) => setAllReports.mutate(isVisible),
    isToggling: toggleMutation.isPending || setAllReports.isPending,
  };
}
