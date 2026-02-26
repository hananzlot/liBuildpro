import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUSES } from "@/components/production/AdminKPIFilters";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { logAudit } from "@/hooks/useAuditLog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { 
  Building2, 
  User, 
  DollarSign, 
  CheckSquare, 
  MessageSquare,
  Star,
  AlertCircle,
  Loader2,
  FolderOpen,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  Pencil,
  X,
  Settings2,
  Send,
  Camera,
  ExternalLink,
  Copy,
  Link as LinkIcon
} from "lucide-react";
import { FinanceSection } from "./FinanceSection";
import { DocumentsSection } from "./DocumentsSection";
import { NotesSection } from "./NotesSection";
import { PhotosSection } from "./PhotosSection";
import { DebouncedInput, DebouncedTextarea, DebouncedNumberInput } from "@/components/ui/debounced-input";
import { CustomLeadCostsDialog, WeightedAverageTooltip } from "./CustomLeadCostsDialog";
import { CustomerPortalCard } from "./CustomerPortalCard";
import { useShortLinks } from "@/hooks/useShortLinks";

interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  cell_phone: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  estimated_cost: number | null;
  total_pl: number | null;
  created_at: string;
  opportunity_id: string | null;
  location_id: string;
}

interface ProjectDetailSheetProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Explicit close handler for page mode (called when user clicks close button) */
  onClose?: () => void;
  onUpdate: () => void;
  autoOpenBillDialog?: boolean;
  onBillDialogOpened?: () => void;
  initialTab?: string;
  /** Initial sub-tab within the Finance tab (agreements, phases, invoices, bills, commission) */
  initialFinanceSectionTab?: string;
  initialFinanceSubTab?: 'bills' | 'history';
  /** Auto-open a specific finance dialog (invoice, payment, bill) */
  autoOpenFinanceDialog?: 'invoice' | 'payment' | 'bill' | null;
  highlightInvoiceId?: string | null;
  highlightBillId?: string | null;
  highlightPaymentId?: string | null;
  /** Render mode: 'sheet' (default) shows in a slide-over, 'page' renders inline content */
  mode?: 'sheet' | 'page';
}

const statusColors: Record<string, string> = {
  "Proposal": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "New Job": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In-Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "On-Hold": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Completed": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Cancelled": "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ProjectDetailSheet({ project, open, onOpenChange, onClose, onUpdate, autoOpenBillDialog, onBillDialogOpened, initialTab, initialFinanceSectionTab, initialFinanceSubTab, autoOpenFinanceDialog, highlightInvoiceId, highlightBillId, highlightPaymentId, mode = 'sheet' }: ProjectDetailSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const { companyId } = useCompanyContext();
  const { updateActiveTabPath } = useAppTabs();
  const { isShortLinksEnabled, createPortalShortLink } = useShortLinks();
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const [financeSubTab, setFinanceSubTab] = useState<string>(initialFinanceSectionTab || "agreements");
  const [financeBillsSubTab, setFinanceBillsSubTab] = useState<'bills' | 'history' | undefined>(initialFinanceSubTab);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [newStatusValue, setNewStatusValue] = useState("");
  const [newTypeValue, setNewTypeValue] = useState("");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [customLeadCostsOpen, setCustomLeadCostsOpen] = useState(false);
  const [portalChatReply, setPortalChatReply] = useState("");
  const [leadSourcePopoverOpen, setLeadSourcePopoverOpen] = useState(false);
  const [newLeadSourceValue, setNewLeadSourceValue] = useState("");
  const [leadSourceSearch, setLeadSourceSearch] = useState("");
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);
  const [headerPortalLink, setHeaderPortalLink] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isFinancePdfPreviewOpen, setIsFinancePdfPreviewOpen] = useState(false);
  const [financeSummary, setFinanceSummary] = useState<{ sold: number; invoiced: number; received: number; outstandingAR: number; bills: number; billsPaid: number; outstandingAP: number; hasAgreements: boolean }>({ sold: 0, invoiced: 0, received: 0, outstandingAR: 0, bills: 0, billsPaid: 0, outstandingAP: 0, hasAgreements: false });

  // Helper to sync the app tab path with inner tab state (only in page mode)
  const syncTabPath = useCallback((tab: string, finSubTab?: string, finBillsSubTab?: 'bills' | 'history') => {
    if (mode !== 'page' || !project?.id) return;
    
    const params = new URLSearchParams();
    if (tab && tab !== 'overview') {
      params.set('tab', tab);
    }
    if (tab === 'finance' && finSubTab && finSubTab !== 'agreements') {
      params.set('financeSubTab', finSubTab);
    }
    if (tab === 'finance' && finSubTab === 'bills' && finBillsSubTab && finBillsSubTab !== 'bills') {
      params.set('financeTab', finBillsSubTab);
    }
    
    const query = params.toString();
    const newPath = `/project/${project.id}${query ? `?${query}` : ''}`;
    updateActiveTabPath(newPath);
  }, [mode, project?.id, updateActiveTabPath]);

  // Handle main tab changes
  const handleActiveTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    syncTabPath(newTab, newTab === 'finance' ? financeSubTab : undefined, newTab === 'finance' && financeSubTab === 'bills' ? financeBillsSubTab : undefined);
  }, [financeSubTab, financeBillsSubTab, syncTabPath]);

  // Handle finance section sub-tab changes
  const handleFinanceSubTabChange = useCallback((subTab: string, billsSubTab?: 'bills' | 'history') => {
    setFinanceSubTab(subTab);
    if (billsSubTab !== undefined) {
      setFinanceBillsSubTab(billsSubTab);
    }
    syncTabPath(activeTab, subTab, billsSubTab);
  }, [activeTab, syncTabPath]);

  // Auto-switch to finance tab and signal bill dialog open when returning from subcontractor add
  useEffect(() => {
    if (open && autoOpenBillDialog && project) {
      setActiveTab("finance");
      onBillDialogOpened?.();
    }
  }, [open, autoOpenBillDialog, project, onBillDialogOpened]);

  // Set active tab when initialTab prop changes
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Automatically open finance tab when highlighting an invoice or bill
  useEffect(() => {
    if (open && highlightInvoiceId) {
      setActiveTab("finance");
    }
  }, [open, highlightInvoiceId]);

  useEffect(() => {
    if (open && highlightBillId) {
      setActiveTab("finance");
    }
  }, [open, highlightBillId]);

  const handleNavigateToSubcontractors = useCallback(() => {
    onOpenChange(false); // Close the sheet first
    navigate(`/production?view=subcontractors&returnToProject=${project?.id}`);
  }, [navigate, onOpenChange, project?.id]);

  // Fetch full project details
  const { data: fullProject, isLoading } = useQuery({
    queryKey: ["project-detail", project?.id],
    queryFn: async () => {
      if (!project?.id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Fetch related data
  const { data: checklists = [] } = useQuery({
    queryKey: ["project-checklists", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("project_checklists")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["project-messages", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Fetch portal chat messages for this project
  const { data: portalChatMessages = [] } = useQuery({
    queryKey: ["portal-chat-messages", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("portal_chat_messages")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  const { data: feedback } = useQuery({
    queryKey: ["project-feedback", project?.id],
    queryFn: async () => {
      if (!project?.id) return null;
      const { data, error } = await supabase
        .from("project_feedback")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Fetch portal token for header display
  const { data: headerPortalToken } = useQuery({
    queryKey: ["project-portal-token-header", project?.id],
    queryFn: async () => {
      if (!project?.id) return null;
      const { data, error } = await supabase
        .from("client_portal_tokens")
        .select("token, is_active")
        .eq("project_id", project.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Fetch company base URL for portal links
  const { data: appBaseUrl } = useQuery({
    queryKey: ["company-base-url-header", companyId],
    queryFn: async () => {
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        if (companyData?.setting_value) return companyData.setting_value;
      }
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_base_url")
        .maybeSingle();
      return data?.setting_value || window.location.origin;
    },
    staleTime: 1000 * 60 * 5,
    enabled: open,
  });

  // Generate short link for header portal display
  useEffect(() => {
    async function generateHeaderPortalLink() {
      if (!headerPortalToken?.token || !appBaseUrl) {
        setHeaderPortalLink(null);
        return;
      }
      const longLink = `${appBaseUrl}/portal?token=${headerPortalToken.token}`;
      if (isShortLinksEnabled) {
        const shortLink = await createPortalShortLink(longLink, project?.project_name || "Customer");
        setHeaderPortalLink(shortLink);
      } else {
        setHeaderPortalLink(longLink);
      }
    }
    generateHeaderPortalLink();
  }, [headerPortalToken, appBaseUrl, isShortLinksEnabled, createPortalShortLink, project?.project_name]);

  // Fetch salespeople from the salespeople table
  const { data: existingSalespeople = [] } = useQuery({
    queryKey: ["salespeople-names", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data.map(s => s.name);
    },
    enabled: open && !!companyId,
  });

  // State for combobox inputs
  const [managerSearch, setManagerSearch] = useState("");
  const [primarySearch, setPrimarySearch] = useState("");
  const [secondarySearch, setSecondarySearch] = useState("");
  const [tertiarySearch, setTertiarySearch] = useState("");
  const [quaternarySearch, setQuaternarySearch] = useState("");

  // Check if company has an active QuickBooks connection
  const { data: hasQbConnection } = useQuery({
    queryKey: ["quickbooks-connection-exists", companyId],
    queryFn: async () => {
      if (!companyId) return false;
      const { count, error } = await supabase
        .from("quickbooks_connections")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: open && !!companyId,
  });

  // Auto-sync to QuickBooks mutation
  const toggleAutoSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!project?.id) throw new Error("No project");
      const { error } = await supabase
        .from("projects")
        .update({ auto_sync_to_quickbooks: enabled })
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["project-detail", project?.id] });
      toast.success(enabled ? "Auto-sync enabled" : "Auto-sync disabled");
    },
    onError: () => {
      toast.error("Failed to update auto-sync setting");
    },
  });

  // Calculate total commission percentage
  const totalCommission = (fullProject?.primary_commission_pct || 0) + 
    (fullProject?.secondary_commission_pct || 0) + 
    (fullProject?.tertiary_commission_pct || 0) + 
    (fullProject?.quaternary_commission_pct || 0);

  // Helper to validate and update commission
  const updateCommission = (field: string, value: string, otherCommissions: number) => {
    const newValue = value ? Number(value) : 0;
    const newTotal = newValue + otherCommissions;
    
    if (newTotal > 100) {
      toast.error(`Total commission cannot exceed 100%. Current total would be ${newTotal}%`);
      return;
    }
    
    updateProjectMutation.mutate({ [field]: value ? Number(value) : null });
  };

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: Partial<typeof fullProject>) => {
      if (!project?.id) throw new Error("No project selected");
      
      // Log audit before update
      await logAudit({
        tableName: 'projects',
        recordId: project.id,
        action: 'UPDATE',
        oldValues: fullProject,
        newValues: updates,
        description: `Updated project #${project.project_number}`,
      });
      
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project updated");
      queryClient.invalidateQueries({ queryKey: ["project-detail", project?.id] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Toggle checklist item
  const toggleChecklistMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'UPDATE',
        oldValues: { completed: !completed },
        newValues: { completed },
        description: `${completed ? 'Completed' : 'Uncompleted'} checklist item`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? user?.id : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
  });

  // Add checklist item
  const addChecklistMutation = useMutation({
    mutationFn: async (item: string) => {
      if (!project?.id) throw new Error("No project");
      const { data, error } = await supabase
        .from("project_checklists")
        .insert({ project_id: project.id, item })
        .select()
        .single();
      if (error) throw error;
      await logAudit({
        tableName: 'project_checklists',
        recordId: data.id,
        action: 'INSERT',
        newValues: { item },
        description: `Added checklist item: ${item}`,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Checklist item added");
      setNewChecklistItem("");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update checklist item text
  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, item }: { id: string; item: string }) => {
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'UPDATE',
        newValues: { item },
        description: `Updated checklist item to: ${item}`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .update({ item })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item updated");
      setEditingChecklistId(null);
      setEditingChecklistText("");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Delete checklist item
  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'DELETE',
        description: `Deleted checklist item`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Fetch project statuses from database
  const { data: projectStatuses = [] } = useQuery({
    queryKey: ["project-statuses", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
  });

  // Fetch project types from database
  const { data: projectTypes = [] } = useQuery({
    queryKey: ["project-types", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("project_types")
        .select("*")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
  });

  // Helper to capitalize source names properly (Title Case)
  const toTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fetch lead sources from company-defined lead_sources table
  const { data: existingLeadSources = [] } = useQuery({
    queryKey: ["lead-sources", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("lead_sources")
        .select("id, name, is_active, sort_order")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      
      if (error) throw error;
      
      return data?.map(s => s.name) || [];
    },
    enabled: open && !!companyId,
  });

  // Group sources by first letter for display
  const groupedLeadSources = useMemo(() => {
    const groups: Record<string, string[]> = {};
    existingLeadSources.forEach(source => {
      const firstLetter = source.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(source);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [existingLeadSources]);

  // Mutation to add a new lead source
  const addLeadSourceMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("lead_sources")
        .insert({ 
          name, 
          company_id: companyId,
          created_by: user?.id 
        });
      if (error) {
        if (error.code === "23505") {
          throw new Error("Source already exists");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-sources", companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add source");
    },
  });

  // Add new status mutation
  const addStatusMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("No company selected");
      const maxSort = projectStatuses.length > 0 
        ? Math.max(...projectStatuses.map(s => s.sort_order || 0)) 
        : 0;
      const { error } = await supabase
        .from("project_statuses")
        .insert({ name, sort_order: maxSort + 1, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status added");
      setNewStatusValue("");
      queryClient.invalidateQueries({ queryKey: ["project-statuses", companyId] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Add new type mutation
  const addTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("No company selected");
      const maxSort = projectTypes.length > 0 
        ? Math.max(...projectTypes.map(t => t.sort_order || 0)) 
        : 0;
      const { error } = await supabase
        .from("project_types")
        .insert({ name, sort_order: maxSort + 1, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Type added");
      setNewTypeValue("");
      queryClient.invalidateQueries({ queryKey: ["project-types", companyId] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("project_statuses")
        .update({ name })
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status renamed");
      setEditingStatusId(null);
      setEditingStatusName("");
      queryClient.invalidateQueries({ queryKey: ["project-statuses", companyId] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update type mutation
  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("project_types")
        .update({ name })
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Type renamed");
      setEditingTypeId(null);
      setEditingTypeName("");
      queryClient.invalidateQueries({ queryKey: ["project-types", companyId] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Send portal chat reply mutation - MUST be before early return
  const sendChatReplyMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!project?.id) throw new Error("No project selected");
      const { error } = await supabase
        .from("portal_chat_messages")
        .insert({
          project_id: project.id,
          sender_type: 'staff',
          sender_name: user?.email?.split('@')[0] || 'Staff',
          sender_email: user?.email,
          sender_user_id: user?.id,
          message: message.trim(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setPortalChatReply("");
      queryClient.invalidateQueries({ queryKey: ["portal-chat-messages", project?.id] });
      toast.success("Reply sent to customer portal");
    },
    onError: (error: Error) => toast.error(`Failed to send: ${error.message}`),
  });

  if (!project) return null;

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const handleSendChatReply = () => {
    if (!portalChatReply.trim()) return;
    sendChatReplyMutation.mutate(portalChatReply);
  };

  const handleDeleteProject = async () => {
    if (!project?.id) return;
    setIsDeletingProject(true);
    try {
      const pid = project.id;

      // Delete all child records first (split into batches to avoid TS depth limits)
      const deleteChild = (table: string) =>
        (supabase.from(table as "project_notes") as ReturnType<typeof supabase.from>)
          .delete()
          .eq("project_id", pid);

      await Promise.all([
        deleteChild("project_notes"),
        deleteChild("project_documents"),
        deleteChild("project_invoices"),
        deleteChild("project_payments"),
        deleteChild("project_bills"),
        deleteChild("project_payment_phases"),
        deleteChild("project_agreements"),
        deleteChild("project_checklists"),
        deleteChild("project_costs"),
        deleteChild("project_commissions"),
      ]);
      await Promise.all([
        deleteChild("project_feedback"),
        deleteChild("project_messages"),
        deleteChild("project_finance"),
        deleteChild("project_notification_log"),
        deleteChild("portal_chat_messages"),
        deleteChild("portal_chat_messages_archived"),
        deleteChild("portal_view_logs"),
        deleteChild("client_comments"),
        deleteChild("client_portal_tokens"),
        deleteChild("commission_payments"),
        deleteChild("scope_submissions"),
      ]);

      // Soft-delete the project itself
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", pid);
      if (error) throw error;

      toast.success("Project deleted successfully");
      // Invalidate all caches that may contain this project so search & lists update instantly
      queryClient.invalidateQueries({ queryKey: ["global-search-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["production-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", pid] });
      onUpdate();
      if (onClose) onClose();
      else onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project";
      toast.error(msg);
    } finally {
      setIsDeletingProject(false);
      setShowDeleteConfirm(false);
    }
  };

  const isPageMode = mode === 'page';

  return (
    <>
    <Sheet open={open} modal={!isPageMode} onOpenChange={isPageMode ? undefined : onOpenChange}>
      <SheetContent 
        className={isPageMode ? "w-full h-full overflow-y-auto" : "w-full sm:max-w-6xl overflow-y-auto"}
        disablePortal={isPageMode}
      >
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                #{project.project_number} - {toTitleCase(project.project_name)}
                <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 cursor-pointer hover:opacity-80 transition-opacity ${statusColors[fullProject?.project_status || project.project_status || "New Job"] || ""}`}
                    >
                      {fullProject?.project_status || project.project_status || "New Job"}
                      <ChevronsUpDown className="ml-1 h-2.5 w-2.5 opacity-50" />
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-1 z-50 bg-popover" align="start">
                    <div className="flex flex-col">
                      {(projectStatuses.length > 0
                        ? projectStatuses.map(s => ({ key: s.id, name: s.name }))
                        : PROJECT_STATUSES.map(s => ({ key: s, name: s }))
                      ).map((status) => (
                        <button
                          key={status.key}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left",
                            fullProject?.project_status === status.name && "bg-accent"
                          )}
                          onClick={() => {
                            updateProjectMutation.mutate({ project_status: status.name });
                            setStatusPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-3 w-3 shrink-0",
                              fullProject?.project_status === status.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {status.name}
                        </button>
                      ))}
                      {(isAdmin || isSuperAdmin) && (
                        <>
                          <div className="border-t my-1" />
                          <div className="px-1 pb-1">
                            <div className="flex items-center gap-1">
                              <Input
                                placeholder="New status..."
                                value={newStatusValue}
                                onChange={(e) => setNewStatusValue(e.target.value)}
                                className="h-7 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newStatusValue.trim()) {
                                    addStatusMutation.mutate(newStatusValue.trim());
                                    setNewStatusValue("");
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                disabled={!newStatusValue.trim()}
                                onClick={() => {
                                  if (newStatusValue.trim()) {
                                    addStatusMutation.mutate(newStatusValue.trim());
                                    setNewStatusValue("");
                                  }
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </SheetTitle>
              <SheetDescription>
                {toTitleCase(`${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim())}
              </SheetDescription>
            </div>
            {financeSummary.hasAgreements && (
              <div className="flex items-center gap-1.5 flex-wrap ml-auto shrink-0">
                {financeSummary.sold > 0 && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 rounded-md px-1.5 py-0.5 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-600 font-bold">Sold:</span>
                    <span className="text-[11px] font-semibold text-emerald-700">{formatCurrency(financeSummary.sold)}</span>
                  </div>
                )}
                {financeSummary.invoiced > 0 && (
                  <div className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5 border">
                    <span className="text-[10px] text-muted-foreground">Inv:</span>
                    <span className="text-[11px] font-semibold">{formatCurrency(financeSummary.invoiced)}</span>
                  </div>
                )}
                {financeSummary.received > 0 && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 rounded-md px-1.5 py-0.5 border border-emerald-200">
                    <span className="text-[10px] text-muted-foreground">Rec:</span>
                    <span className="text-[11px] font-semibold text-emerald-600">{formatCurrency(financeSummary.received)}</span>
                  </div>
                )}
                {financeSummary.outstandingAR > 0 && (
                  <div className="flex items-center gap-1 bg-destructive/10 rounded-md px-1.5 py-0.5 border border-destructive/30">
                    <span className="text-[10px] text-destructive">AR:</span>
                    <span className="text-[11px] font-semibold text-destructive">{formatCurrency(financeSummary.outstandingAR)}</span>
                  </div>
                )}
                {financeSummary.bills > 0 && (
                  <div className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5 border">
                    <span className="text-[10px] text-muted-foreground">Bills:</span>
                    <span className="text-[11px] font-semibold">{formatCurrency(financeSummary.bills)}</span>
                  </div>
                )}
                {financeSummary.billsPaid > 0 && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 rounded-md px-1.5 py-0.5 border border-emerald-200">
                    <span className="text-[10px] text-muted-foreground">Paid:</span>
                    <span className="text-[11px] font-semibold text-emerald-600">{formatCurrency(financeSummary.billsPaid)}</span>
                  </div>
                )}
                {financeSummary.outstandingAP > 0 && (
                  <div className="flex items-center gap-1 bg-amber-500/10 rounded-md px-1.5 py-0.5 border border-amber-200">
                    <span className="text-[10px] text-amber-600">AP:</span>
                    <span className="text-[11px] font-semibold text-amber-600">{formatCurrency(financeSummary.outstandingAP)}</span>
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Portal Link & Auto-Sync Toggle Row */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              {headerPortalLink && (
                <>
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <a 
                    href={headerPortalLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate max-w-[250px]"
                  >
                    {headerPortalLink}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={async () => {
                      await navigator.clipboard.writeText(headerPortalLink);
                      setPortalLinkCopied(true);
                      toast.success("Portal link copied!");
                      setTimeout(() => setPortalLinkCopied(false), 2000);
                    }}
                  >
                    {portalLinkCopied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(headerPortalLink, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
            {activeTab === "finance" && hasQbConnection && (
              <div className="flex items-center gap-1.5">
                <Label 
                  htmlFor="auto-sync-qb-header" 
                  className="text-[10px] text-muted-foreground cursor-pointer"
                >
                  QB Auto Sync
                </Label>
                <Switch
                  id="auto-sync-qb-header"
                  checked={fullProject?.auto_sync_to_quickbooks ?? false}
                  onCheckedChange={(checked) => toggleAutoSyncMutation.mutate(checked)}
                  disabled={toggleAutoSyncMutation.isPending}
                  className="scale-[0.6]"
                />
              </div>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="mt-3">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FolderOpen className="h-3 w-3 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="photos" className="text-xs">
              <Camera className="h-3 w-3 mr-1" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs">
              <CheckSquare className="h-3 w-3 mr-1" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              Feedback
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Project Info & Customer Info - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
                {/* Project Info */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium">Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    <div className="flex gap-3">
                      <div className="space-y-1 flex-1">
                        <Label className="text-[11px] text-muted-foreground">Project Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={toTitleCase(fullProject?.project_name || "")} 
                          onSave={(value) => updateProjectMutation.mutate({ project_name: value })}
                        />
                      </div>
                      <div className="space-y-1 w-[110px]">
                        <Label className="text-[11px] text-muted-foreground">Start Date</Label>
                        <Input
                          className="h-8 text-xs"
                          type="date"
                          defaultValue={fullProject?.install_start_date ? fullProject.install_start_date.split('T')[0] : ""} 
                          key={fullProject?.install_start_date}
                          onBlur={(e) => {
                            const newValue = e.target.value || null;
                            const oldValue = fullProject?.install_start_date ? fullProject.install_start_date.split('T')[0] : null;
                            if (newValue !== oldValue) {
                              updateProjectMutation.mutate({ install_start_date: newValue });
                            }
                          }}
                        />
                      </div>
                      {fullProject?.project_status === "Completed" && (
                        <div className="space-y-1 w-[110px]">
                          <Label className="text-[11px] text-muted-foreground">End Date</Label>
                          <Input
                            className={cn("h-8 text-xs", !fullProject?.completion_date && "border-destructive")}
                            type="date"
                            defaultValue={fullProject?.completion_date ? fullProject.completion_date.split('T')[0] : ""} 
                            key={fullProject?.completion_date}
                            onBlur={(e) => {
                              const newValue = e.target.value || null;
                              const oldValue = fullProject?.completion_date ? fullProject.completion_date.split('T')[0] : null;
                              if (newValue !== oldValue) {
                                updateProjectMutation.mutate({ completion_date: newValue });
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Project Address</Label>
                      <DebouncedInput
                        className="h-8 text-xs"
                        value={fullProject?.project_address || ""} 
                        onSave={(value) => updateProjectMutation.mutate({ project_address: value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Type</Label>
                        <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              <span className="text-left flex-1 truncate">
                                {fullProject?.project_type 
                                  ? fullProject.project_type.split(',').map(t => t.trim()).filter(Boolean).join(', ')
                                  : "Select types..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0 z-50 bg-popover" align="start">
                            <Command className="flex flex-col">
                              <CommandInput 
                                placeholder={isSuperAdmin ? "Search or add..." : "Search..."} 
                                value={newTypeValue}
                                onValueChange={setNewTypeValue}
                              />
                              <ScrollArea
                                className="h-[260px]"
                                onWheelCapture={(e) => e.stopPropagation()}
                                onTouchMoveCapture={(e) => e.stopPropagation()}
                              >
                                <CommandList className="max-h-none overflow-visible">
                                  <CommandEmpty>No type found.</CommandEmpty>
                                  <CommandGroup>
                                    {isSuperAdmin && newTypeValue && !projectTypes.some(t => t.name.toLowerCase() === newTypeValue.toLowerCase()) && (
                                      <CommandItem
                                        value={`add-${newTypeValue}`}
                                        onSelect={() => {
                                          addTypeMutation.mutate(newTypeValue);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add "{newTypeValue}"
                                      </CommandItem>
                                    )}
                                    {projectTypes.map((type) => {
                                      const selectedTypes = (fullProject?.project_type || '').split(',').map(t => t.trim()).filter(Boolean);
                                      const isSelected = selectedTypes.includes(type.name);

                                      const toggleType = () => {
                                        if (editingTypeId === type.id) return;
                                        let newTypes: string[];
                                        if (isSelected) {
                                          newTypes = selectedTypes.filter(t => t !== type.name);
                                        } else {
                                          newTypes = [...selectedTypes, type.name];
                                        }
                                        updateProjectMutation.mutate({ project_type: newTypes.join(', ') || null });
                                      };

                                      return (
                                        <CommandItem
                                          key={type.id}
                                          value={type.name}
                                          onSelect={toggleType}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center">
                                            <Checkbox
                                              checked={isSelected}
                                              className="mr-2 h-4 w-4"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleType();
                                              }}
                                            />
                                            {editingTypeId === type.id ? (
                                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                  value={editingTypeName}
                                                  onChange={(e) => setEditingTypeName(e.target.value)}
                                                  className="h-6 w-24 text-xs"
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && editingTypeName.trim()) {
                                                      updateTypeMutation.mutate({ id: type.id, name: editingTypeName.trim() });
                                                    } else if (e.key === 'Escape') {
                                                      setEditingTypeId(null);
                                                      setEditingTypeName("");
                                                    }
                                                  }}
                                                />
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-5 w-5"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (editingTypeName.trim()) {
                                                      updateTypeMutation.mutate({ id: type.id, name: editingTypeName.trim() });
                                                    }
                                                  }}
                                                >
                                                  <Check className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-5 w-5"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTypeId(null);
                                                    setEditingTypeName("");
                                                  }}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <span>{type.name}</span>
                                            )}
                                          </div>
                                          {isSuperAdmin && editingTypeId !== type.id && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5 opacity-50 hover:opacity-100"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTypeId(type.id);
                                                setEditingTypeName(type.name);
                                              }}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </ScrollArea>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Lead Source</Label>
                        {(isAdmin || isSuperAdmin) ? (
                          <Popover open={leadSourcePopoverOpen} onOpenChange={setLeadSourcePopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal h-8 text-xs"
                              >
                                {fullProject?.lead_source || "Select or add..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0 z-50 bg-popover" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search or add new..." 
                                  value={leadSourceSearch}
                                  onValueChange={setLeadSourceSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {leadSourceSearch ? (
                                      <div className="p-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-full justify-start text-xs"
                                          onClick={async () => {
                                            const newSource = toTitleCase(leadSourceSearch.trim());
                                            await addLeadSourceMutation.mutateAsync(newSource);
                                            updateProjectMutation.mutate({ lead_source: newSource });
                                            setLeadSourcePopoverOpen(false);
                                            setLeadSourceSearch("");
                                          }}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add "{toTitleCase(leadSourceSearch.trim())}"
                                        </Button>
                                      </div>
                                    ) : "No sources found. Add sources in Admin Settings → Sources."}
                                  </CommandEmpty>
                                  <ScrollArea className="h-[250px] overflow-y-auto">
                                    {/* Add New option at top when searching */}
                                    {leadSourceSearch && !existingLeadSources.some(s => s.toLowerCase() === leadSourceSearch.toLowerCase()) && (
                                      <CommandGroup heading="Add New">
                                        <CommandItem
                                          value={`add-new-${leadSourceSearch}`}
                                          onSelect={async () => {
                                            const newSource = toTitleCase(leadSourceSearch.trim());
                                            await addLeadSourceMutation.mutateAsync(newSource);
                                            updateProjectMutation.mutate({ lead_source: newSource });
                                            setLeadSourcePopoverOpen(false);
                                            setLeadSourceSearch("");
                                          }}
                                          className="text-xs"
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add "{toTitleCase(leadSourceSearch.trim())}"
                                        </CommandItem>
                                      </CommandGroup>
                                    )}
                                    
                                    {/* Clear selection option */}
                                    {fullProject?.lead_source && (
                                      <CommandGroup heading="Actions">
                                        <CommandItem
                                          value="__clear__"
                                          onSelect={() => {
                                            updateProjectMutation.mutate({ lead_source: null });
                                            setLeadSourcePopoverOpen(false);
                                            setLeadSourceSearch("");
                                          }}
                                          className="text-xs text-muted-foreground"
                                        >
                                          <X className="mr-2 h-4 w-4" />
                                          Clear selection
                                        </CommandItem>
                                      </CommandGroup>
                                    )}
                                    
                                    {/* Grouped sources by first letter */}
                                    {groupedLeadSources.map(([letter, sources], index) => (
                                      <CommandGroup key={letter} heading={letter}>
                                        {sources.map((source) => (
                                          <CommandItem
                                            key={source}
                                            value={source}
                                            onSelect={() => {
                                              updateProjectMutation.mutate({ lead_source: source });
                                              setLeadSourcePopoverOpen(false);
                                              setLeadSourceSearch("");
                                            }}
                                            className="text-xs"
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                fullProject?.lead_source === source ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {source}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    ))}
                                  </ScrollArea>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="px-3 py-2 text-xs rounded-md border bg-muted/50 text-muted-foreground h-8 flex items-center">
                            {fullProject?.lead_source || "—"}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Scope of Work</Label>
                      <DebouncedTextarea
                        className="text-xs min-h-[60px]"
                        value={fullProject?.scope_of_work || ""} 
                        onSave={(value) => updateProjectMutation.mutate({ scope_of_work: value || null })}
                        placeholder="Enter scope of work..."
                      />
                    </div>
                    {fullProject?.project_scope_dispatch && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Scope (Dispatch)</Label>
                        <div className="px-3 py-2 text-xs rounded-md border bg-muted/50 text-muted-foreground whitespace-pre-wrap break-words">
                          {fullProject.project_scope_dispatch}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Manager</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.project_manager || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={managerSearch}
                                onValueChange={setManagerSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {managerSearch && !existingSalespeople.some(n => n.toLowerCase() === managerSearch.toLowerCase()) && (
                                    <CommandItem
                                      value={managerSearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ project_manager: managerSearch });
                                        setManagerSearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{managerSearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ project_manager: name });
                                        setManagerSearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.project_manager === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">First Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={toTitleCase(fullProject?.customer_first_name || "")} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_first_name: value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Last Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={toTitleCase(fullProject?.customer_last_name || "")} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_last_name: value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Cell Phone</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={formatPhoneNumber(fullProject?.cell_phone)} 
                          onSave={(value) => updateProjectMutation.mutate({ cell_phone: value.replace(/\D/g, "") })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Email</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={fullProject?.customer_email || ""} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_email: value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Salesperson Info */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium">Sales Team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {/* Lead Cost % and Commission Split % */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground">Lead Cost %</Label>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => setCustomLeadCostsOpen(true)}
                              title="Custom Lead Costs"
                            >
                              <Settings2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <DebouncedNumberInput
                          className={cn("h-8 text-xs", !isAdmin && "bg-muted")}
                          min={0}
                          max={100}
                          value={fullProject?.lead_cost_percent ?? 18} 
                          onSave={(value) => updateProjectMutation.mutate({ lead_cost_percent: value ?? 18 })}
                          placeholder="18"
                          disabled={!isAdmin}
                        />
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] text-muted-foreground">Admin only</p>
                          {fullProject?.id && (
                            <WeightedAverageTooltip 
                              projectId={fullProject.id} 
                              leadCostPercent={fullProject?.lead_cost_percent ?? 18} 
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Commission Split %</Label>
                        <DebouncedNumberInput
                          className={cn("h-8 text-xs", !isAdmin && "bg-muted")}
                          min={0}
                          max={100}
                          value={fullProject?.commission_split_pct ?? 50} 
                          onSave={(value) => updateProjectMutation.mutate({ commission_split_pct: value ?? 50 })}
                          placeholder="50"
                          disabled={!isAdmin}
                        />
                        <p className="text-[10px] text-muted-foreground">Admin only</p>
                      </div>
                    </div>
                    {/* Primary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Primary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.primary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={primarySearch}
                                onValueChange={setPrimarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {primarySearch && !existingSalespeople.some(n => n.toLowerCase() === primarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={primarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ 
                                          primary_salesperson: primarySearch,
                                          project_manager: fullProject?.project_manager || primarySearch
                                        });
                                        setPrimarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{primarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ 
                                          primary_salesperson: name,
                                          project_manager: fullProject?.project_manager || name
                                        });
                                        setPrimarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.primary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.primary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'primary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    {/* Secondary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Secondary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.secondary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={secondarySearch}
                                onValueChange={setSecondarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {secondarySearch && !existingSalespeople.some(n => n.toLowerCase() === secondarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={secondarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ secondary_salesperson: secondarySearch });
                                        setSecondarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{secondarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ secondary_salesperson: name });
                                        setSecondarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.secondary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.secondary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'secondary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Tertiary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Tertiary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.tertiary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={tertiarySearch}
                                onValueChange={setTertiarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {tertiarySearch && !existingSalespeople.some(n => n.toLowerCase() === tertiarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={tertiarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ tertiary_salesperson: tertiarySearch });
                                        setTertiarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{tertiarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ tertiary_salesperson: name });
                                        setTertiarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.tertiary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.tertiary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'tertiary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Quaternary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Quaternary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.quaternary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={quaternarySearch}
                                onValueChange={setQuaternarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {quaternarySearch && !existingSalespeople.some(n => n.toLowerCase() === quaternarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={quaternarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ quaternary_salesperson: quaternarySearch });
                                        setQuaternarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{quaternarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ quaternary_salesperson: name });
                                        setQuaternarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.quaternary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.quaternary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'quaternary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Commission Total Display */}
                    <div className={cn(
                      "flex items-center justify-between px-2 py-1.5 rounded-md text-xs",
                      totalCommission > 100 ? "bg-destructive/10 text-destructive" : 
                      totalCommission === 100 ? "bg-emerald-500/10 text-emerald-600" : 
                      "bg-muted text-muted-foreground"
                    )}>
                      <span className="font-medium">Total Commission:</span>
                      <span className="font-bold">{totalCommission}%</span>
                    </div>
                  </CardContent>
                </Card>
                </div>

              </>
            )}
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className={cn("mt-4", isFinancePdfPreviewOpen && "overflow-hidden")}>
            {fullProject && (
              <FinanceSection
                projectId={project.id}
                estimatedCost={fullProject.estimated_cost}
                soldDispatchValue={fullProject.sold_dispatch_value}
                estimatedProjectCost={fullProject.estimated_project_cost}
                totalPl={fullProject.total_pl}
                leadCostPercent={fullProject.lead_cost_percent ?? 18}
                commissionSplitPct={fullProject.commission_split_pct ?? 50}
                salespeople={[
                  { name: fullProject.primary_salesperson, commissionPct: fullProject.primary_commission_pct || 0 },
                  { name: fullProject.secondary_salesperson, commissionPct: fullProject.secondary_commission_pct || 0 },
                  { name: fullProject.tertiary_salesperson, commissionPct: fullProject.tertiary_commission_pct || 0 },
                  { name: fullProject.quaternary_salesperson, commissionPct: fullProject.quaternary_commission_pct || 0 },
                ].filter(s => s.name)}
                onUpdateProject={(updates) => updateProjectMutation.mutate(updates)}
                onNavigateToSubcontractors={handleNavigateToSubcontractors}
                autoOpenBillDialog={autoOpenBillDialog}
                autoOpenFinanceDialog={autoOpenFinanceDialog}
                initialSubTab={initialFinanceSectionTab}
                initialBillsSubTab={initialFinanceSubTab}
                highlightInvoiceId={highlightInvoiceId}
                highlightBillId={highlightBillId}
                highlightPaymentId={highlightPaymentId}
                onSubTabChange={handleFinanceSubTabChange}
                projectStatus={fullProject.project_status}
                projectName={fullProject.project_name}
                projectAddress={fullProject.project_address}
                customerName={`${fullProject.customer_first_name || ''} ${fullProject.customer_last_name || ''}`.trim() || null}
                onPdfPreviewStateChange={setIsFinancePdfPreviewOpen}
                onFinanceSummaryChange={setFinanceSummary}
              />
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <DocumentsSection projectId={project.id} />
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="mt-4">
            <PhotosSection projectId={project.id} />
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-3 mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <CheckSquare className="h-3 w-3" />
                    Office Checklist
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {checklists.filter(c => c.completed).length}/{checklists.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {/* Add new item */}
                <div className="flex gap-1.5">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Add new item..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChecklistItem.trim()) {
                        addChecklistMutation.mutate(newChecklistItem.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        addChecklistMutation.mutate(newChecklistItem.trim());
                      }
                    }}
                    disabled={!newChecklistItem.trim() || addChecklistMutation.isPending}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {checklists.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No checklist items yet
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {checklists.map((item) => {
                      const isOverdue = item.due_date && !item.completed && new Date(item.due_date) < new Date();
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 group",
                            isOverdue && "bg-destructive/10"
                          )}
                        >
                          <Checkbox
                            className="h-3.5 w-3.5"
                            checked={item.completed}
                            onCheckedChange={(checked) => 
                              toggleChecklistMutation.mutate({ id: item.id, completed: !!checked })
                            }
                          />
                          {editingChecklistId === item.id ? (
                            <div className="flex-1 flex gap-1">
                              <Input
                                value={editingChecklistText}
                                onChange={(e) => setEditingChecklistText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editingChecklistText.trim()) {
                                    updateChecklistMutation.mutate({ id: item.id, item: editingChecklistText.trim() });
                                  }
                                  if (e.key === "Escape") {
                                    setEditingChecklistId(null);
                                    setEditingChecklistText("");
                                  }
                                }}
                                autoFocus
                                className="h-6 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  if (editingChecklistText.trim()) {
                                    updateChecklistMutation.mutate({ id: item.id, item: editingChecklistText.trim() });
                                  }
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingChecklistId(null);
                                  setEditingChecklistText("");
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className={cn("flex-1 text-xs", item.completed && "line-through text-muted-foreground")}>
                                {item.item}
                              </span>
                              <Input
                                type="text"
                                placeholder="MM/DD/YYYY"
                                className={cn(
                                  "h-5 w-[90px] text-[10px] px-1",
                                  isOverdue && "border-destructive text-destructive"
                                )}
                                defaultValue={item.due_date ? new Date(item.due_date).toLocaleDateString('en-US') : ""}
                                key={item.due_date}
                                onBlur={(e) => {
                                  const input = e.target.value.trim();
                                  if (!input) {
                                    supabase
                                      .from("project_checklists")
                                      .update({ due_date: null })
                                      .eq("id", item.id)
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
                                      });
                                    return;
                                  }
                                  const parsed = new Date(input);
                                  if (!isNaN(parsed.getTime())) {
                                    const formatted = parsed.toISOString().split('T')[0];
                                    supabase
                                      .from("project_checklists")
                                      .update({ due_date: formatted })
                                      .eq("id", item.id)
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
                                      });
                                  }
                                }}
                              />
                              {isAdmin && (
                                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={() => {
                                      setEditingChecklistId(item.id);
                                      setEditingChecklistText(item.item);
                                    }}
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteChecklistMutation.mutate(item.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-3 mt-4">
            {/* Portal Chat Messages - First */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  Customer Portal Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {portalChatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No chat messages from the customer portal yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto mb-3">
                    {[...portalChatMessages].reverse().map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`p-2 rounded ${
                          msg.sender_type === 'customer' 
                            ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' 
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-xs">
                            {msg.sender_name}
                            {msg.sender_type === 'customer' && (
                              <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0">
                                Customer
                              </Badge>
                            )}
                            {msg.sender_type === 'staff' && (
                              <Badge variant="secondary" className="ml-2 text-[9px] px-1 py-0">
                                Staff
                              </Badge>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reply Input */}
                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    value={portalChatReply}
                    onChange={(e) => setPortalChatReply(e.target.value)}
                    placeholder="Type a reply..."
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatReply();
                      }
                    }}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSendChatReply}
                    disabled={!portalChatReply.trim() || sendChatReplyMutation.isPending}
                  >
                    {sendChatReplyMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Customer Portal Card */}
            {fullProject?.id && (
              <CustomerPortalCard
                projectId={fullProject.id}
                customerName={`${fullProject.customer_first_name || ''} ${fullProject.customer_last_name || ''}`.trim() || fullProject.project_name}
                customerEmail={fullProject.customer_email}
              />
            )}

            {/* Notes Section */}
            <NotesSection projectId={project.id} />

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <Star className="h-3 w-3" />
                  Customer Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {feedback ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Satisfaction Rating</Label>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Star 
                            key={rating}
                            className={`h-4 w-4 ${
                              rating <= (feedback.satisfaction_rank || 0) 
                                ? "fill-amber-500 text-amber-500" 
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {feedback.customer_feedback && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Customer Comments</Label>
                        <p className="text-xs p-2 bg-muted rounded">
                          {feedback.customer_feedback}
                        </p>
                      </div>
                    )}
                    {feedback.online_review_given && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500">
                          Online Review Given
                        </Badge>
                        {feedback.review_location && (
                          <span className="text-[10px] text-muted-foreground">
                            on {feedback.review_location}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No feedback recorded yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  Project Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-2 bg-muted rounded">
                        {msg.is_alert && (
                          <Badge variant="destructive" className="mb-1.5 text-[10px] px-1.5 py-0">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                            Alert
                          </Badge>
                        )}
                        {msg.subject && (
                          <p className="font-medium text-xs">{msg.subject}</p>
                        )}
                        <p className="text-xs">{msg.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Custom Lead Costs Dialog */}
        {fullProject?.id && (
          <CustomLeadCostsDialog
            open={customLeadCostsOpen}
            onOpenChange={setCustomLeadCostsOpen}
            projectId={fullProject.id}
            defaultLeadCostPercent={fullProject.lead_cost_percent ?? 18}
            onWeightedAverageCalculated={(weightedAvg, isWeighted) => {
              // Refetch project data to show updated value
              queryClient.invalidateQueries({ queryKey: ["project-detail", fullProject.id] });
            }}
          />
        )}
      </SheetContent>
    </Sheet>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete project <strong>#{project.project_number} – {project.project_name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingProject}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteProject}
            disabled={isDeletingProject}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingProject ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</> : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
