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
import { InsuranceDocuments } from "@/components/admin/InsuranceDocuments";
import { LicenseCertificates } from "@/components/admin/LicenseCertificates";
import { SocialMediaLinks } from "@/components/admin/SocialMediaLinks";
import { BankManagement } from "@/components/admin/BankManagement";
import { ProjectStatusesManager } from "@/components/admin/ProjectStatusesManager";
import { RoleAnalyticsDefaults } from "@/components/admin/RoleAnalyticsDefaults";
import { CompanyEmailDomainSetup } from "@/components/company-settings/CompanyEmailDomainSetup";
import { OnboardingPromptBanner } from "@/components/onboarding/OnboardingPromptBanner";
import { EdgeFunctionLogs } from "@/components/admin/EdgeFunctionLogs";
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

// Tab values used for routing - tab bar removed, navigation via sidebar sub-menu
const ALL_TAB_VALUES = [
  "settings", "emails", "compliance", "chat",
  "integrations", "quickbooks", "custom",
  "sources", "shortlinks", "payables",
  "users", "reports", "cleanup", "audit",
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
  archived_at?: string;
}

export default function AdminSettings() {
  const { isAdmin, isLoading: authLoading, companyId } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "settings";
  const categoryParam = searchParams.get("category") as "company" | "sales" | "operations" | "users" | "emails" | null;
  const { isGHLEnabled } = useGHLMode();
  const { visibility: kpiVisibility, toggleLeadsResell, toggleMagazineSales, isToggling: isTogglingKPI } = useKPIVisibility();
  
  // Handle QuickBooks OAuth callback - must run before company context check
  useQuickBooksCallback();
  
  const [settingsCategory, setSettingsCategoryState] = useState<"company" | "sales" | "operations" | "users" | "emails">(categoryParam || "company");
  
  // Sync category from URL params
  const setSettingsCategory = (cat: "company" | "sales" | "operations" | "users" | "emails") => {
    setSettingsCategoryState(cat);
  };
  
  // Update category when URL param changes
  useEffect(() => {
    if (categoryParam && categoryParam !== settingsCategory) {
      setSettingsCategoryState(categoryParam);
    }
  }, [categoryParam]);
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [testingApiKey, setTestingApiKey] = useState<string | null>(null);
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendKeyConfigured, setResendKeyConfigured] = useState<boolean | null>(null);
  const [savingResendKey, setSavingResendKey] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  
  // Source management dialog state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  
  // User management dialog state (kept for non-inline usage from Index.tsx)
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  
  // Audit log state
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 50;
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  
  // Pipeline configuration state - now using UUID-based stages
  interface PipelineStageEdit {
    id: string | null; // null for new stages
    name: string;
    position: number;
  }
  const [pipelineStagesEdit, setPipelineStagesEdit] = useState<PipelineStageEdit[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [pipelineStagesLoaded, setPipelineStagesLoaded] = useState(false);
  const [savingPipelineStages, setSavingPipelineStages] = useState(false);

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
  
  // Audit log max records setting
  const { data: maxRecordsSetting, isLoading: maxRecordsLoading } = useQuery({
    queryKey: ["audit-max-records-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "audit_log_max_records")
        .single();
      if (error) throw error;
      return data?.setting_value || "50000";
    },
    enabled: isAdmin && activeTab === "audit",
  });

  const [maxRecords, setMaxRecords] = useState("50000");
  useEffect(() => {
    if (maxRecordsSetting) setMaxRecords(maxRecordsSetting);
  }, [maxRecordsSetting]);

  const updateMaxRecordsMutation = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ setting_value: val, updated_at: new Date().toISOString() })
        .eq("setting_key", "audit_log_max_records");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-max-records-setting"] });
      toast.success("Max records setting updated");
    },
    onError: () => toast.error("Failed to update setting"),
  });

  const archiveNowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("archive_old_audit_logs", {
        p_max_records: parseInt(maxRecords, 10),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["archived-audit-logs"] });
      toast.success(`Archived ${count} log records`);
    },
    onError: () => toast.error("Failed to archive logs"),
  });

  // Archived audit logs state
  const [archivedPage, setArchivedPage] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch super_admin user IDs to hide their activity from audit logs
  const { data: superAdminUserIds = [] } = useQuery({
    queryKey: ["super-admin-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      if (error) throw error;
      return data.map((r) => r.user_id);
    },
    enabled: isAdmin && activeTab === "audit",
    staleTime: 5 * 60 * 1000,
  });

  // Audit log queries
  const { data: auditResult, isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", companyId, startDate, endDate, tableFilter, actionFilter, userFilter, auditPage],
    queryFn: async () => {
      const from = auditPage * AUDIT_PAGE_SIZE;
      const to = from + AUDIT_PAGE_SIZE - 1;
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .order("changed_at", { ascending: false })
        .range(from, to);
      if (superAdminUserIds.length > 0) {
        query = query.not("user_id", "in", `(${superAdminUserIds.join(",")})`);
      }

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

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as AuditLog[], total: count || 0 };
    },
    enabled: isAdmin && activeTab === "audit" && !!companyId,
  });

  const logs = auditResult?.logs;
  const auditTotal = auditResult?.total || 0;
  const auditTotalPages = Math.ceil(auditTotal / AUDIT_PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setAuditPage(0);
    setArchivedPage(0);
  }, [startDate, endDate, tableFilter, actionFilter, userFilter]);

  // Archived audit logs query
  const { data: archivedResult, isLoading: archivedLoading } = useQuery({
    queryKey: ["archived-audit-logs", companyId, startDate, endDate, tableFilter, actionFilter, userFilter, archivedPage],
    queryFn: async () => {
      const from = archivedPage * AUDIT_PAGE_SIZE;
      const to = from + AUDIT_PAGE_SIZE - 1;
      let query = supabase
        .from("archived_audit_logs")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .order("changed_at", { ascending: false })
        .range(from, to);
      if (superAdminUserIds.length > 0) {
        query = query.not("user_id", "in", `(${superAdminUserIds.join(",")})`);
      }

      if (startDate) query = query.gte("changed_at", `${startDate}T00:00:00`);
      if (endDate) query = query.lte("changed_at", `${endDate}T23:59:59`);
      if (tableFilter && tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter && actionFilter !== "all") query = query.eq("action", actionFilter);
      if (userFilter) query = query.ilike("user_email", `%${userFilter}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as AuditLog[], total: count || 0 };
    },
    enabled: isAdmin && activeTab === "audit" && !!companyId && showArchived,
  });

  const archivedLogs = archivedResult?.logs;
  const archivedTotal = archivedResult?.total || 0;
  const archivedTotalPages = Math.ceil(archivedTotal / AUDIT_PAGE_SIZE);

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
      // Enforce max 35 MB upload limit
      if (key === "portal_upload_limit_mb") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
          toast.error("Upload limit must be a positive number");
          return;
        }
        if (num > 35) {
          toast.error("Upload limit cannot exceed 35 MB");
          return;
        }
      }
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

  // Fetch pipeline stages from the new UUID-based table
  const { data: pipelineStagesData, refetch: refetchPipelineStages } = useQuery({
    queryKey: ["pipeline-stages-admin", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("company_id", companyId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !!companyId,
  });

  // Initialize pipeline stages when data loads
  React.useEffect(() => {
    if (pipelineStagesData && !pipelineStagesLoaded) {
      if (pipelineStagesData.length > 0) {
        setPipelineStagesEdit(pipelineStagesData.map((s, idx) => ({
          id: s.id,
          name: s.name,
          position: s.position ?? idx,
        })));
      } else if (settings) {
        // Fallback to legacy settings
        const stagesSetting = settings.find(s => s.setting_key === "pipeline_stages");
        if (stagesSetting?.setting_value) {
          let names: string[] = [];
          try {
            names = JSON.parse(stagesSetting.setting_value);
          } catch {
            names = stagesSetting.setting_value.split(",").map(s => s.trim());
          }
          setPipelineStagesEdit(names.map((name, idx) => ({
            id: null,
            name,
            position: idx,
          })));
        } else {
          // Default stages for new companies
          const defaults = ["Lead", "Contacted", "Appointment Set", "2nd Appointment", "Estimate Prepared", "Proposal Sent", "Close to Sale", "Won", "Lost/DNC"];
          setPipelineStagesEdit(defaults.map((name, idx) => ({
            id: null,
            name,
            position: idx,
          })));
        }
      }
      setPipelineStagesLoaded(true);
    }
  }, [pipelineStagesData, settings, pipelineStagesLoaded]);

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

  // Update stages handlers using the new structure
  const handleAddStage = () => {
    if (newStageName.trim() && !pipelineStagesEdit.some(s => s.name.toLowerCase() === newStageName.trim().toLowerCase())) {
      setPipelineStagesEdit([...pipelineStagesEdit, { 
        id: null, 
        name: newStageName.trim(), 
        position: pipelineStagesEdit.length 
      }]);
      setNewStageName("");
    }
  };

  const handleRemoveStage = (index: number) => {
    setPipelineStagesEdit(pipelineStagesEdit.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })));
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const newStages = [...pipelineStagesEdit];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newStages.length) {
      [newStages[index], newStages[newIndex]] = [newStages[newIndex], newStages[index]];
      // Update positions
      setPipelineStagesEdit(newStages.map((s, i) => ({ ...s, position: i })));
    }
  };

  const handleSavePipelineStages = async () => {
    if (!companyId) return;
    setSavingPipelineStages(true);
    
    try {
      // Get current stages from DB to compare
      const { data: existingStages } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("company_id", companyId);
      
      const existingById = new Map((existingStages || []).map(s => [s.id, s]));
      const editedIds = new Set(pipelineStagesEdit.filter(s => s.id).map(s => s.id));
      
      // Find deleted stages
      const deletedIds = (existingStages || [])
        .filter(s => !editedIds.has(s.id))
        .map(s => s.id);
      
      // Delete removed stages
      if (deletedIds.length > 0) {
        await supabase.from("pipeline_stages").delete().in("id", deletedIds);
      }
      
      // Upsert all current stages
      for (const stage of pipelineStagesEdit) {
        if (stage.id) {
          // Update existing stage (triggers auto-migration if name changed)
          await supabase
            .from("pipeline_stages")
            .update({ name: stage.name, position: stage.position })
            .eq("id", stage.id);
        } else {
          // Insert new stage (triggers auto-assign UUID to matching opportunities)
          await supabase
            .from("pipeline_stages")
            .insert({ 
              company_id: companyId, 
              name: stage.name, 
              position: stage.position 
            });
        }
      }
      
      // Also update company_settings for backward compatibility
      await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: "pipeline_stages",
          setting_value: JSON.stringify(pipelineStagesEdit.map(s => s.name)),
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });
      
      toast.success("Pipeline stages saved. Opportunities will reflect name changes automatically.");
      
      // Refetch to get new IDs for inserted stages
      await refetchPipelineStages();
      setPipelineStagesLoaded(false); // Force reload
      queryClient.invalidateQueries({ queryKey: ["company-pipeline-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
    } catch (err) {
      console.error("Error saving pipeline stages:", err);
      toast.error(`Failed to save pipeline stages: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingPipelineStages(false);
    }
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
        {/* Onboarding prompt for incomplete setup */}
        <OnboardingPromptBanner />
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Company Settings
          </h1>
          <p className="text-muted-foreground">
            Manage application settings, users, data, and view audit logs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar navigation */}
                <div className="flex md:flex-col gap-1 md:w-48 md:shrink-0">
                  <Button
                    variant={settingsCategory === "company" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSettingsCategory("company")}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Company Profile
                  </Button>
                  <Button
                    variant={settingsCategory === "sales" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSettingsCategory("sales")}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Sales & Pipeline
                  </Button>
                  <Button
                    variant={settingsCategory === "operations" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSettingsCategory("operations")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Operations & Display
                  </Button>
                  <Button
                    variant={settingsCategory === "users" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSettingsCategory("users")}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </Button>
                  <Button
                    variant={settingsCategory === "emails" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSettingsCategory("emails")}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Emails
                  </Button>
                </div>

                {/* Content area */}
                <div className="flex-1 space-y-4">
                  {settingsCategory === "company" && (
                    <>
                      <LogoUpload />
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
                      <SocialMediaLinks />
                      <InsuranceDocuments />
                      <LicenseCertificates />

                      {/* Customer Portal Settings */}
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
                    </>
                  )}

                  {settingsCategory === "sales" && (
                    <>
                      {/* Pipeline Configuration */}
                      <Collapsible defaultOpen={false} className="group">
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
                              {pipelineSettings?.find(s => s.setting_key === "default_pipeline_name") ? (
                                renderSettingField(pipelineSettings.find(s => s.setting_key === "default_pipeline_name")!)
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label>Default Pipeline Name</Label>
                                  </div>
                                  <Input placeholder="Loading..." disabled />
                                </div>
                              )}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                      {/* Opportunity Stage Names */}
                      <Collapsible defaultOpen={false} className="group">
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                              <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <GitBranch className="h-5 w-5" />
                                  Opportunity Stage Names
                                </span>
                                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </CardTitle>
                              <CardDescription>
                                Customize the names for key pipeline stages
                              </CardDescription>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="space-y-4 pt-0">
                              {opportunityStageSettings?.map(renderSettingField)}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                      <StageBadgeMappingsEditor />
                      {/* Estimate Settings */}
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
                                Default values for estimates and proposals
                              </CardDescription>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="space-y-4 pt-0">
                              {estimateSettings?.map(renderSettingField)}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </>
                  )}

                  {settingsCategory === "operations" && (
                    <>
                      <ProjectStatusesManager />
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
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </>
                  )}

                  {settingsCategory === "users" && (
                    <UserManagement
                      open={true}
                      onOpenChange={() => {}}
                      inline
                    />
                  )}

                  {settingsCategory === "emails" && (
                    <>
                      {companyId && <CompanyEmailDomainSetup companyId={companyId} />}

                      <Collapsible defaultOpen={false} className="group">
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                              <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Key className="h-5 w-5" />
                                  Legacy Resend API Key (Optional)
                                </span>
                                <div className="flex items-center gap-2">
                                  {resendKeyConfigured === true && (
                                    <Badge variant="default" className="bg-primary">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Configured
                                    </Badge>
                                  )}
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                              </CardTitle>
                              <CardDescription>
                                Only needed if you want to use your own Resend API key instead of the platform key.
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
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

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

                      <EmailTemplatesManager />
                    </>
                  )}
                </div>
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

          {/* Emails tab now redirects to settings/company - kept for backward compat */}
          <TabsContent value="emails" className="mt-6 space-y-6">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Email settings have moved to <strong>Company Profile</strong> under the General settings tab.
              </CardContent>
            </Card>
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

                    {/* Default Lead Cost % Setting */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="default_lead_cost_percent">Default Lead Cost %</Label>
                        {hasChanges("default_lead_cost_percent") && (
                          <Button
                            size="sm"
                            onClick={() => handleSave("default_lead_cost_percent")}
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
                        id="default_lead_cost_percent"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={editedSettings["default_lead_cost_percent"] ?? settings?.find(s => s.setting_key === "default_lead_cost_percent")?.setting_value ?? "18"}
                        onChange={(e) => handleChange("default_lead_cost_percent", e.target.value)}
                        placeholder="18"
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default lead cost percentage applied to new projects. Can be overridden per project.
                      </p>
                    </div>
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

          {/* Reports / Role Analytics Defaults Tab */}
          <TabsContent value="reports" className="mt-6">
            <RoleAnalyticsDefaults />
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




          {/* Audit Log Tab */}
          <TabsContent value="audit" className="mt-6 space-y-6">
            {/* Filters + Archive Settings - side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Filter className="h-4 w-4" /> Filters
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={clearAuditFilters}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Table</Label>
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
                      <Label className="text-xs">Action</Label>
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
                      <Label htmlFor="user-filter" className="text-xs">User Email</Label>
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

              <Card className="lg:w-72">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Auto-Archive
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="max-records" className="text-xs">Max Active Records</Label>
                    <Input
                      id="max-records"
                      type="number"
                      min={1000}
                      max={500000}
                      step={1000}
                      value={maxRecords}
                      onChange={(e) => setMaxRecords(e.target.value)}
                      disabled={maxRecordsLoading}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => updateMaxRecordsMutation.mutate(maxRecords)}
                      disabled={updateMaxRecordsMutation.isPending || maxRecords === maxRecordsSetting}
                    >
                      {updateMaxRecordsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => archiveNowMutation.mutate()}
                      disabled={archiveNowMutation.isPending}
                    >
                      {archiveNowMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Database className="h-4 w-4 mr-1" />
                      )}
                      Archive
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Oldest logs auto-archive when exceeding {parseInt(maxRecords).toLocaleString()} records.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>
                      Showing {(auditPage * AUDIT_PAGE_SIZE) + 1}–{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal)} of {auditTotal} records
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={dailySummaryLoading || !logs || logs.length === 0}
                    onClick={async () => {
                      setDailySummaryLoading(true);
                      setDailySummary(null);
                      try {
                        // Fetch all logs for current filters (up to 500) for summary
                        let query = supabase
                          .from("audit_logs")
                          .select("table_name, action, user_email, changed_at, description, changes, old_values, new_values")
                          .eq("company_id", companyId)
                          .order("changed_at", { ascending: false })
                          .limit(500);
                        if (superAdminUserIds.length > 0) {
                          query = query.not("user_id", "in", `(${superAdminUserIds.join(",")})`);
                        }
                        if (startDate) query = query.gte("changed_at", `${startDate}T00:00:00`);
                        if (endDate) query = query.lte("changed_at", `${endDate}T23:59:59`);
                        if (tableFilter && tableFilter !== "all") query = query.eq("table_name", tableFilter);
                        if (actionFilter && actionFilter !== "all") query = query.eq("action", actionFilter);
                        if (userFilter) query = query.ilike("user_email", `%${userFilter}%`);
                        const { data: allLogs, error: fetchErr } = await query;
                        if (fetchErr) throw fetchErr;

                        const { data, error } = await supabase.functions.invoke("summarize-audit-log", {
                          body: { auditLogs: allLogs, mode: "daily-summary" },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        setDailySummary(data.summary);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to generate summary");
                      } finally {
                        setDailySummaryLoading(false);
                      }
                    }}
                  >
                    {dailySummaryLoading ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Summarizing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-3 w-3" />
                        Summarize Activity
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {dailySummary && (
                  <div className="border border-border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Activity Summary</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDailySummary(null)}>
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </Button>
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                      {dailySummary}
                    </div>
                  </div>
                )}
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
                {/* Pagination Controls */}
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {auditPage + 1} of {auditTotalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(0)}
                        disabled={auditPage === 0}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                        disabled={auditPage === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages - 1, p + 1))}
                        disabled={auditPage >= auditTotalPages - 1}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(auditTotalPages - 1)}
                        disabled={auditPage >= auditTotalPages - 1}
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Archived Logs */}
            <Collapsible open={showArchived} onOpenChange={setShowArchived}>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Database className="h-4 w-4" /> Archived Logs
                          <ChevronRight className={`h-4 w-4 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                        </CardTitle>
                        <CardDescription>
                          {showArchived
                            ? `Showing ${archivedTotal > 0 ? (archivedPage * AUDIT_PAGE_SIZE) + 1 : 0}–${Math.min((archivedPage + 1) * AUDIT_PAGE_SIZE, archivedTotal)} of ${archivedTotal} archived records`
                            : "Click to view archived audit logs"}
                        </CardDescription>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    {archivedLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date/Time</TableHead>
                              <TableHead>Archived At</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Table</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {archivedLogs?.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  No archived logs found
                                </TableCell>
                              </TableRow>
                            ) : (
                              archivedLogs?.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {format(new Date(log.changed_at), "MMM d, yyyy h:mm a")}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-muted-foreground">
                                    {log.archived_at ? format(new Date(log.archived_at), "MMM d, yyyy h:mm a") : "-"}
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
                    {archivedTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Page {archivedPage + 1} of {archivedTotalPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setArchivedPage(0)} disabled={archivedPage === 0}>First</Button>
                          <Button variant="outline" size="sm" onClick={() => setArchivedPage((p) => Math.max(0, p - 1))} disabled={archivedPage === 0}>Previous</Button>
                          <Button variant="outline" size="sm" onClick={() => setArchivedPage((p) => Math.min(archivedTotalPages - 1, p + 1))} disabled={archivedPage >= archivedTotalPages - 1}>Next</Button>
                          <Button variant="outline" size="sm" onClick={() => setArchivedPage(archivedTotalPages - 1)} disabled={archivedPage >= archivedTotalPages - 1}>Last</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>

          {/* Edge Function Logs Tab */}
          <TabsContent value="edge-logs" className="mt-6">
            <EdgeFunctionLogs />
          </TabsContent>
        </Tabs>
      </div>

      {/* Audit Log Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => { if (!open) { setSelectedLog(null); setAiSummary(null); } }}>
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

                {/* AI Summary */}
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  {aiSummary ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">AI Summary</Label>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => setAiSummary(null)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={aiSummaryLoading}
                      onClick={async () => {
                        setAiSummaryLoading(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("summarize-audit-log", {
                            body: { auditLog: selectedLog },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          setAiSummary(data.summary);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to generate summary");
                        } finally {
                          setAiSummaryLoading(false);
                        }
                      }}
                    >
                      {aiSummaryLoading ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Summarizing…
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-3 w-3" />
                          Summarize with AI
                        </>
                      )}
                    </Button>
                  )}
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
