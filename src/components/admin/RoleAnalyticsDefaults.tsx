import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { ANALYTICS_REPORTS, AnalyticsReportKey } from "@/hooks/useAnalyticsPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, BarChart3 } from "lucide-react";
import { toast } from "sonner";

// Roles that can have report defaults configured (exclude admin/super_admin since they see all)
const CONFIGURABLE_ROLES = [
  { key: "production", label: "Production" },
  { key: "dispatch", label: "Dispatch" },
  { key: "sales", label: "Sales" },
  { key: "contract_manager", label: "Contract Manager" },
  { key: "magazine", label: "Magazine" },
  { key: "corp_admin", label: "Corp Admin" },
  { key: "corp_viewer", label: "Corp Viewer" },
] as const;

type RoleDefaultsMap = Record<string, AnalyticsReportKey[]>;

const SETTING_KEY = "analytics_role_defaults";

export function RoleAnalyticsDefaults() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [localDefaults, setLocalDefaults] = useState<RoleDefaultsMap>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: savedDefaults, isLoading } = useQuery({
    queryKey: ["analytics-role-defaults", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error) throw error;
      if (data?.setting_value) {
        try {
          return JSON.parse(data.setting_value) as RoleDefaultsMap;
        } catch {
          return {};
        }
      }
      return {};
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (savedDefaults) {
      setLocalDefaults(savedDefaults);
      setHasUnsavedChanges(false);
    }
  }, [savedDefaults]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            setting_key: SETTING_KEY,
            setting_value: JSON.stringify(localDefaults),
            setting_type: "json",
            description: "Default analytics report visibility per role",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,setting_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-role-defaults", companyId] });
      queryClient.invalidateQueries({ queryKey: ["analytics-permissions"] });
      setHasUnsavedChanges(false);
      toast.success("Role report defaults saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const toggleReport = (role: string, reportKey: AnalyticsReportKey) => {
    setLocalDefaults((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(reportKey)
        ? current.filter((k) => k !== reportKey)
        : [...current, reportKey];
      return { ...prev, [role]: updated };
    });
    setHasUnsavedChanges(true);
  };

  const toggleAll = (role: string, enable: boolean) => {
    setLocalDefaults((prev) => ({
      ...prev,
      [role]: enable ? ANALYTICS_REPORTS.map((r) => r.key) : [],
    }));
    setHasUnsavedChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Role-Based Report Defaults</CardTitle>
              <CardDescription>
                Configure which analytics reports each role can see by default. Per-user overrides still take priority.
              </CardDescription>
            </div>
          </div>
          {hasUnsavedChanges && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Defaults
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Report</th>
                {CONFIGURABLE_ROLES.map((role) => (
                  <th key={role.key} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[90px]">
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Toggle All Row */}
              <tr className="border-b bg-muted/30">
                <td className="py-2 pr-4 font-medium text-xs uppercase text-muted-foreground">Toggle All</td>
                {CONFIGURABLE_ROLES.map((role) => {
                  const allEnabled =
                    (localDefaults[role.key] || []).length === ANALYTICS_REPORTS.length;
                  return (
                    <td key={role.key} className="text-center py-2 px-2">
                      <Switch
                        checked={allEnabled}
                        onCheckedChange={(checked) => toggleAll(role.key, checked)}
                        className="mx-auto"
                      />
                    </td>
                  );
                })}
              </tr>
              {ANALYTICS_REPORTS.map((report) => (
                <tr key={report.key} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Label className="font-normal">{report.label}</Label>
                  </td>
                  {CONFIGURABLE_ROLES.map((role) => {
                    const isEnabled = (localDefaults[role.key] || []).includes(report.key);
                    return (
                      <td key={role.key} className="text-center py-2 px-2">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleReport(role.key, report.key)}
                          className="mx-auto"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Admin and Super Admin roles always have access to all reports. Per-user permissions override these defaults.
        </p>
      </CardContent>
    </Card>
  );
}
