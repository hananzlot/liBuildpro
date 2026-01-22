import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Mail, Building, Save, Loader2, AlertTriangle, Wrench, Pencil, Users, FileText, MessageSquare, DollarSign, Database, Link, Sparkles, Key, CheckCircle2, XCircle } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AdminCleanup } from "@/components/dashboard/AdminCleanup";
import { SourceManagement } from "@/components/dashboard/SourceManagement";
import { UserManagement } from "@/components/dashboard/UserManagement";
import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager";
import { SalespeopleManagement } from "@/components/admin/SalespeopleManagement";
import { ChatManagement } from "@/components/admin/ChatManagement";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { GHLIntegrationManager } from "@/components/admin/GHLIntegrationManager";
import { AIAnalysisSettings } from "@/components/admin/AIAnalysisSettings";
import { GHLFieldMappings } from "@/components/admin/GHLFieldMappings";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useKPIVisibility } from "@/hooks/useKPIVisibility";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string | null;
  description: string | null;
  updated_at: string;
}

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  user_id: string | null;
  user_email: string | null;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  description: string | null;
}

export default function AdminSettings() {
  const { isAdmin, isLoading: authLoading, companyId } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "settings";
  const { isGHLEnabled } = useGHLMode();
  const { visibility: kpiVisibility, toggleLeadsResell, toggleMagazineSales, isToggling: isTogglingKPI } = useKPIVisibility();
  
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [testingApiKey, setTestingApiKey] = useState<string | null>(null);
  
  // Source management dialog state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  
  // User management dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  
  // Audit log state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // GHL Integration toggle mutation (company-scoped)
  const toggleGHLIntegration = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!companyId) throw new Error("No company ID");

      // Upsert into company_settings for company-scoped setting
      const { error } = await supabase
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            setting_key: "ghl_integration_enabled",
            setting_value: enabled ? "true" : "false",
            setting_type: "boolean",
            description: "Enable or disable GoHighLevel integration sync",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,setting_key" }
        );
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-integration-enabled", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      toast.success("GHL integration setting updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update GHL setting: ${error.message}`);
    },
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      // Fetch from company_settings for the current company
      const { data: companyData } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId)
        .order("setting_key");

      // Fetch from app_settings for backward compatibility
      const { data: appData, error: appError } = await supabase
        .from("app_settings")
        .select("*")
        .order("setting_key");

      if (appError) throw appError;

      // Merge: company_settings override app_settings
      const companySettingsMap = new Map<string, AppSetting>();
      (companyData || []).forEach((s: AppSetting) => {
        companySettingsMap.set(s.setting_key, s);
      });

      // Start with app_settings, override with company_settings
      const mergedSettings: AppSetting[] = (appData || []).map((appSetting: AppSetting) => {
        const companySetting = companySettingsMap.get(appSetting.setting_key);
        if (companySetting) {
          companySettingsMap.delete(appSetting.setting_key); // Mark as processed
          return companySetting;
        }
        return appSetting;
      });

      // Add any company_settings that don't exist in app_settings
      companySettingsMap.forEach((s) => {
        // Skip internal settings like encryption_key
        if (!['encryption_key'].includes(s.setting_key)) {
          mergedSettings.push(s);
        }
      });

      return mergedSettings;
    },
    enabled: isAdmin && !!companyId,
  });
  
  // Data for cleanup tab - scoped by company
  const { data: opportunities = [] } = useQuery({
    queryKey: ["admin-opportunities", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "cleanup" && !!companyId,
  });
  
  const { data: contacts = [] } = useQuery({
    queryKey: ["admin-contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, ghl_id, contact_name, first_name, last_name, source")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && (activeTab === "cleanup" || activeTab === "sources") && !!companyId,
  });
  
  const { data: appointments = [] } = useQuery({
    queryKey: ["admin-appointments", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "cleanup" && !!companyId,
  });
  
  const { data: ghlUsers = [] } = useQuery({
    queryKey: ["admin-ghl-users", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghl_users")
        .select("ghl_id, name, first_name, last_name")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "cleanup" && !!companyId,
  });
  
  // Audit log queries
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", companyId, startDate, endDate, tableFilter, actionFilter, userFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("changed_at", { ascending: false })
        .limit(500);

      if (startDate) {
        query = query.gte("changed_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("changed_at", `${endDate}T23:59:59`);
      }
      if (tableFilter && tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (actionFilter && actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (userFilter) {
        query = query.ilike("user_email", `%${userFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isAdmin && activeTab === "audit" && !!companyId,
  });

  const { data: distinctTables } = useQuery({
    queryKey: ["audit-log-tables", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("table_name")
        .eq("company_id", companyId)
        .order("table_name");
      if (error) throw error;
      const unique = [...new Set(data.map((d) => d.table_name))];
      return unique;
    },
    enabled: isAdmin && activeTab === "audit" && !!companyId,
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!companyId) throw new Error("No company ID");
      
      // Upsert to company_settings for per-company isolation
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Setting updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`);
    },
  });

  const handleChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    const value = editedSettings[key];
    if (value !== undefined) {
      updateSetting.mutate({ key, value });
      setEditedSettings((prev) => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const getValue = (setting: AppSetting) => {
    return editedSettings[setting.setting_key] ?? setting.setting_value ?? "";
  };

  const hasChanges = (key: string) => {
    return editedSettings[key] !== undefined;
  };
  
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };
  
  const handleDataUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
  };
  
  const handleOpenOpportunity = (opportunity: any) => {
    // For now, just show a toast - can be expanded to open a detail sheet
    toast.info(`Opportunity: ${opportunity.name}`);
  };
  
  const clearAuditFilters = () => {
    setStartDate("");
    setEndDate("");
    setTableFilter("all");
    setActionFilter("all");
    setUserFilter("");
  };

  const testApiKey = async (keyType: "openai" | "resend") => {
    const settingKey = keyType === "openai" ? "openai_api_key" : "resend_api_key";
    const apiKey = editedSettings[settingKey] ?? apiKeySettings?.find(s => s.setting_key === settingKey)?.setting_value;
    
    if (!apiKey) {
      toast.error(`No ${keyType === "openai" ? "OpenAI" : "Resend"} API key to test`);
      return;
    }

    setTestingApiKey(keyType);
    try {
      const { data, error } = await supabase.functions.invoke("test-api-key", {
        body: { keyType, apiKey },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || `${keyType === "openai" ? "OpenAI" : "Resend"} API key is valid!`);
      } else {
        toast.error(data?.error || `Invalid ${keyType === "openai" ? "OpenAI" : "Resend"} API key`);
      }
    } catch (err) {
      console.error("Error testing API key:", err);
      toast.error(`Failed to test API key: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTestingApiKey(null);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const emailSettings = settings?.filter((s) =>
    ["resend_from_email", "resend_from_name"].includes(s.setting_key)
  );

  const companySettings = settings?.filter((s) =>
    ["company_name", "company_address", "company_phone", "company_website", "license_type", "license_number", "license_holder_name"].includes(s.setting_key)
  );

  const portalSettings = settings?.filter((s) =>
    ["portal_upload_limit_mb", "app_base_url"].includes(s.setting_key)
  );

  const estimateSettings = settings?.filter((s) =>
    ["default_terms_and_conditions", "default_markup_percent", "default_deposit_percent", "default_deposit_max_amount"].includes(s.setting_key)
  );

  const payablesReceivablesSettings = settings?.filter((s) =>
    ["payment_focus_day"].includes(s.setting_key)
  );

  const apiKeySettings = settings?.filter((s) =>
    ["openai_api_key", "resend_api_key"].includes(s.setting_key)
  );

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderSettingField = (setting: AppSetting) => (
    <div key={setting.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={setting.setting_key}>{formatLabel(setting.setting_key)}</Label>
        {hasChanges(setting.setting_key) && (
          <Button
            size="sm"
            onClick={() => handleSave(setting.setting_key)}
            disabled={updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
      <Input
        id={setting.setting_key}
        value={getValue(setting)}
        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
        placeholder={setting.description || ""}
      />
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );

  const renderTextareaSettingField = (setting: AppSetting) => (
    <div key={setting.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={setting.setting_key}>{formatLabel(setting.setting_key)}</Label>
        {hasChanges(setting.setting_key) && (
          <Button
            size="sm"
            onClick={() => handleSave(setting.setting_key)}
            disabled={updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
      <Textarea
        id={setting.setting_key}
        value={getValue(setting)}
        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
        placeholder={setting.description || ""}
        rows={12}
        className="font-mono text-sm"
      />
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Admin Settings
          </h1>
          <p className="text-muted-foreground">
            Manage application settings, users, data, and view audit logs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">GHL</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Custom/API</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="payables" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">AR/AP</span>
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Data</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Email Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Settings (Resend)
                    </CardTitle>
                    <CardDescription>
                      Configure email sending for proposals and notifications. Make sure your domain is verified at{" "}
                      <a
                        href="https://resend.com/domains"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        resend.com/domains
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {emailSettings?.map(renderSettingField)}

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-amber-800">
                        <strong>Important:</strong> The "From Email" must use a domain you've verified in Resend.
                        For example, if you verified <code>caprobuilders.com</code>, use an email like{" "}
                        <code>proposals@caprobuilders.com</code>.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Company Logo */}
                <LogoUpload />

                {/* Company Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Company Settings
                    </CardTitle>
                    <CardDescription>
                      General company information used in emails and documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {companySettings?.map(renderSettingField)}
                  </CardContent>
                </Card>

                {/* Portal Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Customer Portal Settings
                    </CardTitle>
                    <CardDescription>
                      Configure settings for the customer portal experience. The App Base URL is used for all portal links in emails (e.g., your custom domain).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {portalSettings?.map(renderSettingField)}
                  </CardContent>
                </Card>

                {/* Estimate Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Estimate Settings
                    </CardTitle>
                    <CardDescription>
                      Default settings for new estimates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {estimateSettings?.map((setting) => 
                      setting.setting_key === "default_terms_and_conditions" 
                        ? renderTextareaSettingField(setting)
                        : renderSettingField(setting)
                    )}
                    
                    {/* Add deposit settings if they don't exist yet */}
                    {!estimateSettings?.some(s => s.setting_key === "default_deposit_percent") && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="default_deposit_percent">Default Deposit Percent</Label>
                          <Button
                            size="sm"
                            onClick={() => {
                              updateSetting.mutate({ key: "default_deposit_percent", value: editedSettings["default_deposit_percent"] || "10" });
                            }}
                            disabled={updateSetting.isPending}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                        <Input
                          id="default_deposit_percent"
                          type="number"
                          value={editedSettings["default_deposit_percent"] ?? "10"}
                          onChange={(e) => handleChange("default_deposit_percent", e.target.value)}
                          placeholder="10"
                        />
                        <p className="text-xs text-muted-foreground">Default deposit percentage for new estimates</p>
                      </div>
                    )}
                    
                    {!estimateSettings?.some(s => s.setting_key === "default_deposit_max_amount") && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="default_deposit_max_amount">Default Deposit Max Amount ($)</Label>
                          <Button
                            size="sm"
                            onClick={() => {
                              updateSetting.mutate({ key: "default_deposit_max_amount", value: editedSettings["default_deposit_max_amount"] || "1000" });
                            }}
                            disabled={updateSetting.isPending}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                        <Input
                          id="default_deposit_max_amount"
                          type="number"
                          value={editedSettings["default_deposit_max_amount"] ?? "1000"}
                          onChange={(e) => handleChange("default_deposit_max_amount", e.target.value)}
                          placeholder="1000"
                        />
                        <p className="text-xs text-muted-foreground">Maximum deposit amount (deposit = min of percent or this cap)</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Salespeople Management */}
                <SalespeopleManagement />

                {/* KPI Card Visibility */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Dashboard KPI Visibility
                    </CardTitle>
                    <CardDescription>
                      Control which KPI cards are visible on the main dashboard
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Leads Resell</Label>
                        <p className="text-xs text-muted-foreground">Show the Leads Resell KPI card on dashboard</p>
                      </div>
                      <Switch
                        checked={kpiVisibility.leads_resell_visible}
                        onCheckedChange={toggleLeadsResell}
                        disabled={isTogglingKPI}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Magazine Sales</Label>
                        <p className="text-xs text-muted-foreground">Show the Magazine Sales KPI card on dashboard</p>
                      </div>
                      <Switch
                        checked={kpiVisibility.magazine_sales_visible}
                        onCheckedChange={toggleMagazineSales}
                        disabled={isTogglingKPI}
                      />
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </TabsContent>

          {/* GHL Integrations Tab */}
          <TabsContent value="integrations" className="mt-6 space-y-6">
            {/* GHL Integration Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  GoHighLevel Integration
                </CardTitle>
                <CardDescription>
                  Enable or disable GoHighLevel (GHL) integration. When disabled, the app works in local-only mode
                  without syncing data to/from GHL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ghl-toggle">GHL Sync Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      {isGHLEnabled 
                        ? "GHL sync is enabled - data will sync with GoHighLevel" 
                        : "GHL sync is disabled - app works in local-only mode"}
                    </p>
                  </div>
                  <Switch
                    id="ghl-toggle"
                    checked={isGHLEnabled}
                    onCheckedChange={(checked) => toggleGHLIntegration.mutate(checked)}
                    disabled={toggleGHLIntegration.isPending}
                  />
                </div>
                {!isGHLEnabled && (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-amber-800 space-y-2">
                      <p><strong>Local-Only Mode Active</strong></p>
                      <p>The app is running without GoHighLevel integration. In this mode:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Contacts, opportunities, and appointments are stored locally only</li>
                        <li>No data syncs to/from GoHighLevel</li>
                        <li>Conversations and notes are not fetched from GHL</li>
                        <li>New records use local IDs (prefixed with "local_")</li>
                        <li>The sync dropdown is hidden on the dashboard</li>
                      </ul>
                      <p className="mt-2">To enable GHL sync, toggle the switch above. Ensure GHL API keys are configured in Supabase secrets.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <GHLIntegrationManager />
            <GHLFieldMappings />
          </TabsContent>

          {/* Custom Settings Tab */}
          <TabsContent value="custom" className="mt-6 space-y-6">
            {/* API Keys Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Configure API keys for external integrations. These keys are stored securely and used for AI features and email delivery.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                        {hasChanges("openai_api_key") && (
                          <Button
                            size="sm"
                            onClick={() => handleSave("openai_api_key")}
                            disabled={updateSetting.isPending}
                          >
                            {updateSetting.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save
                          </Button>
                        )}
                  </div>
                  <Input
                    id="openai_api_key"
                    type="password"
                    value={editedSettings["openai_api_key"] ?? apiKeySettings?.find(s => s.setting_key === "openai_api_key")?.setting_value ?? ""}
                    onChange={(e) => handleChange("openai_api_key", e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-muted-foreground">Used for AI-powered features like estimate generation</p>
                </div>

                {/* Resend API Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="resend_api_key">Resend API Key</Label>
                        {hasChanges("resend_api_key") && (
                          <Button
                            size="sm"
                            onClick={() => handleSave("resend_api_key")}
                            disabled={updateSetting.isPending}
                          >
                            {updateSetting.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save
                          </Button>
                        )}
                  </div>
                  <Input
                    id="resend_api_key"
                    type="password"
                    value={editedSettings["resend_api_key"] ?? apiKeySettings?.find(s => s.setting_key === "resend_api_key")?.setting_value ?? ""}
                    onChange={(e) => handleChange("resend_api_key", e.target.value)}
                    placeholder="re_..."
                  />
                  <p className="text-xs text-muted-foreground">Used for sending emails via Resend</p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-muted border rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-muted-foreground">
                    <strong>Security Note:</strong> API keys are stored encrypted in your company settings. 
                    If left empty, platform-level keys will be used as fallback.
                  </div>
                </div>
              </CardContent>
            </Card>

            <AIAnalysisSettings />
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="emails" className="mt-6">
            <EmailTemplatesManager />
          </TabsContent>

          {/* Payables & Receivables Tab */}
          <TabsContent value="payables" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payables & Receivables Settings
                </CardTitle>
                <CardDescription>
                  Configure how AR and AP amounts are calculated and displayed in the sidebar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {payablesReceivablesSettings?.map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={setting.setting_key}>Payment Focus Day</Label>
                      {hasChanges(setting.setting_key) && (
                        <Button
                          size="sm"
                          onClick={() => handleSave(setting.setting_key)}
                          disabled={updateSetting.isPending}
                        >
                          {updateSetting.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                      )}
                    </div>
                    <Select
                      value={getValue(setting)}
                      onValueChange={(value) => handleChange(setting.setting_key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select day of week" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The sidebar will show AR/AP amounts due by this day each week. If today is the focus day, it shows today's dues. Otherwise, it shows dues by the next occurrence of this day.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Management Tab */}
          <TabsContent value="chat" className="mt-6">
            <ChatManagement />
          </TabsContent>

          {/* Data Cleanup Tab */}
          <TabsContent value="cleanup" className="mt-6">
            <AdminCleanup
              opportunities={opportunities}
              contacts={contacts}
              appointments={appointments}
              users={ghlUsers}
              onDataUpdated={handleDataUpdated}
              onOpenOpportunity={handleOpenOpportunity}
            />
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  Manage Sources
                </CardTitle>
                <CardDescription>
                  Add new sources or rename existing ones across all opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setSourceDialogOpen(true)}>
                  Open Source Manager
                </Button>
              </CardContent>
            </Card>
            <SourceManagement
              contacts={contacts}
              open={sourceDialogOpen}
              onOpenChange={setSourceDialogOpen}
            />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Create users and manage their roles and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setUserDialogOpen(true)}>
                  Open User Manager
                </Button>
              </CardContent>
            </Card>
            <UserManagement
              open={userDialogOpen}
              onOpenChange={setUserDialogOpen}
            />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Filters
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearAuditFilters}>
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Table</Label>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All tables" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tables</SelectItem>
                        {distinctTables?.map((table) => (
                          <SelectItem key={table} value={table}>
                            {table}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actions</SelectItem>
                        <SelectItem value="INSERT">INSERT</SelectItem>
                        <SelectItem value="UPDATE">UPDATE</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="user-filter">User Email</Label>
                    <Input
                      id="user-filter"
                      placeholder="Search by email..."
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  Showing {logs?.length || 0} records (max 500)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Table</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No audit logs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          logs?.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(log.changed_at), "MMM d, yyyy h:mm a")}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {log.user_email || "System"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.table_name}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getActionBadgeVariant(log.action) as any}>
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate">
                                {log.description || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Audit Log Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>Audit Log Details</SheetTitle>
            <SheetDescription>
              {selectedLog?.description || "Change details"}
            </SheetDescription>
          </SheetHeader>
          {selectedLog && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Date/Time</Label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.changed_at), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="font-medium">{selectedLog.user_email || "System"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Table</Label>
                  <p className="font-medium">{selectedLog.table_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <Badge variant={getActionBadgeVariant(selectedLog.action) as any}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Record ID</Label>
                  <p className="font-mono text-sm">{selectedLog.record_id}</p>
                </div>

                {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Changes</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div>
                    <Label className="text-muted-foreground">Previous Values</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div>
                    <Label className="text-muted-foreground">New Values</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
