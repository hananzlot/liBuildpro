import React, { useState, useEffect, useCallback } from "react";
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
import { Settings, Mail, Building, Save, Loader2, AlertTriangle, Wrench, Pencil, Users, FileText, MessageSquare, DollarSign, Database, Link, Sparkles, Key, CheckCircle2, XCircle, ChevronDown, Target, GitBranch, Plus, Trash2, Eye, EyeOff, ExternalLink, Calendar, Link2, FileSignature } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AdminCleanup } from "@/components/dashboard/AdminCleanup";
import { JunkContactsCleanup } from "@/components/admin/JunkContactsCleanup";
import { SourceManagement } from "@/components/dashboard/SourceManagement";
import { UserManagement } from "@/components/dashboard/UserManagement";
import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager";

import { ChatManagement } from "@/components/admin/ChatManagement";
import { LogoUpload } from "@/components/admin/LogoUpload";
import { GHLIntegrationManager } from "@/components/admin/GHLIntegrationManager";
import { AIAnalysisSettings } from "@/components/admin/AIAnalysisSettings";
import { AIEstimatorSettings } from "@/components/admin/AIEstimatorSettings";
import { GHLFieldMappings } from "@/components/admin/GHLFieldMappings";
import { GoogleCalendarManager } from "@/components/admin/GoogleCalendarManager";
import { QuickBooksIntegration } from "@/components/admin/QuickBooksIntegration";
import { useGHLMode } from "@/hooks/useGHLMode";
import { ShortLinksManager } from "@/components/admin/ShortLinksManager";
import { StageBadgeMappingsEditor } from "@/components/admin/StageBadgeMappingsEditor";
import { ComplianceTemplatesManager } from "@/components/admin/ComplianceTemplatesManager";
import { BankManagement } from "@/components/admin/BankManagement";
import { useKPIVisibility } from "@/hooks/useKPIVisibility";
import { useQuickBooksCallback } from "@/hooks/useQuickBooksCallback";
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
import { Filter, X, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Grouped tab configuration for the dropdown menu
const TAB_GROUPS = [
  {
    label: "Core Settings",
    tabs: [
      { value: "settings", label: "General", icon: Settings },
      { value: "emails", label: "Emails", icon: Mail },
      { value: "compliance", label: "Compliance", icon: FileSignature },
      { value: "chat", label: "Chat", icon: MessageSquare },
    ],
  },
  {
    label: "Integrations",
    tabs: [
      { value: "integrations", label: "GoHighLevel", icon: Link },
      { value: "quickbooks", label: "QuickBooks", icon: DollarSign },
      { value: "custom", label: "APIs & AI", icon: Sparkles },
    ],
  },
  {
    label: "Sales & Operations",
    tabs: [
      { value: "sources", label: "Lead Sources", icon: Pencil },
      { value: "shortlinks", label: "Short Links", icon: Link2 },
      { value: "payables", label: "AR/AP", icon: DollarSign },
    ],
  },
  {
    label: "System",
    tabs: [
      { value: "users", label: "Users", icon: Users },
      { value: "cleanup", label: "Data Cleanup", icon: Wrench },
      { value: "audit", label: "Audit Log", icon: FileText },
    ],
  },
];

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
  
  // Handle QuickBooks OAuth callback - must run before company context check
  useQuickBooksCallback();
  
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [testingApiKey, setTestingApiKey] = useState<string | null>(null);
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendKeyConfigured, setResendKeyConfigured] = useState<boolean | null>(null);
  const [savingResendKey, setSavingResendKey] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  
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
  
  // Pipeline configuration state
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [newStageName, setNewStageName] = useState("");

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

  // Check if Resend API key is configured for this company
  const { data: resendKeyStatus, refetch: refetchResendKeyStatus } = useQuery({
    queryKey: ["resend-key-status", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("setting_key")
        .eq("company_id", companyId)
        .eq("setting_key", "resend_api_key_encrypted")
        .maybeSingle();
      return { isConfigured: !!data };
    },
    enabled: isAdmin && !!companyId && activeTab === "emails",
  });

  // Update state when resend key status changes
  React.useEffect(() => {
    if (resendKeyStatus) {
      setResendKeyConfigured(resendKeyStatus.isConfigured);
    }
  }, [resendKeyStatus]);
  
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

  const handleSaveResendKey = async () => {
    if (!resendApiKey.trim() || !companyId) {
      toast.error("Please enter a valid Resend API key");
      return;
    }

    setSavingResendKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-resend-key", {
        body: { apiKey: resendApiKey.trim(), companyId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || "Resend API key saved successfully!");
        setResendApiKey("");
        setResendKeyConfigured(true);
        refetchResendKeyStatus();
      } else {
        toast.error(data?.error || "Failed to save Resend API key");
      }
    } catch (err) {
      console.error("Error saving Resend key:", err);
      toast.error(`Failed to save API key: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingResendKey(false);
    }
  };

  const handleTestResendKey = async () => {
    const keyToTest = resendApiKey.trim();
    if (!keyToTest || !companyId) {
      toast.error("Please enter a Resend API key to test");
      return;
    }

    setTestingApiKey("resend");
    try {
      const { data, error } = await supabase.functions.invoke("store-resend-key", {
        body: { apiKey: keyToTest, companyId, testOnly: true },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || "Resend API key is valid!");
      } else {
        toast.error(data?.error || "Invalid Resend API key");
      }
    } catch (err) {
      console.error("Error testing Resend key:", err);
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

  // Parse pipeline stages from settings - moved before early returns
  const getDefaultPipelineStages = React.useCallback((): string[] => {
    if (!settings) return [];
    const stagesSetting = settings.find(s => s.setting_key === "pipeline_stages");
    if (stagesSetting?.setting_value) {
      try {
        return JSON.parse(stagesSetting.setting_value);
      } catch {
        return stagesSetting.setting_value.split(",").map(s => s.trim());
      }
    }
    // Default stages
    return ["Lead", "Contacted", "Appointment Set", "2nd Appointment", "Estimate Prepared", "Proposal Sent", "Close to Sale", "Won", "Lost/DNC"];
  }, [settings]);

  // Initialize pipeline stages when settings load
  React.useEffect(() => {
    if (settings && pipelineStages.length === 0) {
      setPipelineStages(getDefaultPipelineStages());
    }
  }, [settings, getDefaultPipelineStages]);

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
    ["resend_from_email", "resend_from_name", "notification_email"].includes(s.setting_key)
  );

  const companySettings = settings?.filter((s) =>
    ["company_name", "company_address", "company_phone", "company_website", "license_type", "license_number", "license_holder_name"].includes(s.setting_key)
  );

  const portalSettings = settings?.filter((s) =>
    ["portal_upload_limit_mb", "app_base_url"].includes(s.setting_key)
  );

  const estimateSettings = settings?.filter((s) =>
    ["default_terms_and_conditions", "default_markup_percent", "default_deposit_percent", "default_deposit_max_amount", "estimate_expiration_days", "estimate_plans_max_size_mb"].includes(s.setting_key)
  );

  const opportunityStageSettings = settings?.filter((s) =>
    ["stage_estimate_prepared", "stage_proposal_sent"].includes(s.setting_key)
  );

  const pipelineSettings = settings?.filter((s) =>
    ["default_pipeline_name", "pipeline_stages"].includes(s.setting_key)
  );

  const payablesReceivablesSettings = settings?.filter((s) =>
    ["payment_focus_day"].includes(s.setting_key)
  );

  // Update stages when settings change
  const handleAddStage = () => {
    if (newStageName.trim() && !pipelineStages.includes(newStageName.trim())) {
      setPipelineStages([...pipelineStages, newStageName.trim()]);
      setNewStageName("");
    }
  };

  const handleRemoveStage = (index: number) => {
    setPipelineStages(pipelineStages.filter((_, i) => i !== index));
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const newStages = [...pipelineStages];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newStages.length) {
      [newStages[index], newStages[newIndex]] = [newStages[newIndex], newStages[index]];
      setPipelineStages(newStages);
    }
  };

  const handleSavePipelineStages = () => {
    updateSetting.mutate({ key: "pipeline_stages", value: JSON.stringify(pipelineStages) });
  };

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
          {/* Grouped Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/30 rounded-lg border">
            {TAB_GROUPS.map((group, groupIndex) => (
              <React.Fragment key={group.label}>
                {groupIndex > 0 && <Separator orientation="vertical" className="h-8 hidden md:block" />}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground mr-1 hidden lg:inline">
                    {group.label}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {group.tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.value;
                      return (
                        <Button
                          key={tab.value}
                          variant={isActive ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handleTabChange(tab.value)}
                          className={`flex items-center gap-1.5 h-8 ${
                            isActive ? "" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-xs">{tab.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">

                {/* Company Logo */}
                <LogoUpload />

                {/* Company Settings - Collapsible */}
                <Collapsible defaultOpen={false} className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Building className="h-5 w-5" />
                            Company Settings
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          General company information used in emails and documents
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {companySettings?.map(renderSettingField)}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Portal Settings - Collapsible */}
                <Collapsible defaultOpen={false} className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Customer Portal Settings
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          Configure settings for the customer portal experience. The App Base URL is used for all portal links in emails (e.g., your custom domain).
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {portalSettings?.map(renderSettingField)}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Estimate Settings - Collapsible */}
                <Collapsible defaultOpen={false} className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Estimate Settings
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          Default settings for new estimates
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
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
                              type="text"
                              inputMode="decimal"
                              value={editedSettings["default_deposit_percent"] ?? "10"}
                              onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) handleChange("default_deposit_percent", val); }}
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
                              type="text"
                              inputMode="decimal"
                              value={editedSettings["default_deposit_max_amount"] ?? "1000"}
                              onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) handleChange("default_deposit_max_amount", val); }}
                              placeholder="1000"
                            />
                            <p className="text-xs text-muted-foreground">Maximum deposit amount (deposit = min of percent or this cap)</p>
                          </div>
                        )}
                        
                        {/* Estimate Expiration Days */}
                        {!estimateSettings?.some(s => s.setting_key === "estimate_expiration_days") && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="estimate_expiration_days">Estimate Expiration (Days)</Label>
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateSetting.mutate({ key: "estimate_expiration_days", value: editedSettings["estimate_expiration_days"] || "7" });
                                }}
                                disabled={updateSetting.isPending}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </div>
                            <Input
                              id="estimate_expiration_days"
                              type="text"
                              inputMode="numeric"
                              value={editedSettings["estimate_expiration_days"] ?? "7"}
                              onChange={(e) => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) handleChange("estimate_expiration_days", val); }}
                              placeholder="7"
                            />
                            <p className="text-xs text-muted-foreground">Number of days until a proposal expires (from date sent). Default: 7 days</p>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Opportunity Stage Names */}
                <Collapsible className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Opportunity Stage Names
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          Customize stage names for estimate and proposal workflows
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {opportunityStageSettings?.map((setting) => renderSettingField(setting))}
                        
                        {/* Estimate Prepared Stage */}
                        {!opportunityStageSettings?.some(s => s.setting_key === "stage_estimate_prepared") && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="stage_estimate_prepared">Estimate Prepared Stage</Label>
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateSetting.mutate({ key: "stage_estimate_prepared", value: editedSettings["stage_estimate_prepared"] || "Estimate Prepared" });
                                }}
                                disabled={updateSetting.isPending}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </div>
                            <Input
                              id="stage_estimate_prepared"
                              value={editedSettings["stage_estimate_prepared"] ?? "Estimate Prepared"}
                              onChange={(e) => handleChange("stage_estimate_prepared", e.target.value)}
                              placeholder="Estimate Prepared"
                            />
                            <p className="text-xs text-muted-foreground">Stage name set when an estimate is created from an opportunity</p>
                          </div>
                        )}
                        
                        {/* Proposal Sent Stage */}
                        {!opportunityStageSettings?.some(s => s.setting_key === "stage_proposal_sent") && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="stage_proposal_sent">Proposal Sent Stage</Label>
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateSetting.mutate({ key: "stage_proposal_sent", value: editedSettings["stage_proposal_sent"] || "Proposal Sent" });
                                }}
                                disabled={updateSetting.isPending}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </div>
                            <Input
                              id="stage_proposal_sent"
                              value={editedSettings["stage_proposal_sent"] ?? "Proposal Sent"}
                              onChange={(e) => handleChange("stage_proposal_sent", e.target.value)}
                              placeholder="Proposal Sent"
                            />
                            <p className="text-xs text-muted-foreground">Stage name set when a proposal email is sent</p>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Pipeline Configuration */}
                <Collapsible className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <GitBranch className="h-5 w-5" />
                            Pipeline Configuration
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          Configure default pipeline name and stages for opportunities
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-6 pt-0">
                        {/* Default Pipeline Name */}
                        {pipelineSettings?.find(s => s.setting_key === "default_pipeline_name") ? (
                          renderSettingField(pipelineSettings.find(s => s.setting_key === "default_pipeline_name")!)
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="default_pipeline_name">Default Pipeline Name</Label>
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateSetting.mutate({ key: "default_pipeline_name", value: editedSettings["default_pipeline_name"] || "Main" });
                                }}
                                disabled={updateSetting.isPending}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </div>
                            <Input
                              id="default_pipeline_name"
                              value={editedSettings["default_pipeline_name"] ?? "Main"}
                              onChange={(e) => handleChange("default_pipeline_name", e.target.value)}
                              placeholder="Main"
                            />
                            <p className="text-xs text-muted-foreground">The default pipeline name for new opportunities</p>
                          </div>
                        )}

                        <Separator />

                        {/* Pipeline Stages */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Pipeline Stages</Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                Define the stages in your sales pipeline (in order)
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={handleSavePipelineStages}
                              disabled={updateSetting.isPending}
                            >
                              {updateSetting.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Save className="h-3 w-3 mr-1" />
                              )}
                              Save Stages
                            </Button>
                          </div>

                          {/* Stage List */}
                          <div className="space-y-2">
                            {pipelineStages.map((stage, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30"
                              >
                                <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                                <Input
                                  value={stage}
                                  onChange={(e) => {
                                    const newStages = [...pipelineStages];
                                    newStages[index] = e.target.value;
                                    setPipelineStages(newStages);
                                  }}
                                  className="flex-1"
                                />
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMoveStage(index, "up")}
                                    disabled={index === 0}
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMoveStage(index, "down")}
                                    disabled={index === pipelineStages.length - 1}
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveStage(index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add New Stage */}
                          <div className="flex gap-2">
                            <Input
                              value={newStageName}
                              onChange={(e) => setNewStageName(e.target.value)}
                              placeholder="New stage name..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddStage();
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              onClick={handleAddStage}
                              disabled={!newStageName.trim()}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>

                          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                            <strong>Note:</strong> These stages define the default flow for new opportunities in your pipeline. 
                            Common stages include Lead → Contacted → Appointment → Proposal → Won/Lost.
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Stage Badge Mappings */}
                <StageBadgeMappingsEditor />

                <Collapsible defaultOpen={false} className="group">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Dashboard KPI Visibility
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                        <CardDescription>
                          Control which KPI cards are visible on the main dashboard
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
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
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

              </div>
            )}
          </TabsContent>

          {/* GHL Integrations Tab */}
          <TabsContent value="integrations" className="mt-6 space-y-6">
            {/* GHL Integration Toggle */}
            <Collapsible defaultOpen={false} className="group">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        GoHighLevel Integration
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CardTitle>
                    <CardDescription>
                      Enable or disable GoHighLevel (GHL) integration. When disabled, the app works in local-only mode
                      without syncing data to/from GHL.
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
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
                </CollapsibleContent>
              </Card>
            </Collapsible>
            <GHLIntegrationManager />
            <GHLFieldMappings />
          </TabsContent>

          {/* Custom Settings Tab */}
          <TabsContent value="custom" className="mt-6 space-y-6">
            {/* API Keys Settings */}
            <Collapsible defaultOpen={false} className="group">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Keys
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CardTitle>
                    <CardDescription>
                      Configure API keys for external integrations. These keys are stored securely and used for AI features and email delivery.
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {/* OpenAI API Key */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testApiKey("openai")}
                            disabled={testingApiKey === "openai" || !((editedSettings["openai_api_key"] ?? apiKeySettings?.find(s => s.setting_key === "openai_api_key")?.setting_value))}
                          >
                            {testingApiKey === "openai" ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Test
                          </Button>
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

                    {/* Note: Resend API Key has been moved to the Emails tab with encrypted storage */}
                    {/* Note: Google Calendar credentials have been moved to the GoogleCalendarManager component */}

                    <div className="flex items-start gap-2 p-3 bg-muted border rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-muted-foreground">
                        <strong>Security Note:</strong> API keys are stored encrypted in your company settings. 
                        If left empty, platform-level keys will be used as fallback.
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <AIEstimatorSettings />
            
            <AIAnalysisSettings />
            
            {/* Google Calendar Connections */}
            <GoogleCalendarManager />
          </TabsContent>

          {/* QuickBooks Tab */}
          <TabsContent value="quickbooks" className="mt-6 space-y-6">
            <QuickBooksIntegration />
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="mt-6 space-y-6">
            {/* Resend API Configuration - Collapsible */}
            <Collapsible defaultOpen={false} className="group">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Resend API Configuration
                      </span>
                      <div className="flex items-center gap-2">
                        {resendKeyConfigured === true && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        )}
                        {resendKeyConfigured === false && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Configured
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Configure your Resend API key for email delivery. Get your API key from{" "}
                      <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        resend.com/api-keys
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="resend_api_key_new">Resend API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="resend_api_key_new"
                            type={showResendKey ? "text" : "password"}
                            value={resendApiKey}
                            onChange={(e) => setResendApiKey(e.target.value)}
                            placeholder={resendKeyConfigured ? "Enter new key to update..." : "re_..."}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowResendKey(!showResendKey)}
                          >
                            {showResendKey ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleTestResendKey}
                          disabled={testingApiKey === "resend" || !resendApiKey.trim()}
                        >
                          {testingApiKey === "resend" ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          onClick={handleSaveResendKey}
                          disabled={savingResendKey || !resendApiKey.trim()}
                        >
                          {savingResendKey ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {resendKeyConfigured 
                          ? "Your Resend API key is configured. Enter a new key above to update it."
                          : "Enter your Resend API key to enable email sending for proposals and notifications."}
                      </p>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-muted border rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-muted-foreground">
                        <strong>Security:</strong> Your API key is encrypted and stored securely. 
                        It's never exposed in your browser or logs.
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Email Settings (Resend) */}
            <Collapsible defaultOpen={false} className="group">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Sender Settings
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CardTitle>
                    <CardDescription>
                      Configure email sending for proposals and notifications. Make sure your domain is verified at{" "}
                      <a
                        href="https://resend.com/domains"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        resend.com/domains
                      </a>
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {emailSettings?.map(renderSettingField)}

                    {/* Add notification_email if it doesn't exist */}
                    {!emailSettings?.some(s => s.setting_key === "notification_email") && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="notification_email">Notification Email(s)</Label>
                          <Button
                            size="sm"
                            onClick={() => {
                              updateSetting.mutate({ key: "notification_email", value: editedSettings["notification_email"] || "" });
                            }}
                            disabled={updateSetting.isPending || !editedSettings["notification_email"]}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                        <Input
                          id="notification_email"
                          value={editedSettings["notification_email"] ?? ""}
                          onChange={(e) => handleChange("notification_email", e.target.value)}
                          placeholder="admin@company.com, sales@company.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Comma-separated list of emails to receive proposal accepted/declined notifications
                        </p>
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-amber-800">
                        <strong>Important:</strong> The "From Email" must use a domain you've verified in Resend.
                        For example, if you verified <code>caprobuilders.com</code>, use an email like{" "}
                        <code>proposals@caprobuilders.com</code>.
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Email Templates */}
            <EmailTemplatesManager />
          </TabsContent>

          {/* Payables & Receivables Tab */}
          <TabsContent value="payables" className="mt-6">
            <Collapsible defaultOpen={false} className="group">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Payables & Receivables Settings
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CardTitle>
                    <CardDescription>
                      Configure how AR and AP amounts are calculated and displayed in the sidebar
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-6 pt-0">
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
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Bank Management */}
            <BankManagement />
          </TabsContent>

          {/* Compliance Templates Tab */}
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTemplatesManager />
          </TabsContent>

          {/* Chat Management Tab */}
          <TabsContent value="chat" className="mt-6">
            <ChatManagement />
          </TabsContent>


          {/* Short Links Tab */}
          <TabsContent value="shortlinks" className="mt-6">
            <ShortLinksManager />
          </TabsContent>

          {/* Data Cleanup Tab */}
          <TabsContent value="cleanup" className="mt-6 space-y-6">
            <JunkContactsCleanup />
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
