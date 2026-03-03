import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useEstimateDraft } from "@/hooks/useEstimateDraft";
import { useEstimateDraftDB } from "@/hooks/useEstimateDraftDB";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Trash2, Save, Wand2, Loader2, GripVertical, 
  User, MapPin, Calendar, DollarSign, Percent, FileText,
  ChevronDown, ChevronRight, FolderPlus, TrendingUp, Copy,
  Upload, X, FileIcon, ArrowRight, AlertCircle, HelpCircle, CheckCircle2, Eye, Image
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateOpportunityValueFromEstimates } from "@/lib/estimateValueUtils";
import { AIGenerationProgress } from "./AIGenerationProgress";
import { MissingInfoPanel, parseMissingInfo, groupByCategory, MultiSelectDropdown, type ParsedQuestion } from "./MissingInfoPanel";
import { AISummaryCard } from "./AISummaryCard";
import { PhotosSection } from "@/components/production/PhotosSection";
import { EstimateFilesSection } from "./EstimateFilesSection";
import { EmailSyncDialog } from "@/components/shared/EmailSyncDialog";

import type { LinkedOpportunity } from "./EstimateSourceDialog";

interface EstimateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId?: string | null;
  onSuccess?: () => void;
  /** Explicit close handler for page mode (called when user clicks close/cancel) */
  onClose?: () => void;
  linkedOpportunity?: LinkedOpportunity | null;
  createOpportunityOnSave?: boolean;
  initialWorkScope?: string;
  /** Render mode: 'dialog' (default) shows in a modal, 'page' renders inline content */
  mode?: 'dialog' | 'page';
}

interface LineItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost: number;
  labor_cost: number;
  material_cost: number;
  markup_percent: number;
  line_total: number;
  is_taxable: boolean;
  sort_order: number;
  notes?: string;
}

interface Group {
  id: string;
  group_name: string;
  description: string;
  trade?: string;
  sort_order: number;
  items: LineItem[];
  isOpen: boolean;
}

interface AISummary {
  project_understanding: string[];
  assumptions: string[];
  inclusions: string[];
  exclusions: string[];
  missing_info: string[];
}

const emptyAiSummary: AISummary = {
  project_understanding: [],
  assumptions: [],
  inclusions: [],
  exclusions: [],
  missing_info: [],
};

interface PaymentPhase {
  id: string;
  phase_name: string;
  percent: number;
  amount: number;
  due_type: string;
  due_date: string | null;
  description: string;
  sort_order: number;
}

interface EstimateFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  job_address: string;
  billing_address: string;
  estimate_title: string;
  estimate_date: string;
  expiration_date: string;
  deposit_required: boolean;
  deposit_percent: number;
  deposit_max_amount: number;
  tax_rate: number;
  default_markup_percent: number;
  discount_type: string;
  discount_value: number;
  notes: string;
  notes_to_customer: string;
  terms_and_conditions: string;
  work_scope_description: string;
  sq_ft_to_build: string;
  garage_sq_ft: string;
  finishing_grade: string;
  show_details_to_customer: boolean;
  show_scope_to_customer: boolean;
  show_line_items_to_customer: boolean;
  salesperson_name: string;
}

const itemTypes = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "permit", label: "Permit" },
  { value: "assembly", label: "Assembly" },
  { value: "note", label: "Note" },
];

const units = ["hours", "sqft", "linear ft", "each", "set", "unit", "day", "week"];

const generateId = () => crypto.randomUUID();

export function EstimateBuilderDialog({ open, onOpenChange, estimateId, onSuccess, onClose, linkedOpportunity, createOpportunityOnSave = false, initialWorkScope, mode = 'dialog' }: EstimateBuilderDialogProps) {
  const { user, isSuperAdmin } = useAuth();
  const { companyId: contextCompanyId } = useCompanyContext();
  const queryClient = useQueryClient();
  
  // Track the effective company ID - for existing estimates, use their company_id
  const [estimateCompanyId, setEstimateCompanyId] = useState<string | null>(null);
  
  // Derive the effective companyId: existing estimate's company takes priority over context
  // This allows Super Admins to edit estimates without needing to switch companies first
  const companyId = estimateCompanyId || contextCompanyId;
  
  // Handle clone mode (creating new estimate from declined one)
  const isCloneMode = estimateId?.startsWith("clone:");
  const sourceEstimateId = isCloneMode ? estimateId.replace("clone:", "") : estimateId;
  
  // Track the current estimate ID (updated after first save for new estimates)
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(sourceEstimateId || null);
  
  // Track when the dialog was opened - used to determine if a draft is from the current session
  // Using a ref to persist across re-renders within the same session
  const dialogOpenedAtRef = useRef<number | null>(null);
  
  // Reset currentEstimateId and wasManuallyCleared when dialog opens with a different estimateId
  useEffect(() => {
    if (open) {
      setCurrentEstimateId(sourceEstimateId || null);
      setWasManuallyCleared(false); // Reset manual clear flag on dialog open
      // Reset linked project id when opening, so it never leaks between estimates
      setLinkedProjectId(null);
      // Track when this session started (for draft restoration logic)
      // Only set if not already set (persists across re-renders within same session)
      if (dialogOpenedAtRef.current === null) {
        dialogOpenedAtRef.current = Date.now();
      }

      // Force-refresh the edit query when opening an existing estimate.
      // This avoids showing persisted stale data in the builder.
      if (sourceEstimateId) {
        queryClient.invalidateQueries({ queryKey: ["estimate-edit", sourceEstimateId] });
      }
    } else {
      // Reset when dialog closes
      dialogOpenedAtRef.current = null;
    }
  }, [open, sourceEstimateId, queryClient]);
  
  // isEditing is true if we have a current estimate ID (either from prop or after first save)
  const isEditing = !!currentEstimateId && !isCloneMode;
  
  // Form state
  const [formData, setFormData] = useState<EstimateFormData>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    job_address: "",
    billing_address: "",
    estimate_title: "",
    estimate_date: new Date().toISOString().split("T")[0],
    expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default 7 days
    deposit_required: true,
    deposit_percent: 10,
    deposit_max_amount: 1000,
    tax_rate: 9.5,
    default_markup_percent: 50,
    discount_type: "percent",
    discount_value: 0,
    notes: "",
    notes_to_customer: "",
    terms_and_conditions: "",
    work_scope_description: "",
    sq_ft_to_build: "Home Improvement project",
    garage_sq_ft: "",
    finishing_grade: "Mid",
    show_details_to_customer: false,
    show_scope_to_customer: false,
    show_line_items_to_customer: false,
    salesperson_name: "",
  });

  const [groups, setGroups] = useState<Group[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentPhase[]>([]);
  const [isGeneratingScope, setIsGeneratingScope] = useState(false);
  const [activeTab, setActiveTab] = useState("customer");
  
  // Estimate mode: 'ai' uses AI generation, 'manual' lets user enter total + payment phases directly
  const [estimateMode, setEstimateMode] = useState<'ai' | 'manual'>('ai');
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [manualTotalDraft, setManualTotalDraft] = useState<string>("");
  
  // AI stage tracking for multi-stage generation
  const [currentAIStage, setCurrentAIStage] = useState<string | null>(null);
  const [stageProgress, setStageProgress] = useState<{ current: number; total: number } | null>(null);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);

  // Refs to avoid stale closures inside setTimeout / setInterval callbacks
  const isGeneratingScopeRef = useRef(false);
  const lastAIStageRef = useRef<string | null>(null);
  const stageIndexRef = useRef<number>(0);
  const jobPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isGeneratingScopeRef.current = isGeneratingScope;
  }, [isGeneratingScope]);

  // Ensure we never leave polling timers running
  useEffect(() => {
    return () => {
      if (jobPollIntervalRef.current) {
        clearInterval(jobPollIntervalRef.current);
        jobPollIntervalRef.current = null;
      }
    };
  }, []);
  
  // AI Summary state for assumptions, inclusions/exclusions, missing info
  const [aiSummary, setAiSummary] = useState<AISummary>({ ...emptyAiSummary });
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showWorkScopeDescription, setShowWorkScopeDescription] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);
  
  // Missing info panel state
  const [showMissingInfoPanel, setShowMissingInfoPanel] = useState(false);
  const [isRegeneratingWithAnswers, setIsRegeneratingWithAnswers] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  
  // Controls visibility of the AI progress overlay (user can dismiss it)
  const [showAiProgress, setShowAiProgress] = useState(false);
  
  // Queue position tracking for concurrent AI requests
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  
  // Flag to skip auto-recovery after user manually clears groups
  const [skipAutoRecovery, setSkipAutoRecovery] = useState(false);
  
  // Track if user manually cleared during this editing session (prevents DB reload from overwriting)
  const [wasManuallyCleared, setWasManuallyCleared] = useState(false);
  
  // Plans file upload state
  const [plansFileUrl, setPlansFileUrl] = useState<string | null>(null);
  const [plansFileName, setPlansFileName] = useState<string | null>(null);
  const [isUploadingPlans, setIsUploadingPlans] = useState(false);
  
  // Linked opportunity tracking
  const [linkedOpportunityUuid, setLinkedOpportunityUuid] = useState<string | null>(null);
  const [linkedOpportunityGhlId, setLinkedOpportunityGhlId] = useState<string | null>(null);
  
  // Linked contact tracking
  const [linkedContactUuid, setLinkedContactUuid] = useState<string | null>(null);
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  
  // Lead source tracking (inherited from contact when creating from opportunity)
  const [linkedLeadSource, setLinkedLeadSource] = useState<string | null>(null);

  // Email sync dialog state
  const [emailSyncDialogOpen, setEmailSyncDialogOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [originalEmail, setOriginalEmail] = useState<string | null>(null);

  // Draft string values for money inputs so users can type decimals (e.g. "12.")
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [laborCostDrafts, setLaborCostDrafts] = useState<Record<string, string>>({});
  const [materialCostDrafts, setMaterialCostDrafts] = useState<Record<string, string>>({});
  const [unitPriceDrafts, setUnitPriceDrafts] = useState<Record<string, string>>({});
  // Draft for final price input (auto-discount calculation)
  const [finalPriceDraft, setFinalPriceDraft] = useState<string>("");
  
  // Track validation attempts to show field highlighting
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  
  // Track which save button was clicked to show loading only on that button
  const [savingAction, setSavingAction] = useState<'save' | 'saveClose' | null>(null);
  
  // Flag to track if we've restored a draft (to prevent overwriting with empty data)
  const [draftRestored, setDraftRestored] = useState(false);

  // Prevent initial auto-save from overwriting an existing draft with empty defaults.
  // We only start auto-saving after we've attempted to restore from sessionStorage/DB.
  const [didAttemptDraftRestore, setDidAttemptDraftRestore] = useState(false);
  
  // Draft persistence hook - saves form state to sessionStorage so it survives focus loss
  const { saveDraft, loadDraft, clearDraft } = useEstimateDraft(sourceEstimateId, open);

  // DB-backed draft persistence (one draft per user/company)
  const {
    saveDraft: saveDraftDB,
    flushPending: flushPendingDB,
    loadDraft: loadDraftDB,
    deleteDraft: deleteDraftDB,
  } = useEstimateDraftDB();

  // Auto-save visibility toggles directly to the database when editing an existing estimate
  const autoSaveVisibilityToggle = useCallback(async (field: 'show_scope_to_customer' | 'show_line_items_to_customer' | 'show_details_to_customer', value: boolean) => {
    if (!currentEstimateId || isCloneMode) return;
    
    try {
      const { error } = await supabase
        .from('estimates')
        .update({ [field]: value })
        .eq('id', currentEstimateId);
      
      if (error) {
        console.error('Failed to auto-save visibility toggle:', error);
        toast.error('Failed to save visibility setting');
      }
    } catch (err) {
      console.error('Error auto-saving visibility toggle:', err);
    }
  }, [currentEstimateId, isCloneMode]);
  
  // Memoize draft data to avoid unnecessary re-saves
  const draftData = useMemo(() => ({
    formData,
    groups,
    paymentSchedule,
    activeTab,
    aiSummary,
    linkedProjectId,
    linkedOpportunityUuid,
    linkedOpportunityGhlId,
    plansFileUrl,
    plansFileName,
    estimateMode,
    manualTotal,
  }), [formData, groups, paymentSchedule, activeTab, aiSummary, linkedProjectId, linkedOpportunityUuid, linkedOpportunityGhlId, plansFileUrl, plansFileName, estimateMode, manualTotal]);

  // Keep the latest draft snapshot in a ref so event handlers can always save
  // the most up-to-date values without re-binding listeners on every keystroke.
  const latestDraftDataRef = useRef(draftData);
  useEffect(() => {
    latestDraftDataRef.current = draftData;
  }, [draftData]);

  const saveLatestDraft = useCallback(() => {
    saveDraft(latestDraftDataRef.current);
    // Also save to DB (debounced)
    saveDraftDB(latestDraftDataRef.current);
  }, [saveDraft, saveDraftDB]);
  
  // Auto-save draft to sessionStorage + DB (debounced) when data changes
  useEffect(() => {
    // Only save if dialog is open
    if (!open) return;

    // Critical: don't write an initial empty draft before we've tried to restore.
    // Otherwise the existing "estimate-draft-new" gets overwritten and the form appears cleared.
    if (!didAttemptDraftRestore) return;

    // In edit mode, don't save drafts while line items are still empty in AI mode.
    // This prevents writing an empty draft on first render that can later hide line items.
    if (sourceEstimateId && estimateMode !== 'manual' && groups.length === 0) return;
    
    // Always save if we have the dialog open
    saveDraft(draftData);
    // Debounced DB save
    saveDraftDB(draftData);
  }, [open, didAttemptDraftRestore, sourceEstimateId, estimateMode, groups.length, draftData, saveDraft, saveDraftDB]);
  
  // Force save draft when tab visibility changes (user switches tabs)
  // AND restore draft when user returns to the tab
  useEffect(() => {
    if (!open) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Let any debounced inputs flush their pending values first, then
        // save the latest snapshot.
        setTimeout(() => {
          saveLatestDraft();
          flushPendingDB(); // Also flush pending DB draft
        }, 0);
      } else if (document.visibilityState === 'visible') {
        // User came back to this tab - restore the draft if it exists
        // This handles the case where the component didn't remount but data could be stale
        const sessionDraft = loadDraft();
        if (sessionDraft && sessionDraft.savedAt) {
          // Restore if the draft was saved AFTER the dialog was opened in this session
          // This ensures we restore any edits made during this editing session
          const dialogOpenTime = dialogOpenedAtRef.current || 0;
          
          if (sessionDraft.savedAt >= dialogOpenTime) {
            console.log('Restoring draft on tab return (saved at:', new Date(sessionDraft.savedAt).toISOString(), ')');
            setFormData(sessionDraft.formData);
            setGroups(sessionDraft.groups || []);
            setPaymentSchedule(sessionDraft.paymentSchedule || []);
            // Don't change activeTab - keep user on current tab
            setAiSummary(sessionDraft.aiSummary || { ...emptyAiSummary });
            setLinkedProjectId(sessionDraft.linkedProjectId);
            setLinkedOpportunityUuid(sessionDraft.linkedOpportunityUuid);
            setLinkedOpportunityGhlId(sessionDraft.linkedOpportunityGhlId);
            setPlansFileUrl(sessionDraft.plansFileUrl);
            setPlansFileName(sessionDraft.plansFileName);
            if (sessionDraft.estimateMode) setEstimateMode(sessionDraft.estimateMode);
            if (sessionDraft.manualTotal !== undefined) setManualTotal(sessionDraft.manualTotal);
          }
        }
      }
    };
    
    const handleBeforeUnload = () => {
      // Save before page unload
      saveLatestDraft();
      flushPendingDB();
    };

    const handlePageHide = () => {
      // Save on navigation/close (more reliable than beforeunload in some cases)
      saveLatestDraft();
      flushPendingDB();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [open, saveLatestDraft, flushPendingDB, loadDraft]);
  
  // Restore draft from sessionStorage (or DB fallback) when dialog opens
  useEffect(() => {
    if (!open) {
      setDraftRestored(false);
      setDidAttemptDraftRestore(false);
      return;
    }

    const restoreFromDraft = (draft: Partial<typeof draftData> & { savedAt?: number }) => {
      console.log('Restoring draft:', draft.formData?.job_address);
      if (draft.formData) setFormData(draft.formData);
      setGroups(draft.groups || []);
      setPaymentSchedule(draft.paymentSchedule || []);
      setActiveTab(draft.activeTab || "customer");
      setAiSummary(draft.aiSummary || { ...emptyAiSummary });
      setLinkedProjectId(draft.linkedProjectId ?? null);
      setLinkedOpportunityUuid(draft.linkedOpportunityUuid ?? null);
      setLinkedOpportunityGhlId(draft.linkedOpportunityGhlId ?? null);
      setPlansFileUrl(draft.plansFileUrl ?? null);
      setPlansFileName(draft.plansFileName ?? null);
      if (draft.estimateMode) setEstimateMode(draft.estimateMode);
      if (draft.manualTotal !== undefined) setManualTotal(draft.manualTotal);
      setDraftRestored(true);
      // Prevent DB data from overwriting restored draft
      setWasManuallyCleared(true);
    };

    // Helper to check if draft is from current editing session (within last 30 seconds of dialog open)
    // This allows restoration when user switches tabs but prevents stale drafts from previous sessions
    const isDraftFromCurrentSession = (draftSavedAt: number | undefined): boolean => {
      if (!draftSavedAt) return false;
      // If dialog just opened, check if draft was saved very recently (within 30 seconds before open)
      // This handles the case where user switched tabs and came back
      const sessionStartBuffer = 30 * 1000; // 30 seconds buffer
      const openedAt = dialogOpenedAtRef.current;
      return openedAt ? draftSavedAt >= (openedAt - sessionStartBuffer) : false;
    };

    // For existing estimates (edit mode), only restore drafts from the CURRENT session
    // and only when they contain meaningful line-item/financial data.
    // This avoids restoring an accidentally auto-saved empty draft.
    if (sourceEstimateId) {
      const sessionDraft = loadDraft();
      const hasLineItemsDraft = Array.isArray(sessionDraft?.groups)
        ? sessionDraft.groups.some((g: any) => Array.isArray(g?.items) && g.items.length > 0)
        : false;
      const hasManualDraft =
        sessionDraft?.estimateMode === 'manual' &&
        typeof sessionDraft?.manualTotal === 'number' &&
        sessionDraft.manualTotal > 0;

      if (
        sessionDraft &&
        isDraftFromCurrentSession(sessionDraft.savedAt) &&
        (hasLineItemsDraft || hasManualDraft)
      ) {
        console.log('Restoring current-session draft for existing estimate');
        restoreFromDraft(sessionDraft);
      }
      setDidAttemptDraftRestore(true);
      return;
    }
    
    // For NEW estimates: restore any available draft (original behavior)
    const sessionDraft = loadDraft();
    if (sessionDraft) {
      restoreFromDraft(sessionDraft);
      setDidAttemptDraftRestore(true);
      return;
    }

    // Otherwise try DB (async fallback) - only for new estimates
    loadDraftDB()
      .then((dbDraft) => {
        if (dbDraft) {
          restoreFromDraft(dbDraft);
        }
      })
      .finally(() => {
        setDidAttemptDraftRestore(true);
      });
  }, [open, loadDraft, loadDraftDB, sourceEstimateId]);

  // Fetch projects for linking
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-linking", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, customer_first_name, customer_last_name, project_address")
        .eq("company_id", companyId)
        .order("project_number", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId,
  });

  // Fetch salespeople for selection
  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-for-estimate", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId,
  });

  // Helper to get salesperson_id from salesperson_name
  const getSalespersonId = useCallback((name: string | null | undefined): string | null => {
    if (!name) return null;
    const sp = salespeople.find(s => s.name === name);
    return sp?.id || null;
  }, [salespeople]);

  const formatPhoneNumber = useCallback((value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format based on length
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }, []);
  const calculateTotals = useCallback(() => {
    // Manual mode: use user-entered total directly
    if (estimateMode === 'manual') {
      const total = Math.round(manualTotal * 100) / 100;
      const percentDeposit = Math.round((total * formData.deposit_percent) / 100 * 100) / 100;
      const depositAmount = Math.min(percentDeposit, formData.deposit_max_amount);
      return { subtotal: total, totalCost: 0, grossProfit: total, marginPercent: 100, discountAmount: 0, total, depositAmount };
    }
    
    const subtotal = Math.round(groups.reduce((sum, group) => 
      sum + group.items.reduce((itemSum, item) => itemSum + item.line_total, 0), 0
    ) * 100) / 100;
    
    const totalCost = groups.reduce((sum, group) => 
      sum + group.items.reduce((itemSum, item) => itemSum + (item.quantity * item.cost), 0), 0
    );
    
    let discountAmount = 0;
    if (formData.discount_type === "percent") {
      discountAmount = Math.round((subtotal * formData.discount_value) / 100 * 100) / 100;
    } else {
      discountAmount = formData.discount_value;
    }
    
    // Total = Subtotal - Discount (no tax), rounded to the penny
    const total = Math.round((subtotal - discountAmount) * 100) / 100;
    // Deposit = min(total * percent, max_amount)
    const percentDeposit = Math.round((total * formData.deposit_percent) / 100 * 100) / 100;
    const depositAmount = Math.min(percentDeposit, formData.deposit_max_amount);
    const grossProfit = Math.round((subtotal - totalCost) * 100) / 100;
    const marginPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    
    return { subtotal, totalCost, grossProfit, marginPercent, discountAmount, total, depositAmount };
  }, [estimateMode, manualTotal, groups, formData.discount_type, formData.discount_value, formData.deposit_percent, formData.deposit_max_amount]);

  const totals = calculateTotals();

  // Apply final price: recalculates markup/discount to hit the desired total
  const applyFinalPrice = useCallback(() => {
    const finalPrice = parseFloat(finalPriceDraft);
    if (isNaN(finalPrice) || finalPrice < 0) return;
    
    const roundedSubtotal = Math.round(totals.subtotal * 100) / 100;
    if (finalPrice > roundedSubtotal) {
      const bufferAmount = 1200;
      
      if (totals.subtotal > 0 && totals.totalCost > 0) {
        const targetPreDiscountTotal = finalPrice + bufferAmount;
        const scaleFactor = targetPreDiscountTotal / totals.subtotal;
        const newMarkupPercent = ((totals.subtotal * scaleFactor / totals.totalCost) - 1) * 100;
        
        let newSubtotal = 0;
        groups.forEach(g => {
          g.items.forEach(item => {
            const newUnitPrice = Math.round(item.cost * (1 + newMarkupPercent / 100) * 100) / 100;
            const newLineTotal = Math.round(item.quantity * newUnitPrice * 100) / 100;
            newSubtotal += newLineTotal;
          });
        });
        newSubtotal = Math.round(newSubtotal * 100) / 100;
        const requiredDiscount = Math.round((newSubtotal - finalPrice) * 100) / 100;
        
        setGroups(prevGroups => prevGroups.map(g => ({
          ...g,
          items: g.items.map(item => {
            const newUnitPrice = item.cost * (1 + newMarkupPercent / 100);
            return {
              ...item,
              markup_percent: Math.round(newMarkupPercent * 100) / 100,
              unit_price: Math.round(newUnitPrice * 100) / 100,
              line_total: Math.round(item.quantity * newUnitPrice * 100) / 100,
            };
          }),
        })));
        
        setFormData(prev => ({ 
          ...prev, 
          discount_type: 'fixed',
          discount_value: requiredDiscount,
          default_markup_percent: Math.round(newMarkupPercent * 100) / 100
        }));
      }
    } else {
      const newDiscount = Math.max(0, Math.round((roundedSubtotal - finalPrice) * 100) / 100);
      setFormData(prev => ({ 
        ...prev, 
        discount_type: 'fixed',
        discount_value: newDiscount 
      }));
    }
    setFinalPriceDraft('');
    toast.success(`Final price set to $${finalPrice.toLocaleString()}`);
  }, [finalPriceDraft, totals, groups, setGroups, setFormData]);

  // Fetch default terms & conditions from company settings first, then app settings
  const { data: defaultTerms } = useQuery({
    queryKey: ["default-terms-conditions", companyId],
    queryFn: async () => {
      // Try company_settings first if companyId is available
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "default_terms_and_conditions")
          .maybeSingle();
        if (companyData?.setting_value) {
          return companyData.setting_value;
        }
      }
      // Fall back to app_settings
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_terms_and_conditions")
        .maybeSingle();
      return data?.setting_value || "";
    },
    enabled: open && !estimateId, // Only fetch for new estimates
    staleTime: 0, // Always fetch fresh settings
  });

  const { data: defaultMarkupSetting } = useQuery({
    queryKey: ["default-markup-percent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_markup_percent")
        .maybeSingle();
      return data?.setting_value ? parseFloat(data.setting_value) : 50;
    },
    enabled: open && !estimateId, // Only fetch for new estimates
    staleTime: 0, // Always fetch fresh settings
  });

  // Fetch default deposit settings, expiration days, and plans max size from company settings
  const { data: estimateDefaults } = useQuery({
    queryKey: ["default-estimate-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["default_deposit_percent", "default_deposit_max_amount", "estimate_expiration_days"]);
      
      const settings: { percent: number; maxAmount: number; expirationDays: number } = {
        percent: 10,
        maxAmount: 1000,
        expirationDays: 7, // Default to 7 days
      };
      
      (data || []).forEach((s: any) => {
        if (s.setting_key === "default_deposit_percent" && s.setting_value) {
          settings.percent = parseFloat(s.setting_value);
        }
        if (s.setting_key === "default_deposit_max_amount" && s.setting_value) {
          settings.maxAmount = parseFloat(s.setting_value);
        }
        if (s.setting_key === "estimate_expiration_days" && s.setting_value) {
          settings.expirationDays = parseInt(s.setting_value, 10);
        }
      });
      
      return settings;
    },
    enabled: open && !estimateId && !!companyId, // Only fetch for new estimates
    staleTime: 0, // Always fetch fresh settings
  });

  // Fetch plans max file size from company settings (with app_settings fallback)
  const { data: plansMaxSizeMb } = useQuery({
    queryKey: ["estimate-plans-max-size", companyId],
    queryFn: async () => {
      // Try company_settings first
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "estimate_plans_max_size_mb")
          .maybeSingle();
        if (companyData?.setting_value) {
          return parseInt(companyData.setting_value, 10);
        }
      }
      // Fall back to app_settings
      const { data: appData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "estimate_plans_max_size_mb")
        .maybeSingle();
      if (appData?.setting_value) {
        return parseInt(appData.setting_value, 10);
      }
      // Default to 50MB if not configured
      return 50;
    },
    enabled: open,
    staleTime: 0, // Always fetch fresh settings
  });

  // Invalidate cache when dialog opens with an estimate ID to ensure fresh data
  useEffect(() => {
    if (open && sourceEstimateId) {
      queryClient.invalidateQueries({ queryKey: ["estimate-edit", sourceEstimateId] });
    }
  }, [open, sourceEstimateId, queryClient]);

  // Fetch existing estimate if editing or cloning
  // IMPORTANT: React Query cache is persisted (IndexedDB). If an estimate was updated
  // in another tab/session, a "fresh" cached copy can show stale totals in the builder.
  // Force a refetch whenever the builder is opened/focused.
  const { data: existingEstimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["estimate-edit", sourceEstimateId],
    queryFn: async () => {
      if (!sourceEstimateId) return null;
      
      const [estimateRes, groupsRes, itemsRes, scheduleRes] = await Promise.all([
        supabase.from("estimates").select("*").eq("id", sourceEstimateId).single(),
        supabase.from("estimate_groups").select("*").eq("estimate_id", sourceEstimateId).order("sort_order"),
        supabase.from("estimate_line_items").select("*").eq("estimate_id", sourceEstimateId).order("sort_order"),
        supabase.from("estimate_payment_schedule").select("*").eq("estimate_id", sourceEstimateId).order("sort_order"),
      ]);
      
      return {
        estimate: estimateRes.data,
        groups: groupsRes.data || [],
        items: itemsRes.data || [],
        schedule: scheduleRes.data || [],
        isClone: isCloneMode,
      };
    },
    enabled: !!sourceEstimateId && open,
    staleTime: 0,
    gcTime: 0, // Don't cache this at all - always fetch fresh
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // isProposalReadOnly is now always false - proposals can be edited and saved with changes
  // Previously this prevented editing proposals that were sent to customers
  const isProposalReadOnly = false;

  // Sync salesperson to linked project when estimate is in pre-proposal (draft) status
  const syncSalespersonToProject = useCallback(async (salespersonName: string) => {
    // Only sync if:
    // 1. We have a linked project
    // 2. The estimate is in draft status (pre-proposal)
    const projectId = linkedProjectId || existingEstimate?.estimate?.project_id;
    const estimateStatus = existingEstimate?.estimate?.status;
    
    if (!projectId || (estimateStatus && estimateStatus !== 'draft')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          primary_salesperson: salespersonName || null,
          project_manager: salespersonName || null,
        })
        .eq('id', projectId);
      
      if (error) {
        console.error('Failed to sync salesperson to project:', error);
      } else {
        console.log('Synced salesperson to project:', salespersonName);
      }
    } catch (err) {
      console.error('Error syncing salesperson to project:', err);
    }
  }, [linkedProjectId, existingEstimate?.estimate?.project_id, existingEstimate?.estimate?.status]);

  // Populate form when editing (skip if user manually cleared during this session)
  useEffect(() => {
    if (existingEstimate?.estimate && !wasManuallyCleared) {
      const est = existingEstimate.estimate;
      
      // Infer markup percent from existing line items (use the first item's markup, or default to 50)
      const existingMarkup = existingEstimate.items.length > 0 
        ? existingEstimate.items[0].markup_percent ?? 50
        : 50;
      
      setFormData({
        customer_name: est.customer_name || "",
        customer_email: est.customer_email || "",
        customer_phone: est.customer_phone || "",
        job_address: est.job_address || "",
        billing_address: est.billing_address || "",
        estimate_title: est.estimate_title || "",
        estimate_date: est.estimate_date || new Date().toISOString().split("T")[0],
        expiration_date: est.expiration_date || "",
        deposit_required: est.deposit_required || false,
        deposit_percent: est.deposit_percent || 10,
        deposit_max_amount: (est as any).deposit_max_amount || 1000,
        tax_rate: est.tax_rate || 9.5,
        default_markup_percent: existingMarkup,
        discount_type: est.discount_type || "percent",
        discount_value: est.discount_value || 0,
        notes: est.notes || "",
        notes_to_customer: (est as any).notes_to_customer || "",
        terms_and_conditions: est.terms_and_conditions || "",
        work_scope_description: est.work_scope_description || "",
        sq_ft_to_build: est.sq_ft_to_build || "Home Improvement project",
        garage_sq_ft: est.garage_sq_ft || "",
        finishing_grade: est.finishing_grade || "Mid",
        show_details_to_customer: est.show_details_to_customer ?? false,
        show_scope_to_customer: est.show_scope_to_customer ?? false,
        show_line_items_to_customer: est.show_line_items_to_customer ?? false,
        salesperson_name: est.salesperson_name || "",
      });

      // Populate groups with items - ensure labor_cost/material_cost are populated
      const groupsWithItems = existingEstimate.groups.map((g: any) => ({
        ...g,
        isOpen: false,
        items: existingEstimate.items
          .filter((i: any) => i.group_id === g.id)
          .map((i: any) => ({
            ...i,
            labor_cost: i.labor_cost ?? (i.item_type === 'labor' ? (i.cost || 0) : 0),
            material_cost: i.material_cost ?? (i.item_type === 'material' ? (i.cost || 0) : 0),
            // Ensure computed totals exist even for legacy items that didn't have them persisted
            cost:
              (i.cost ?? 0) ||
              ((i.labor_cost ?? (i.item_type === 'labor' ? (i.cost || 0) : 0)) +
                (i.material_cost ?? (i.item_type === 'material' ? (i.cost || 0) : 0))),
            unit_price:
              i.unit_price ??
              (((i.cost ?? 0) ||
                ((i.labor_cost ?? (i.item_type === 'labor' ? (i.cost || 0) : 0)) +
                  (i.material_cost ?? (i.item_type === 'material' ? (i.cost || 0) : 0)))) *
                (1 + ((i.markup_percent ?? existingMarkup) / 100))),
            line_total:
              i.line_total ??
              ((i.quantity ?? 1) *
                (i.unit_price ??
                  (((i.cost ?? 0) ||
                    ((i.labor_cost ?? (i.item_type === 'labor' ? (i.cost || 0) : 0)) +
                      (i.material_cost ?? (i.item_type === 'material' ? (i.cost || 0) : 0)))) *
                    (1 + ((i.markup_percent ?? existingMarkup) / 100))))),
            notes: i.notes || "",
          })),
      }));
      setGroups(groupsWithItems);
      
      // Populate payment schedule (exclude Deposit since it's shown as a separate uneditable row)
      setPaymentSchedule(
        existingEstimate.schedule
          .filter((s: any) => s.phase_name !== "Deposit")
          .map((s: any) => ({ ...s }))
      );

      // Set linked project - CRITICAL for Photos tab visibility
      console.log("[EstimateBuilder] Setting linkedProjectId:", est.project_id);
      // IMPORTANT: if we just created a project during this session, keep that value
      // even if the edit query hasn't refetched yet (it may still have project_id = null).
      setLinkedProjectId((prev) => prev || est.project_id || null);
      
      // CRITICAL: Set linked opportunity and contact IDs from existing estimate
      // Without this, re-saving an existing estimate clears these links
      setLinkedOpportunityUuid(est.opportunity_uuid || null);
      setLinkedOpportunityGhlId(est.opportunity_id || null);
      setLinkedContactUuid(est.contact_uuid || null);
      setLinkedContactId(est.contact_id || null);
      
      // Set the estimate's company ID (important for Super Admins editing existing estimates)
      if (est.company_id) {
        setEstimateCompanyId(est.company_id);
      }
      
      // Set plans file URL if present
      if (est.plans_file_url) {
        setPlansFileUrl(est.plans_file_url);
        // Extract filename from URL
        try {
          const urlPath = new URL(est.plans_file_url).pathname;
          const fileName = urlPath.split('/').pop() || 'plans';
          setPlansFileName(fileName);
        } catch {
          setPlansFileName('Uploaded plans');
        }
      }

      // Populate AI analysis sections (Project Understanding, Assumptions, Inclusions, Exclusions, Missing Info)
      const ai = (est as any).ai_analysis as Partial<AISummary> | null;
      if (ai && typeof ai === "object") {
        const nextSummary: AISummary = {
          project_understanding: Array.isArray(ai.project_understanding) ? ai.project_understanding : [],
          assumptions: Array.isArray(ai.assumptions) ? ai.assumptions : [],
          inclusions: Array.isArray(ai.inclusions) ? ai.inclusions : [],
          exclusions: Array.isArray(ai.exclusions) ? ai.exclusions : [],
          missing_info: Array.isArray(ai.missing_info) ? ai.missing_info : [],
        };
        setAiSummary(nextSummary);

        // AI Summary card defaults to collapsed - don't auto-open
      } else {
        setAiSummary({ ...emptyAiSummary });
      }

      // Restore estimate mode and manual total from DB
      if (est.estimate_mode === 'manual') {
        setEstimateMode('manual');
        setManualTotal((est as any).manual_total || 0);
      } else {
        setEstimateMode('ai');
      }
    }
  }, [existingEstimate, wasManuallyCleared]);

  // Reset form when dialog opens for new estimate.
  // Important: wait until we've attempted to restore a draft.
  // Otherwise on mount the restore effect can run, but this reset effect still runs with the
  // pre-restore values and wipes the restored draft.
  // Also skip reset if we have a linkedOpportunity - let that effect handle population instead.
  useEffect(() => {
    if (open && !estimateId && didAttemptDraftRestore && !draftRestored && !linkedOpportunity) {
      setFormData({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        job_address: "",
        billing_address: "",
        estimate_title: "",
        estimate_date: new Date().toISOString().split("T")[0],
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default 7 days
        deposit_required: true,
        deposit_percent: 10,
        deposit_max_amount: 1000,
        tax_rate: 9.5,
        default_markup_percent: 50,
        discount_type: "percent",
        discount_value: 0,
        notes: "",
        notes_to_customer: "",
        terms_and_conditions: "",
        work_scope_description: "",
        sq_ft_to_build: "Home Improvement project",
        garage_sq_ft: "",
        finishing_grade: "Mid",
        show_details_to_customer: false,
        show_scope_to_customer: false,
        show_line_items_to_customer: false,
        salesperson_name: "",
      });
      setGroups([]);
      setPaymentSchedule([]);
      setActiveTab("customer");
      setLinkedProjectId(null);
      setLinkedOpportunityUuid(null);
      setLinkedOpportunityGhlId(null);
      setLinkedContactUuid(null);
      setLinkedContactId(null);
      setLinkedLeadSource(null);
      setPlansFileUrl(null);
      setPlansFileName(null);
      setEstimateCompanyId(null); // Reset for new estimates - will use contextCompanyId
      setSkipAutoRecovery(false); // Allow recovery for fresh estimates
      setWasManuallyCleared(false); // Allow DB population for fresh estimates

      // Reset AI analysis UI
      setAiSummary({ ...emptyAiSummary });
      setShowAiSummary(false);
      setShowMissingInfoPanel(false);
      setIsRegeneratingWithAnswers(false);
    }
  }, [open, estimateId, didAttemptDraftRestore, draftRestored, linkedOpportunity]);

  // Auto-populate from linked opportunity when provided
  // Important: Must wait for draft restore attempt to complete, otherwise the reset effect
  // will wipe out the populated data. Only populate if no draft was restored.
  useEffect(() => {
    const populateFromOpportunity = async () => {
    if (open && linkedOpportunity && !estimateId && didAttemptDraftRestore && !draftRestored) {
      // Set opportunity tracking (only if there's a real opportunity ID)
      if (linkedOpportunity.id) {
        setLinkedOpportunityUuid(linkedOpportunity.id);
        setLinkedOpportunityGhlId(linkedOpportunity.ghl_id);
      }
      
      // Set contact tracking from opportunity
      if (linkedOpportunity.contact_uuid) {
        setLinkedContactUuid(linkedOpportunity.contact_uuid);
        setLinkedContactId(linkedOpportunity.contact_id);
      }
      
      // Set lead source from opportunity's contact
      if (linkedOpportunity.lead_source) {
        setLinkedLeadSource(linkedOpportunity.lead_source);
      }
      
      // Determine the work scope: prefer initialWorkScope, then linkedOpportunity.scope_of_work
      const workScope = initialWorkScope || linkedOpportunity.scope_of_work || "";
      
      // Auto-fill form data from opportunity
      // If contact_name/email are missing but we have a contact_uuid, fetch from DB
      let contactName = linkedOpportunity.contact_name || null;
      let contactEmail = linkedOpportunity.contact_email || null;
      let contactPhone = linkedOpportunity.contact_phone || null;
      
      if (linkedOpportunity.contact_uuid && (!contactName || !contactEmail)) {
        try {
          const { data: contact } = await supabase
            .from("contacts")
            .select("contact_name, email, phone")
            .eq("id", linkedOpportunity.contact_uuid)
            .maybeSingle();
          if (contact) {
            contactName = contactName || contact.contact_name;
            contactEmail = contactEmail || contact.email;
            contactPhone = contactPhone || contact.phone;
          }
        } catch (err) {
          console.warn("Failed to fetch contact info for estimate:", err);
        }
      }
      
      setFormData(prev => ({
        ...prev,
        customer_name: contactName || prev.customer_name,
        customer_email: contactEmail || prev.customer_email,
        customer_phone: contactPhone || prev.customer_phone,
        job_address: linkedOpportunity.address || prev.job_address,
        work_scope_description: workScope || prev.work_scope_description,
        salesperson_name: linkedOpportunity.salesperson_name || prev.salesperson_name,
      }));
    }
    };
    populateFromOpportunity();
  }, [open, linkedOpportunity, estimateId, initialWorkScope, didAttemptDraftRestore, draftRestored]);

  // Apply default terms when they're loaded for new estimates
  useEffect(() => {
    if (open && !estimateId && defaultTerms && !formData.terms_and_conditions) {
      setFormData(prev => ({
        ...prev,
        terms_and_conditions: defaultTerms,
      }));
    }
  }, [open, estimateId, defaultTerms]);

  // Apply default markup from admin settings when loaded for new estimates
  useEffect(() => {
    if (open && !estimateId && defaultMarkupSetting !== undefined && formData.default_markup_percent === 50) {
      setFormData(prev => ({
        ...prev,
        default_markup_percent: defaultMarkupSetting,
      }));
    }
  }, [open, estimateId, defaultMarkupSetting]);

  // Apply default deposit and expiration settings when loaded for new estimates
  useEffect(() => {
    if (open && !estimateId && estimateDefaults) {
      const expirationDate = new Date(Date.now() + estimateDefaults.expirationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setFormData(prev => ({
        ...prev,
        deposit_percent: estimateDefaults.percent,
        deposit_max_amount: estimateDefaults.maxAmount,
        expiration_date: expirationDate,
      }));
    }
  }, [open, estimateId, estimateDefaults]);

  // Plans file upload handler
  const handlePlansUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file (JPG, PNG, WebP)');
      return;
    }

    // Validate file size based on company setting (default 50MB)
    const effectiveMaxSize = plansMaxSizeMb || 50;
    const maxSizeBytes = effectiveMaxSize * 1024 * 1024;
    console.log('Plans upload - Max size setting:', effectiveMaxSize, 'MB, File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    if (file.size > maxSizeBytes) {
      toast.error(`File is too large. Maximum size is ${effectiveMaxSize}MB.`);
      return;
    }

    setIsUploadingPlans(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('estimate-plans')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL for access (private bucket)
      const { data: urlData } = await supabase.storage
        .from('estimate-plans')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

      if (urlData?.signedUrl) {
        setPlansFileUrl(urlData.signedUrl);
        setPlansFileName(file.name);
        toast.success('Plans file uploaded successfully');
      }
    } catch (err: any) {
      console.error('Error uploading plans:', err);
      // Provide more specific error message for size limit errors
      if (err?.statusCode === '413' || err?.message?.includes('exceeded the maximum')) {
        toast.error(`File is too large. The storage limit is 100MB. Your file may be larger than expected.`);
      } else {
        toast.error('Failed to upload plans file');
      }
    } finally {
      setIsUploadingPlans(false);
    }
  };

  const removePlansFile = () => {
    setPlansFileUrl(null);
    setPlansFileName(null);
  };

  // Helper to persist AI analysis to the database immediately (for existing estimates)
  const persistAIAnalysis = useCallback(async (estimateId: string | null, aiAnalysis: AISummary) => {
    if (!estimateId || !companyId) return;
    
    // Only persist if there's actual content
    const hasContent = 
      aiAnalysis.project_understanding.length > 0 ||
      aiAnalysis.assumptions.length > 0 ||
      aiAnalysis.inclusions.length > 0 ||
      aiAnalysis.exclusions.length > 0 ||
      aiAnalysis.missing_info.length > 0;
    
    if (!hasContent) return;
    
    try {
      const { error } = await supabase
        .from('estimates')
        .update({ 
          ai_analysis: {
            project_understanding: aiAnalysis.project_understanding,
            assumptions: aiAnalysis.assumptions,
            inclusions: aiAnalysis.inclusions,
            exclusions: aiAnalysis.exclusions,
            missing_info: aiAnalysis.missing_info,
          }
        })
        .eq('id', estimateId)
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Failed to persist AI analysis:', error);
      } else {
        console.log('AI analysis persisted to database');
      }
    } catch (err) {
      console.error('Error persisting AI analysis:', err);
    }
  }, [companyId]);

  // Helper to process AI scope result and update state - always replaces existing groups
  const applyAIScope = useCallback((scope: any) => {
    // Replace all groups with AI-generated ones - always use the form's default markup
    const newGroups: Group[] = scope.groups.map((g: any, gIdx: number) => ({
      id: generateId(),
      group_name: g.group_name,
      description: g.description || "",
      sort_order: gIdx,
      isOpen: false,
      items: g.items.map((item: any, iIdx: number) => {
        // AI now returns labor_cost/material_cost; some models may omit `cost`.
        const parseNum = (v: any) => {
          if (v === null || v === undefined) return 0;
          if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
          const cleaned = String(v).replace(/,/g, '').trim();
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        };

        const laborCost = parseNum(item.labor_cost);
        const materialCost = parseNum(item.material_cost);
        const costFromAi = parseNum(item.cost);
        const derivedCost = costFromAi > 0 ? costFromAi : (laborCost + materialCost);
        const itemCost = derivedCost;
        // Always use the form's default markup, ignore AI markup suggestions
        const itemMarkup = formData.default_markup_percent;
        const itemUnitPrice = itemCost * (1 + itemMarkup / 100);
        const itemQuantity = item.quantity || 1;
        
        // Ensure both fields exist (0 when not applicable)
        const normalizedLaborCost = laborCost || (item.item_type === 'labor' ? itemCost : 0);
        const normalizedMaterialCost = materialCost || (item.item_type === 'material' ? itemCost : 0);
        
        return {
          id: generateId(),
          item_type: item.item_type || "material",
          description: item.description,
          quantity: itemQuantity,
          unit: item.unit || "each",
          cost: itemCost,
          labor_cost: normalizedLaborCost,
          material_cost: normalizedMaterialCost,
          markup_percent: itemMarkup,
          unit_price: itemUnitPrice,
          line_total: itemQuantity * itemUnitPrice,
          is_taxable: item.is_taxable !== false,
          sort_order: iIdx,
          notes: item.notes || "",
        };
      }),
    }));

    // Replace all groups (don't append) to avoid duplicates on regeneration
    setGroups(newGroups);

    // Build payment schedule from groups (by area phases) instead of AI suggestions
    // Each group becomes a payment phase proportional to its cost share
    const groupTotals = newGroups.map(g => ({
      name: g.group_name,
      total: g.items.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0),
    }));
    const grandTotal = groupTotals.reduce((sum, g) => sum + g.total, 0);

    // Always insert "Materials Delivered" as one of the first phases at 15%
    const materialsPhase: PaymentPhase = {
      id: generateId(),
      phase_name: "Materials Delivered",
      percent: 15,
      amount: 0,
      due_type: "milestone",
      due_date: null,
      description: "Upon delivery of materials to job site",
      sort_order: 0,
    };

    // Remaining 85% distributed proportionally among groups
    let generatedPhases: PaymentPhase[] = groupTotals.map((g, idx) => ({
      id: generateId(),
      phase_name: g.name,
      percent: grandTotal > 0 ? Math.round((g.total / grandTotal) * 85) : 0,
      amount: 0,
      due_type: "milestone",
      due_date: null,
      description: "",
      sort_order: idx + 1,
    }));

    // Ensure the final phase is at least 10% of total
    if (generatedPhases.length > 1) {
      const lastPhase = generatedPhases[generatedPhases.length - 1];
      if (lastPhase.percent < 10) {
        const deficit = 10 - lastPhase.percent;
        lastPhase.percent = 10;
        // Take from the largest non-final phase
        const nonFinal = generatedPhases.slice(0, -1);
        const largestIdx = nonFinal.reduce((maxIdx, p, idx) =>
          p.percent > nonFinal[maxIdx].percent ? idx : maxIdx, 0);
        generatedPhases[largestIdx].percent -= deficit;
      }
    }

    // Normalize group phases to sum to 85%
    const groupPercent = generatedPhases.reduce((sum, p) => sum + p.percent, 0);
    if (groupPercent !== 85 && generatedPhases.length > 0) {
      generatedPhases[0].percent += (85 - groupPercent);
    }

    // Combine: Materials Delivered first, then group phases
    generatedPhases = [materialsPhase, ...generatedPhases];

    setPaymentSchedule(generatedPhases);

    // Update tax rate if suggested (but NOT deposit - keep company defaults)
    if (scope.suggested_tax_rate) {
      setFormData(prev => ({ ...prev, tax_rate: scope.suggested_tax_rate }));
    }
    // Note: We no longer override deposit_percent from AI - company settings take precedence
    if (scope.notes) {
      setFormData(prev => ({ ...prev, notes: prev.notes ? `${prev.notes}\n\n${scope.notes}` : scope.notes }));
    }
    
    // Capture AI summary sections if provided
    const newAiSummary = {
      project_understanding: scope.project_understanding || [],
      assumptions: scope.assumptions || [],
      inclusions: scope.inclusions || [],
      exclusions: scope.exclusions || [],
      missing_info: scope.missing_info || [],
    };
    setAiSummary(newAiSummary);
    
    // AI Summary card defaults to collapsed - user can expand if needed

    toast.success("AI estimate generated successfully!");
    setActiveTab("scope");
    
    // Return the AI summary so callers can persist it immediately
    return newAiSummary;
  }, [formData.default_markup_percent]);

  // Check for completed/recovered AI generation jobs and apply results
  useEffect(() => {
    // Skip if: dialog closed, no estimate ID, already have groups, or user manually cleared
    if (!open || !currentEstimateId || groups.length > 0 || skipAutoRecovery) return;
    
    const checkForCompletedJob = async () => {
      try {
        // Look for a completed job with result_json that hasn't been applied
        const { data: completedJob, error } = await supabase
          .from('estimate_generation_jobs')
          .select('id, result_json, status')
          .eq('estimate_id', currentEstimateId)
          .eq('status', 'completed')
          .not('result_json', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error || !completedJob?.result_json) return;
        
        // Check if the estimate already has groups (don't re-apply)
        const { data: existingGroups } = await supabase
          .from('estimate_groups')
          .select('id')
          .eq('estimate_id', currentEstimateId)
          .limit(1);
        
        if (existingGroups && existingGroups.length > 0) return;
        
        // Apply the recovered/completed job result
        const result = completedJob.result_json as { scope?: any; recovered?: boolean };
        if (result.scope) {
          console.log('Found completed AI job, applying results...');
          const aiAnalysis = applyAIScope(result.scope);
          // Persist AI analysis immediately for existing estimates
          if (aiAnalysis) {
            persistAIAnalysis(currentEstimateId, aiAnalysis);
          }
          toast.success(result.recovered 
            ? "Recovered AI-generated estimate applied!" 
            : "AI-generated estimate applied from previous session!");
        }
      } catch (err) {
        console.error('Error checking for completed jobs:', err);
      }
    };
    
    checkForCompletedJob();
  }, [open, currentEstimateId, groups.length, applyAIScope, skipAutoRecovery]);

  // AI Scope Generation with job-based background processing
  const generateScope = async () => {
    if (!formData.job_address?.trim()) {
      toast.error("Please enter the job site address first (required for accurate pricing)");
      return;
    }
    if (!formData.work_scope_description?.trim() && !plansFileUrl) {
      toast.error("Please describe the work scope or upload plans before generating");
      setActiveTab("scope");
      return;
    }
    
    // Validate required fields for saving
    if (!formData.customer_name?.trim()) {
      toast.error("Please enter the customer name before generating");
      setActiveTab("customer");
      return;
    }
    if (!formData.estimate_title?.trim()) {
      toast.error("Please enter the project title before generating");
      setActiveTab("customer");
      return;
    }

    setIsGeneratingScope(true);
    isGeneratingScopeRef.current = true;
    setShowAiProgress(true); // Show the progress overlay

    // Reset per-run stage tracking
    lastAIStageRef.current = null;
    stageIndexRef.current = 0;
    setCurrentAIStage(null);
    setStageProgress(null);
    
    let jobId: string | null = null;
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let queueSubscription: ReturnType<typeof supabase.channel> | null = null;
    
    try {
      // First, save the estimate fully before starting AI generation
      // This ensures no data is lost if the user navigates away during generation
      let targetEstimateId = currentEstimateId;
      
      if (!targetEstimateId) {
        // Create/save estimate with all current form data
        toast.info("Saving estimate before AI generation...");
        
        const { subtotal, discountAmount, total } = calculateTotals();
        
        const estimateData = {
          customer_name: formData.customer_name,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          job_address: formData.job_address,
          billing_address: formData.billing_address || null,
          estimate_title: formData.estimate_title,
          estimate_date: formData.estimate_date,
          expiration_date: formData.expiration_date || null,
          deposit_required: formData.deposit_required,
          deposit_percent: formData.deposit_percent,
          deposit_max_amount: formData.deposit_max_amount,
          tax_rate: 0,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          subtotal,
          tax_amount: 0,
          discount_amount: discountAmount,
          total,
          notes: formData.notes || null,
          notes_to_customer: formData.notes_to_customer || null,
          terms_and_conditions: formData.terms_and_conditions || null,
          work_scope_description: formData.work_scope_description || null,
          sq_ft_to_build: formData.sq_ft_to_build || null,
          garage_sq_ft: formData.garage_sq_ft || null,
          finishing_grade: formData.finishing_grade || null,
          created_by: user?.id || null,
          project_id: linkedProjectId || null,
          show_details_to_customer: formData.show_details_to_customer,
          show_scope_to_customer: formData.show_scope_to_customer,
          show_line_items_to_customer: formData.show_line_items_to_customer,
          salesperson_name: formData.salesperson_name || null,
          salesperson_id: getSalespersonId(formData.salesperson_name),
          company_id: companyId,
          opportunity_uuid: linkedOpportunityUuid || null,
          opportunity_id: linkedOpportunityGhlId || null,
          contact_uuid: linkedContactUuid || null,
          contact_id: linkedContactId || null,
          plans_file_url: plansFileUrl || null,
          status: 'draft' as const,
        };
        
        const { data: savedEstimate, error: saveError } = await supabase
          .from('estimates')
          .insert(estimateData)
          .select('id')
          .single();
        
        if (saveError || !savedEstimate) {
          console.error('Failed to save estimate before AI generation:', saveError);
          throw new Error('Failed to save estimate before AI generation');
        }
        
        targetEstimateId = savedEstimate.id;
        setCurrentEstimateId(targetEstimateId);
        
        // Clear draft since estimate is now saved
        clearDraft();
        deleteDraftDB();
        setDraftRestored(false);
        
        // Invalidate queries so the estimates list updates
        queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
        
        console.log('Saved estimate before AI generation:', targetEstimateId);
        toast.success("Estimate saved! Starting AI generation...");
      } else {
        // Update existing estimate with current form data before AI generation
        toast.info("Updating estimate before AI generation...");
        
        const { subtotal, discountAmount, total } = calculateTotals();
        
        const estimateData = {
          customer_name: formData.customer_name,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          job_address: formData.job_address,
          billing_address: formData.billing_address || null,
          estimate_title: formData.estimate_title,
          estimate_date: formData.estimate_date,
          expiration_date: formData.expiration_date || null,
          deposit_required: formData.deposit_required,
          deposit_percent: formData.deposit_percent,
          deposit_max_amount: formData.deposit_max_amount,
          tax_rate: 0,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          subtotal,
          tax_amount: 0,
          discount_amount: discountAmount,
          total,
          notes: formData.notes || null,
          notes_to_customer: formData.notes_to_customer || null,
          terms_and_conditions: formData.terms_and_conditions || null,
          work_scope_description: formData.work_scope_description || null,
          sq_ft_to_build: formData.sq_ft_to_build || null,
          garage_sq_ft: formData.garage_sq_ft || null,
          finishing_grade: formData.finishing_grade || null,
          project_id: linkedProjectId || null,
          show_details_to_customer: formData.show_details_to_customer,
          show_scope_to_customer: formData.show_scope_to_customer,
          show_line_items_to_customer: formData.show_line_items_to_customer,
          salesperson_name: formData.salesperson_name || null,
          salesperson_id: getSalespersonId(formData.salesperson_name),
          opportunity_uuid: linkedOpportunityUuid || null,
          opportunity_id: linkedOpportunityGhlId || null,
          contact_uuid: linkedContactUuid || null,
          contact_id: linkedContactId || null,
          plans_file_url: plansFileUrl || null,
        };
        
        const { error: updateError } = await supabase
          .from('estimates')
          .update(estimateData)
          .eq('id', targetEstimateId)
          .eq('company_id', companyId);
        
        if (updateError) {
          console.error('Failed to update estimate before AI generation:', updateError);
          throw new Error('Failed to update estimate before AI generation');
        }
        
        // Clear draft since estimate is now saved
        clearDraft();
        deleteDraftDB();
        setDraftRestored(false);
        
        queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
        console.log('Updated estimate before AI generation:', targetEstimateId);
      }
      
      // Create a job record
      const { data: jobData, error: jobError } = await supabase
        .from('estimate_generation_jobs')
        .insert({
          estimate_id: targetEstimateId,
          company_id: companyId,
          status: 'pending',
          created_by: user?.id || null,
          request_params: {
            projectType: formData.estimate_title,
            workScopeDescription: formData.work_scope_description,
            jobAddress: formData.job_address,
            hasPlans: !!plansFileUrl,
          }
        })
        .select('id')
        .single();
      
      if (jobError) {
        console.error('Failed to create job:', jobError);
        throw new Error('Failed to start AI generation');
      }
      
      jobId = jobData.id;
      console.log('Created AI generation job:', jobId);
      
      const stopPolling = () => {
        if (jobPollIntervalRef.current) {
          clearInterval(jobPollIntervalRef.current);
          jobPollIntervalRef.current = null;
        }
      };

      const cleanupGeneration = () => {
        setIsGeneratingScope(false);
        isGeneratingScopeRef.current = false;
        setCurrentAIStage(null);
        setStageProgress(null);
        setQueuePosition(null);
        stopPolling();
        subscription?.unsubscribe();
        queueSubscription?.unsubscribe();
      };

      const handleJobUpdate = (job: { 
        status: string; 
        result_json: any; 
        error_message: string | null;
        current_stage?: string | null;
        total_stages?: number | null;
      }) => {
        console.log('Job update received:', job.status, job.current_stage);

        // Update stage progress for UI.
        // IMPORTANT: GROUP_ITEMS runs many times; we advance progress on each distinct stage value.
        if (job.current_stage && job.current_stage !== lastAIStageRef.current) {
          lastAIStageRef.current = job.current_stage;
          stageIndexRef.current = stageIndexRef.current + 1;

          setCurrentAIStage(job.current_stage);
          if (job.total_stages) {
            setStageProgress({
              current: Math.min(stageIndexRef.current, job.total_stages),
              total: job.total_stages,
            });
          }
        }

        if (job.status === 'completed' && job.result_json) {
          // Success! Apply the scope and clean up
          try {
            const scope = job.result_json.scope;
            // Validate that the AI actually produced groups with items
            if (!scope?.groups || scope.groups.length === 0) {
              toast.error('AI generation completed but produced no line items. Please provide a more detailed work scope and try again.');
              cleanupGeneration();
              return;
            }
            const totalItems = scope.groups.reduce((sum: number, g: any) => sum + (g.items?.length || 0), 0);
            if (totalItems === 0) {
              toast.error('AI generation completed but all groups are empty. Please add more detail to the work scope and try again.');
              cleanupGeneration();
              return;
            }
            if (job.result_json.warning) {
              toast.warning(job.result_json.warning);
            }
            const aiAnalysis = applyAIScope(scope);
            // Persist AI analysis immediately for existing estimates
            if (aiAnalysis && currentEstimateId) {
              persistAIAnalysis(currentEstimateId, aiAnalysis);
            }
          } catch (e) {
            console.error('Failed to apply AI scope:', e);
            toast.error('Failed to apply AI-generated scope');
          }
          cleanupGeneration();
        } else if (job.status === 'failed') {
          // Error - show message and clean up
          toast.error(job.error_message || 'AI generation failed');
          cleanupGeneration();
        }
      };

      // Subscribe to realtime updates for this job
      subscription = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'estimate_generation_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const job = payload.new as { 
              status: string; 
              result_json: any; 
              error_message: string | null;
              current_stage?: string | null;
              total_stages?: number | null;
            };
            handleJobUpdate(job);
          }
        )
        .subscribe();

      // Fallback: poll job state in case realtime disconnects (keeps UI updating)
      stopPolling();
      jobPollIntervalRef.current = setInterval(async () => {
        if (!isGeneratingScopeRef.current) return;
        try {
          const { data: polledJob } = await supabase
            .from('estimate_generation_jobs')
            .select('status, result_json, error_message, current_stage, total_stages')
            .eq('id', jobId!)
            .maybeSingle();

          if (polledJob) {
            handleJobUpdate(polledJob as any);
          }
        } catch (e) {
          // Silent: realtime still may be working; avoid spam.
          console.warn('Job polling failed:', e);
        }
      }, 10_000);
      
      // Call the edge function with the job ID
      const invokeBody = {
        projectType: formData.estimate_title,
        projectDescription: formData.notes,
        workScopeDescription: formData.work_scope_description,
        jobAddress: formData.job_address,
        existingGroups: groups.map(g => g.group_name),
        defaultMarkupPercent: formData.default_markup_percent,
        companyId: companyId,
        plansFileUrl: plansFileUrl,
        jobId: jobId, // Pass job ID for background processing
        sqFtToBuild: formData.sq_ft_to_build,
        garageSqFt: formData.garage_sq_ft || null,
        finishingGrade: formData.finishing_grade,
      };

      // Make the request - even if it fails due to tab switch, the job continues in background
      const { data, error } = await supabase.functions.invoke("generate-estimate-scope", {
        body: invokeBody,
      });

      // Set queue position from response (if we're in a queue)
      if (!error && data?.queuePosition) {
        setQueuePosition(data.queuePosition);
        if (data.queuePosition > 1) {
          toast.info(`You're #${data.queuePosition} in the AI queue. Your request will process automatically.`);
        }
        
        // Subscribe to queue position updates
        queueSubscription = supabase
          .channel(`queue-${jobId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'estimate_generation_queue',
              filter: `job_id=eq.${jobId}`,
            },
            (payload) => {
              const queueEntry = payload.new as { position: number; status: string };
              if (queueEntry.status === 'waiting') {
                setQueuePosition(queueEntry.position);
                if (queueEntry.position === 1) {
                  toast.info("You're next! Your AI generation will start shortly.");
                }
              } else if (queueEntry.status === 'processing') {
                setQueuePosition(null); // Clear queue position when actually processing
              }
            }
          )
          .subscribe();
      }

      // If we get an immediate response (fast generation), use it directly
      if (!error && data?.success && data?.scope) {
        console.log('Got immediate response, applying directly');
        // Validate non-empty results
        if (!data.scope.groups || data.scope.groups.length === 0 || 
            data.scope.groups.reduce((sum: number, g: any) => sum + (g.items?.length || 0), 0) === 0) {
          toast.error('AI generation completed but produced no line items. Please provide a more detailed work scope and try again.');
          setIsGeneratingScope(false);
          subscription?.unsubscribe();
          queueSubscription?.unsubscribe();
          return;
        }
        if (data.warning) {
          toast.warning(data.warning);
        }
        const aiAnalysis = applyAIScope(data.scope);
        // Persist AI analysis immediately for existing estimates
        if (aiAnalysis && currentEstimateId) {
          persistAIAnalysis(currentEstimateId, aiAnalysis);
        }
        setIsGeneratingScope(false);
        subscription?.unsubscribe();
        queueSubscription?.unsubscribe();
        return;
      }
      
      // If there was an error but we have a job, the background processing continues
      if (error) {
        console.log('Request failed but job may continue in background:', error);
        // Don't throw - let realtime subscription handle the result
        // But if the job was never started, we need to handle that
        if (!jobId) {
          throw error;
        }
      }

      // For longer operations, the realtime subscription will handle completion
      // Set a max timeout as a safety net (5 minutes for jobs with PDFs)
      const maxTimeout = plansFileUrl ? 300_000 : 180_000;
      setTimeout(() => {
        if (isGeneratingScopeRef.current) {
          console.log('Safety timeout reached, checking job status...');
          // Check job status one more time
          supabase
            .from('estimate_generation_jobs')
            .select('status, result_json, error_message')
            .eq('id', jobId!)
            .maybeSingle()
            .then(({ data: finalJob }) => {
              if (finalJob?.status === 'completed' && finalJob.result_json) {
                const result = finalJob.result_json as { scope: any; warning?: string };
                const aiAnalysis = applyAIScope(result.scope);
                // Persist AI analysis immediately for existing estimates
                if (aiAnalysis && currentEstimateId) {
                  persistAIAnalysis(currentEstimateId, aiAnalysis);
                }
                toast.success("AI scope loaded from background job");
              } else if (finalJob?.status === 'pending' || finalJob?.status === 'processing') {
                toast.error('AI generation timed out. The job may still complete - check back later.');
              }
              cleanupGeneration();
            });
        }
      }, maxTimeout);

    } catch (error) {
      console.error("Error generating scope:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate scope. Please try again.";
      toast.error(msg);
      setIsGeneratingScope(false);
      isGeneratingScopeRef.current = false;
      setCurrentAIStage(null);
      setStageProgress(null);
      if (jobPollIntervalRef.current) {
        clearInterval(jobPollIntervalRef.current);
        jobPollIntervalRef.current = null;
      }
      subscription?.unsubscribe();
    }
  };

  // Handle regeneration with answered missing info
  const handleMissingInfoSubmit = async (answers: Record<string, string>) => {
    if (Object.keys(answers).length === 0) {
      toast.error("Please answer at least one question");
      return;
    }
    
    setIsRegeneratingWithAnswers(true);
    setShowMissingInfoPanel(false);
    
    // Build enhanced work scope with answers
    const answersText = Object.entries(answers)
      .map(([question, answer]) => `${question}: ${answer}`)
      .join('\n');
    
    const enhancedScope = `${formData.work_scope_description}\n\n--- Additional Information ---\n${answersText}`;
    
    // Update the work scope description
    setFormData(prev => ({ ...prev, work_scope_description: enhancedScope }));
    
    // Clear existing groups to regenerate fresh
    setGroups([]);
    setPaymentSchedule([]);
    
    // Trigger regeneration (small delay to ensure state updates)
    setTimeout(async () => {
      await generateScope();
      setIsRegeneratingWithAnswers(false);
    }, 100);
  };

  // Group management
  const addGroup = () => {
    const newGroup: Group = {
      id: generateId(),
      group_name: "New Area",
      description: "",
      sort_order: groups.length,
      isOpen: false,
      items: [],
    };
    setGroups([...groups, newGroup]);
  };

  const updateGroup = (groupId: string, updates: Partial<Group>) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, ...updates } : g));
  };

  const deleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const toggleGroup = (groupId: string) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, isOpen: !g.isOpen } : g));
  };

  // Line item management - with cost/markup recalculation
  const addLineItem = (groupId: string) => {
    const newItem: LineItem = {
      id: generateId(),
      item_type: "material",
      description: "",
      quantity: 1,
      unit: "each",
      cost: 0,
      labor_cost: 0,
      material_cost: 0,
      markup_percent: formData.default_markup_percent,
      unit_price: 0,
      line_total: 0,
      is_taxable: true,
      sort_order: groups.find(g => g.id === groupId)?.items.length || 0,
      notes: "",
    };
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, items: [...g.items, newItem] } : g
    ));
  };

  const updateLineItem = (groupId: string, itemId: string, updates: Partial<LineItem>) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        items: g.items.map(item => {
          if (item.id !== itemId) return item;
          const updated = { ...item, ...updates };
          
          // If labor_cost or material_cost changed, recalculate cost as sum
          if ('labor_cost' in updates || 'material_cost' in updates) {
            updated.cost = updated.labor_cost + updated.material_cost;
            updated.unit_price = updated.cost * (1 + updated.markup_percent / 100);
          }
          
          // If cost or markup changed directly, recalculate unit_price
          if ('cost' in updates || 'markup_percent' in updates) {
            updated.unit_price = updated.cost * (1 + updated.markup_percent / 100);
          }
          
          // Recalculate line total
          updated.line_total = updated.quantity * updated.unit_price;
          return updated;
        }),
      };
    }));
  };

  const deleteLineItem = (groupId: string, itemId: string) => {
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
    ));
  };

  // Payment schedule management
  const addPaymentPhase = () => {
    const newPhase: PaymentPhase = {
      id: generateId(),
      phase_name: "New Progress Payment",
      percent: 0,
      amount: 0,
      due_type: "milestone",
      due_date: null,
      description: "",
      sort_order: paymentSchedule.length,
    };
    setPaymentSchedule([...paymentSchedule, newPhase]);
  };

  const updatePaymentPhase = (phaseId: string, updates: Partial<PaymentPhase>) => {
    setPaymentSchedule(paymentSchedule.map(p => 
      p.id === phaseId ? { ...p, ...updates } : p
    ));
  };

  const deletePaymentPhase = (phaseId: string) => {
    setPaymentSchedule(paymentSchedule.filter(p => p.id !== phaseId));
  };

  // Drag and drop state for payment phases
  const [draggedPhaseId, setDraggedPhaseId] = useState<string | null>(null);
  const [dragOverPhaseId, setDragOverPhaseId] = useState<string | null>(null);

  const handlePhaseDragStart = (e: React.DragEvent, phaseId: string) => {
    setDraggedPhaseId(phaseId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePhaseDragOver = (e: React.DragEvent, targetPhaseId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPhaseId && targetPhaseId !== draggedPhaseId) {
      setDragOverPhaseId(targetPhaseId);
    }
  };

  const handlePhaseDragLeave = () => {
    setDragOverPhaseId(null);
  };

  const handlePhaseDrop = (e: React.DragEvent, targetPhaseId: string) => {
    e.preventDefault();
    setDragOverPhaseId(null);
    if (!draggedPhaseId || draggedPhaseId === targetPhaseId) {
      setDraggedPhaseId(null);
      return;
    }

    const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
    const draggedIndex = nonDepositPhases.findIndex(p => p.id === draggedPhaseId);
    const targetIndex = nonDepositPhases.findIndex(p => p.id === targetPhaseId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPhaseId(null);
      return;
    }

    // Reorder the phases
    const reordered = [...nonDepositPhases];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update sort_order and merge back with deposit phases
    const depositPhases = paymentSchedule.filter(p => p.phase_name === "Deposit");
    const updatedPhases = [
      ...depositPhases,
      ...reordered.map((p, idx) => ({ ...p, sort_order: idx }))
    ];

    setPaymentSchedule(updatedPhases);
    setDraggedPhaseId(null);
  };

  const handlePhaseDragEnd = () => {
    setDraggedPhaseId(null);
    setDragOverPhaseId(null);
  };

  // Save estimate
  // Validation before save
  const validateEstimate = (): boolean => {
    if (!companyId) {
      toast.error("No company selected. Please select a company first.");
      return false;
    }
    if (!formData.customer_name?.trim()) {
      toast.error("Customer name is required");
      setActiveTab("customer");
      return false;
    }
    if (!formData.customer_email?.trim()) {
      toast.error("Customer email is required");
      setActiveTab("customer");
      return false;
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customer_email.trim())) {
      toast.error("Please enter a valid email address");
      setActiveTab("customer");
      return false;
    }
    if (!formData.job_address?.trim()) {
      toast.error("Job site address is required");
      setActiveTab("customer");
      return false;
    }
    if (!formData.estimate_title?.trim()) {
      toast.error("Project title is required");
      setActiveTab("customer");
      return false;
    }
    if (!formData.salesperson_name?.trim()) {
      toast.error("Salesperson is required");
      setActiveTab("customer");
      return false;
    }
    
    // Validate payment phases total equals estimate total
    // Note: We only count non-deposit phases since deposit is handled separately
    const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
    if (nonDepositPhases.length > 0 || totals.depositAmount > 0) {
      const { total, depositAmount } = calculateTotals();
      const remainingAfterDeposit = Math.max(0, total - depositAmount);
      
      // Phases total = deposit + sum of non-deposit phase amounts
      const phasesTotal = depositAmount + nonDepositPhases.reduce((sum, phase) => {
        return sum + ((remainingAfterDeposit * (phase.percent || 0)) / 100);
      }, 0);
      
      // Allow small floating point tolerance (1 cent)
      if (Math.abs(phasesTotal - total) > 0.01) {
        toast.warning(`Cannot save - Payment phases total (${formatCurrency(phasesTotal)}) doesn't equal the estimate total (${formatCurrency(total)}). Difference: ${formatCurrency(Math.abs(phasesTotal - total))}`);
        setActiveTab("payments");
        return false;
      }
    }
    
    return true;
  };

  const saveMutation = useMutation({
    mutationKey: ['save-estimate', currentEstimateId],
    mutationFn: async () => {
      if (!validateEstimate()) {
        throw new Error("Validation failed");
      }

      const { subtotal, discountAmount, total, depositAmount } = calculateTotals();
      
      // When editing, preserve existing status; for new estimates use draft
      const currentStatus = isEditing && existingEstimate?.estimate?.status 
        ? existingEstimate.estimate.status 
        : "draft";

      // Resolve contact_uuid from opportunity if still missing (race condition / backfill gap)
      let resolvedContactUuid = linkedContactUuid;
      if (!resolvedContactUuid && linkedOpportunityUuid) {
        const { data: oppData } = await supabase
          .from("opportunities")
          .select("contact_uuid")
          .eq("id", linkedOpportunityUuid)
          .maybeSingle();
        if (oppData?.contact_uuid) {
          resolvedContactUuid = oppData.contact_uuid;
        }
      }
      
      // Prepare estimate data
      // Persist AI analysis if ANY AI section has content (including missing_info)
      const aiAnalysisData = (
        aiSummary.project_understanding.length > 0 ||
        aiSummary.assumptions.length > 0 ||
        aiSummary.inclusions.length > 0 ||
        aiSummary.exclusions.length > 0 ||
        aiSummary.missing_info.length > 0
      ) ? {
        project_understanding: aiSummary.project_understanding,
        assumptions: aiSummary.assumptions,
        inclusions: aiSummary.inclusions,
        exclusions: aiSummary.exclusions,
        missing_info: aiSummary.missing_info,
      } : null;

      const estimateData = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        job_address: formData.job_address,
        billing_address: formData.billing_address || null,
        estimate_title: formData.estimate_title,
        estimate_date: formData.estimate_date,
        expiration_date: formData.expiration_date || null,
        deposit_required: formData.deposit_required,
        deposit_percent: formData.deposit_percent,
        deposit_max_amount: formData.deposit_max_amount,
        tax_rate: 0,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        subtotal,
        tax_amount: 0,
        discount_amount: discountAmount,
        total,
        notes: formData.notes || null,
        notes_to_customer: formData.notes_to_customer || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        work_scope_description: formData.work_scope_description || null,
        sq_ft_to_build: formData.sq_ft_to_build || null,
        garage_sq_ft: formData.garage_sq_ft || null,
        finishing_grade: formData.finishing_grade || null,
        created_by: user?.id || null,
        project_id: linkedProjectId || null,
        show_details_to_customer: formData.show_details_to_customer,
        show_scope_to_customer: formData.show_scope_to_customer,
        show_line_items_to_customer: formData.show_line_items_to_customer,
        salesperson_name: formData.salesperson_name || null,
        salesperson_id: getSalespersonId(formData.salesperson_name),
        company_id: companyId,
        opportunity_uuid: linkedOpportunityUuid || null,
        opportunity_id: linkedOpportunityGhlId || null,
        contact_uuid: resolvedContactUuid || null,
        contact_id: linkedContactId || null,
        lead_source: linkedLeadSource || null,
        ai_analysis: aiAnalysisData,
        plans_file_url: plansFileUrl || null,
        estimate_mode: estimateMode,
        manual_total: estimateMode === 'manual' ? manualTotal : 0,
      };
      
      // Only set status for new estimates (not when editing)
      const insertData = isEditing ? estimateData : { ...estimateData, status: "draft" as const };

      let savedEstimateId = currentEstimateId;

      if (isEditing && currentEstimateId) {
        // SAFETY GUARD: If we're editing an existing estimate that had line items (subtotal > 0)
        // but the current groups array is empty, something went wrong during loading.
        // Abort the save to prevent data loss rather than wiping all line items.
        if (estimateMode !== 'manual' && groups.length === 0) {
          // Check if the estimate actually has existing data in the DB
          const { count: existingItemCount } = await supabase
            .from("estimate_line_items")
            .select("id", { count: "exact", head: true })
            .eq("estimate_id", currentEstimateId);
          
          if (existingItemCount && existingItemCount > 0) {
            throw new Error(
              "Line items failed to load properly. Please close and reopen the estimate editor, then try saving again. Your data has NOT been lost."
            );
          }
        }

        // Update existing estimate - scope by company_id for security
        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateData)
          .eq("id", currentEstimateId)
          .eq("company_id", companyId);
        if (updateError) throw updateError;

        // Delete existing line items, groups, and schedule
        // Must delete line items first since they reference groups
        // Note: We scope only by estimate_id (not company_id) because some rows may have been
        // inserted by edge functions with company_id=null. The estimate itself is already company-scoped.
        await supabase.from("estimate_line_items").delete().eq("estimate_id", currentEstimateId);
        await supabase.from("estimate_groups").delete().eq("estimate_id", currentEstimateId);
        await supabase.from("estimate_payment_schedule").delete().eq("estimate_id", currentEstimateId);
      } else {
        // Create new estimate (including clone mode - creates a brand new estimate with new number)
        const { data: newEstimate, error: insertError } = await supabase
          .from("estimates")
          .insert(insertData)
          .select()
          .single();
        if (insertError) throw insertError;
        savedEstimateId = newEstimate.id;
      }

      // Insert groups
      for (const group of groups) {
        const { data: savedGroup, error: groupError } = await supabase
          .from("estimate_groups")
          .insert({
            estimate_id: savedEstimateId,
            group_name: group.group_name,
            description: group.description || null,
            sort_order: group.sort_order,
            company_id: companyId,
          })
          .select()
          .single();
        if (groupError) throw groupError;

        // Insert line items for this group
        if (group.items.length > 0) {
          const itemsToInsert = group.items.map(item => ({
            estimate_id: savedEstimateId,
            group_id: savedGroup.id,
            item_type: item.item_type as "assembly" | "equipment" | "labor" | "material" | "note" | "permit",
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            cost: item.cost,
            labor_cost: item.labor_cost || 0,
            material_cost: item.material_cost || 0,
            markup_percent: item.markup_percent,
            line_total: item.line_total,
            is_taxable: item.is_taxable,
            sort_order: item.sort_order,
            company_id: companyId,
          }));
          
          const { error: itemsError } = await supabase
            .from("estimate_line_items")
            .insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      // Insert payment schedule
      // Always include deposit phase first if deposit > 0, then add non-deposit phases
      const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
      const remainingTotal = Math.max(0, total - depositAmount);
      
      const scheduleToInsert: any[] = [];
      
      // Add deposit phase first if applicable
      if (depositAmount > 0) {
        scheduleToInsert.push({
          estimate_id: savedEstimateId,
          phase_name: "Deposit",
          percent: 0, // Deposit is a fixed amount, not a percentage
          amount: depositAmount,
          due_type: "on_approval",
          due_date: null,
          description: "Due upon contract signing",
          sort_order: 0,
          company_id: companyId,
        });
      }
      
      // Add non-deposit phases
      nonDepositPhases.forEach((phase, index) => {
        scheduleToInsert.push({
          estimate_id: savedEstimateId,
          phase_name: phase.phase_name,
          percent: phase.percent,
          amount: (remainingTotal * (phase.percent || 0)) / 100,
          due_type: phase.due_type,
          due_date: phase.due_date || null,
          description: phase.description || null,
          sort_order: depositAmount > 0 ? index + 1 : index,
          company_id: companyId,
        });
      });
      
      if (scheduleToInsert.length > 0) {
        const { error: scheduleError } = await supabase
          .from("estimate_payment_schedule")
          .insert(scheduleToInsert);
        if (scheduleError) throw scheduleError;
      }

      // Handle opportunity updates/creation for new estimates only
      if (!isEditing) {
        // If linked to existing opportunity, update its stage and recalculate aggregated value
        if (linkedOpportunityGhlId) {
          try {
            // First update the stage
            await supabase.functions.invoke("update-ghl-opportunity", {
              body: {
                ghl_id: linkedOpportunityGhlId,
                stage_name: "Estimate Prepared",
                edited_by: user?.id,
                company_id: companyId,
              },
            });
            
            // Then recalculate aggregated value from all linked estimates
            await updateOpportunityValueFromEstimates(
              linkedOpportunityUuid || null,
              linkedOpportunityGhlId,
              companyId!,
              user?.id
            );
            
            console.log("Updated opportunity stage to 'Estimate Prepared' and recalculated aggregated value");
          } catch (err) {
            console.error("Failed to update opportunity:", err);
            // Don't fail the save for this
          }
        }
        // If createOpportunityOnSave is true, create a new opportunity
        else if (createOpportunityOnSave) {
          try {
            // Parse customer name into first/last
            const nameParts = formData.customer_name.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Get default pipeline info
            const { data: defaultPipeline } = await supabase
              .from("ghl_pipelines")
              .select("ghl_id, name, stages")
              .eq("company_id", companyId)
              .limit(1)
              .maybeSingle();

            const pipelineId = defaultPipeline?.ghl_id || null;
            const pipelineName = defaultPipeline?.name || null;
            const stages = defaultPipeline?.stages as { id: string; name: string; position: number }[] | null;
            const firstStage = stages?.sort((a, b) => a.position - b.position)[0];

            // Get location_id from company settings
            const { data: locationSetting } = await supabase
              .from("company_integrations")
              .select("location_id")
              .eq("company_id", companyId)
              .eq("provider", "ghl")
              .eq("is_active", true)
              .maybeSingle();

            const locationId = locationSetting?.location_id || "local";

            // Create opportunity via edge function
            const { data: createResult, error: createError } = await supabase.functions.invoke("create-ghl-entry", {
              body: {
                firstName,
                lastName,
                phone: formData.customer_phone || undefined,
                email: formData.customer_email || undefined,
                address: formData.job_address || undefined,
                scope: formData.work_scope_description || undefined,
                source: "Manual estimate created",
                pipelineId,
                pipelineName,
                pipelineStageId: firstStage?.id || null,
                stageName: "Estimate Prepared",
                monetaryValue: total,
                locationId,
                companyId,
              },
            });

            if (createError) {
              console.error("Failed to create opportunity:", createError);
            } else if (createResult?.opportunityId) {
              // Update estimate with both opportunity_id (GHL ID) and opportunity_uuid
              const updateData: Record<string, string> = {
                opportunity_id: createResult.opportunityId,
              };
              
              // Also set opportunity_uuid if returned
              if (createResult.opportunityUuid) {
                updateData.opportunity_uuid = createResult.opportunityUuid;
              }
              
              await supabase
                .from("estimates")
                .update(updateData)
                .eq("id", savedEstimateId);
              
              console.log("Created new opportunity and linked to estimate:", createResult.opportunityId, "UUID:", createResult.opportunityUuid);
            }
          } catch (err) {
            console.error("Failed to create opportunity:", err);
            // Don't fail the save for this
          }
        }

        // Auto-create or link project with status "Estimate" for new estimates without a project
        if (!linkedProjectId && savedEstimateId) {
          try {
            // --- Duplicate detection: check for existing project by contact_uuid, opportunity_uuid, or name ---
            let existingMatch: { id: string } | null = null;

            if (linkedContactUuid) {
              const { data: contactMatch } = await supabase
                .from("projects")
                .select("id")
                .eq("company_id", companyId)
                .eq("contact_uuid", linkedContactUuid)
                .is("deleted_at", null)
                .limit(1)
                .maybeSingle();
              if (contactMatch) existingMatch = contactMatch;
            }

            if (!existingMatch && linkedOpportunityUuid) {
              const { data: oppMatch } = await supabase
                .from("projects")
                .select("id")
                .eq("company_id", companyId)
                .eq("opportunity_uuid", linkedOpportunityUuid)
                .is("deleted_at", null)
                .limit(1)
                .maybeSingle();
              if (oppMatch) existingMatch = oppMatch;
            }

            if (!existingMatch && formData.customer_name?.trim()) {
              const { data: nameMatches } = await supabase
                .from("projects")
                .select("id, project_name")
                .eq("company_id", companyId)
                .is("deleted_at", null)
                .ilike("project_name", `%${formData.customer_name.trim()}%`)
                .limit(5);
              if (nameMatches && nameMatches.length > 0) existingMatch = nameMatches[0];
            }

            if (existingMatch) {
              // Link estimate to existing project instead of creating a new one
              await supabase
                .from("estimates")
                .update({ project_id: existingMatch.id })
                .eq("id", savedEstimateId);
              setLinkedProjectId(existingMatch.id);
              console.log("Linked estimate to existing project (duplicate prevented):", existingMatch.id);
            } else {
              // No match found — create new project
              const { data: locationSetting } = await supabase
                .from("company_integrations")
                .select("location_id")
                .eq("company_id", companyId)
                .eq("provider", "ghl")
                .eq("is_active", true)
                .maybeSingle();

              const locationId = locationSetting?.location_id || "local";
              const nameParts = formData.customer_name.trim().split(" ");
              const firstName = nameParts[0] || "";
              const lastName = nameParts.slice(1).join(" ") || "";

              const { data: newProject, error: projectError } = await supabase
                .from("projects")
                .insert({
                  project_name: formData.estimate_title || formData.customer_name,
                  project_status: "Estimate",
                  project_address: formData.job_address || null,
                  customer_first_name: firstName || null,
                  customer_last_name: lastName || null,
                  customer_email: formData.customer_email || null,
                  cell_phone: formData.customer_phone || null,
                  primary_salesperson: formData.salesperson_name || null,
                  project_manager: formData.salesperson_name || null,
                  opportunity_id: linkedOpportunityGhlId || null,
                  opportunity_uuid: linkedOpportunityUuid || null,
                  contact_id: linkedContactId || null,
                  contact_uuid: linkedContactUuid || null,
                  lead_source: linkedLeadSource || null,
                  location_id: locationId,
                  company_id: companyId,
                  created_by: user?.id,
                })
                .select()
                .single();

              if (projectError) {
                console.error("Failed to create project for estimate:", projectError);
              } else if (newProject) {
                await supabase
                  .from("estimates")
                  .update({ project_id: newProject.id })
                  .eq("id", savedEstimateId);
                setLinkedProjectId(newProject.id);
                console.log("Created project with status 'Estimate' and linked to estimate:", newProject.id);
              }
            }
          } catch (err) {
            console.error("Failed to create/link project for estimate:", err);
            // Don't fail the save for this
          }
        }
      }

      // Also create/link project for EXISTING estimates that don't have one yet
      const existingProjectId = linkedProjectId || existingEstimate?.estimate?.project_id;
      if (isEditing && !existingProjectId && savedEstimateId) {
        try {
          // --- Duplicate detection: check for existing project first ---
          let existingMatch: { id: string } | null = null;

          if (linkedContactUuid) {
            const { data: contactMatch } = await supabase
              .from("projects")
              .select("id")
              .eq("company_id", companyId)
              .eq("contact_uuid", linkedContactUuid)
              .is("deleted_at", null)
              .limit(1)
              .maybeSingle();
            if (contactMatch) existingMatch = contactMatch;
          }

          if (!existingMatch && linkedOpportunityUuid) {
            const { data: oppMatch } = await supabase
              .from("projects")
              .select("id")
              .eq("company_id", companyId)
              .eq("opportunity_uuid", linkedOpportunityUuid)
              .is("deleted_at", null)
              .limit(1)
              .maybeSingle();
            if (oppMatch) existingMatch = oppMatch;
          }

          if (!existingMatch && formData.customer_name?.trim()) {
            const { data: nameMatches } = await supabase
              .from("projects")
              .select("id, project_name")
              .eq("company_id", companyId)
              .is("deleted_at", null)
              .ilike("project_name", `%${formData.customer_name.trim()}%`)
              .limit(5);
            if (nameMatches && nameMatches.length > 0) existingMatch = nameMatches[0];
          }

          if (existingMatch) {
            await supabase
              .from("estimates")
              .update({ project_id: existingMatch.id })
              .eq("id", savedEstimateId);
            setLinkedProjectId(existingMatch.id);
            console.log("Linked existing estimate to existing project (duplicate prevented):", existingMatch.id);
          } else {
            const { data: locationSetting } = await supabase
              .from("company_integrations")
              .select("location_id")
              .eq("company_id", companyId)
              .eq("provider", "ghl")
              .eq("is_active", true)
              .maybeSingle();

            const locationId = locationSetting?.location_id || "local";
            const nameParts = formData.customer_name.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const { data: newProject, error: projectError } = await supabase
              .from("projects")
              .insert({
                project_name: formData.estimate_title || formData.customer_name,
                project_status: "Estimate",
                project_address: formData.job_address || null,
                customer_first_name: firstName || null,
                customer_last_name: lastName || null,
                customer_email: formData.customer_email || null,
                cell_phone: formData.customer_phone || null,
                primary_salesperson: formData.salesperson_name || null,
                project_manager: formData.salesperson_name || null,
                opportunity_id: linkedOpportunityGhlId || null,
                opportunity_uuid: linkedOpportunityUuid || null,
                contact_id: linkedContactId || null,
                contact_uuid: linkedContactUuid || null,
                lead_source: linkedLeadSource || null,
                location_id: locationId,
                company_id: companyId,
                created_by: user?.id,
              })
              .select()
              .single();

            if (projectError) {
              console.error("Failed to create project for existing estimate:", projectError);
            } else if (newProject) {
              await supabase
                .from("estimates")
                .update({ project_id: newProject.id })
                .eq("id", savedEstimateId);
              setLinkedProjectId(newProject.id);
              console.log("Created project for existing estimate:", newProject.id);
            }
          }
        } catch (err) {
          console.error("Failed to create/link project for existing estimate:", err);
        }
      }

      // Update existing project's salesperson when estimate is in draft status
      // This ensures the project reflects any salesperson changes made in the estimate
      const currentProjectId = linkedProjectId || existingEstimate?.estimate?.project_id;
      const currentEstimateStatus = existingEstimate?.estimate?.status;
      
      if (currentProjectId && (!currentEstimateStatus || currentEstimateStatus === 'draft')) {
        try {
          const { error: projectUpdateError } = await supabase
            .from('projects')
            .update({
              primary_salesperson: formData.salesperson_name || null,
              project_manager: formData.salesperson_name || null,
            })
            .eq('id', currentProjectId);
          
          if (projectUpdateError) {
            console.error('Failed to update project salesperson:', projectUpdateError);
          } else {
            console.log('Updated project salesperson to:', formData.salesperson_name);
          }
        } catch (err) {
          console.error('Error updating project salesperson:', err);
          // Don't fail the save for this
        }
      }

      return savedEstimateId;
    },
    onSuccess: (savedEstimateId: string | null) => {
      // Clear the draft from sessionStorage and DB on successful save
      clearDraft();
      deleteDraftDB();
      setDraftRestored(false);
      
      // Update the current estimate ID so subsequent saves update instead of creating new
      if (savedEstimateId && !currentEstimateId) {
        setCurrentEstimateId(savedEstimateId);
      }

      // If we just created/linked a project inside the mutation, force a refetch of the edit query
      // so `existingEstimate.estimate.project_id` is up-to-date.
      if (savedEstimateId) {
        queryClient.invalidateQueries({ queryKey: ["estimate-edit", savedEstimateId] });
      }
      queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success(isEditing ? "Estimate updated successfully!" : "Estimate created successfully!");
      onSuccess?.();
    },
    onError: (error: Error) => {
      // Don't show generic error for validation failures - the specific validation toast already showed
      if (error.message === "Validation failed") {
        return;
      }
      console.error("Error saving estimate:", error);
      toast.error("Failed to save estimate. Please try again.");
    },
  });

  // Save As New mutation - creates a new estimate with the current data
  const saveAsNewMutation = useMutation({
    mutationKey: ['save-estimate-as-new', currentEstimateId],
    mutationFn: async () => {
      if (!validateEstimate()) {
        throw new Error("Validation failed");
      }

      const { subtotal, discountAmount, total, depositAmount } = calculateTotals();
      
      // Get source estimate data to preserve links (project, opportunity, contact)
      const sourceEstimate = existingEstimate?.estimate;
      
      // Prepare estimate data for a new estimate - preserve links from source
      const estimateData = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        job_address: formData.job_address,
        billing_address: formData.billing_address || null,
        estimate_title: formData.estimate_title,
        estimate_date: new Date().toISOString().split("T")[0], // Use today's date
        expiration_date: formData.expiration_date || null,
        deposit_required: formData.deposit_required,
        deposit_percent: formData.deposit_percent,
        deposit_max_amount: formData.deposit_max_amount,
        tax_rate: 0,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        subtotal,
        tax_amount: 0,
        discount_amount: discountAmount,
        total,
        notes: formData.notes || null,
        notes_to_customer: formData.notes_to_customer || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        work_scope_description: formData.work_scope_description || null,
        sq_ft_to_build: formData.sq_ft_to_build || null,
        garage_sq_ft: formData.garage_sq_ft || null,
        finishing_grade: formData.finishing_grade || null,
        status: "draft" as const,
        created_by: user?.id || null,
        show_details_to_customer: formData.show_details_to_customer,
        show_scope_to_customer: formData.show_scope_to_customer,
        show_line_items_to_customer: formData.show_line_items_to_customer,
        salesperson_name: formData.salesperson_name || null,
        salesperson_id: getSalespersonId(formData.salesperson_name),
        company_id: companyId,
        // Preserve links from source estimate (don't create new project/opportunity)
        project_id: sourceEstimate?.project_id || null,
        opportunity_id: sourceEstimate?.opportunity_id || null,
        opportunity_uuid: sourceEstimate?.opportunity_uuid || null,
        contact_id: sourceEstimate?.contact_id || null,
        contact_uuid: sourceEstimate?.contact_uuid || null,
        lead_source: sourceEstimate?.lead_source || linkedLeadSource || null,
      };

      // Create new estimate
      const { data: newEstimate, error: insertError } = await supabase
        .from("estimates")
        .insert(estimateData)
        .select()
        .single();
      if (insertError) throw insertError;
      const savedEstimateId = newEstimate.id;

      // Insert groups
      for (const group of groups) {
        const { data: savedGroup, error: groupError } = await supabase
          .from("estimate_groups")
          .insert({
            estimate_id: savedEstimateId,
            group_name: group.group_name,
            description: group.description || null,
            sort_order: group.sort_order,
            company_id: companyId,
          })
          .select()
          .single();
        if (groupError) throw groupError;

        // Insert line items for this group
        if (group.items.length > 0) {
          const itemsToInsert = group.items.map(item => ({
            estimate_id: savedEstimateId,
            group_id: savedGroup.id,
            item_type: item.item_type as "assembly" | "equipment" | "labor" | "material" | "note" | "permit",
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            cost: item.cost,
            labor_cost: item.labor_cost || 0,
            material_cost: item.material_cost || 0,
            markup_percent: item.markup_percent,
            line_total: item.line_total,
            is_taxable: item.is_taxable,
            sort_order: item.sort_order,
            company_id: companyId,
          }));
          
          const { error: itemsError } = await supabase
            .from("estimate_line_items")
            .insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      // Insert payment schedule
      // Always include deposit phase first if deposit > 0, then add non-deposit phases
      const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
      const remainingTotal = Math.max(0, total - depositAmount);
      
      const scheduleToInsert: any[] = [];
      
      // Add deposit phase first if applicable
      if (depositAmount > 0) {
        scheduleToInsert.push({
          estimate_id: savedEstimateId,
          phase_name: "Deposit",
          percent: 0, // Deposit is a fixed amount, not a percentage
          amount: depositAmount,
          due_type: "on_approval",
          due_date: null,
          description: "Due upon contract signing",
          sort_order: 0,
          company_id: companyId,
        });
      }
      
      // Add non-deposit phases
      nonDepositPhases.forEach((phase, index) => {
        scheduleToInsert.push({
          estimate_id: savedEstimateId,
          phase_name: phase.phase_name,
          percent: phase.percent,
          amount: (remainingTotal * (phase.percent || 0)) / 100,
          due_type: phase.due_type,
          due_date: phase.due_date || null,
          description: phase.description || null,
          sort_order: depositAmount > 0 ? index + 1 : index,
          company_id: companyId,
        });
      });
      
      if (scheduleToInsert.length > 0) {
        const { error: scheduleError } = await supabase
          .from("estimate_payment_schedule")
          .insert(scheduleToInsert);
        if (scheduleError) throw scheduleError;
      }

      return savedEstimateId;
    },
    onSuccess: () => {
      // Clear the draft from sessionStorage and DB on successful save
      clearDraft();
      deleteDraftDB();
      setDraftRestored(false);
      
      queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
      toast.success("New estimate created from copy!");
      // In page mode use onClose, in dialog mode use onOpenChange
      if (mode === 'page' && onClose) {
        onClose();
      } else {
        onOpenChange(false);
      }
      onSuccess?.();
    },
    onError: (error: Error) => {
      // Don't show generic error for validation failures - the specific validation toast already showed
      if (error.message === "Validation failed") {
        return;
      }
      console.error("Error saving estimate as new:", error);
      toast.error("Failed to create new estimate. Please try again.");
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatMoney = (amount: number) => {
    if (!Number.isFinite(amount)) return "0.00";
    return amount.toFixed(2);
  };

  // Tab validation functions
  const validateCustomerTab = useCallback(() => {
    const missing: string[] = [];
    if (!formData.customer_name?.trim()) missing.push("Customer Name");
    if (!formData.customer_email?.trim()) missing.push("Email");
    if (!formData.estimate_title?.trim()) missing.push("Project Title");
    if (!formData.job_address?.trim()) missing.push("Job Site Address");
    if (!formData.salesperson_name?.trim()) missing.push("Salesperson");
    return { isValid: missing.length === 0, missing };
  }, [formData.customer_name, formData.customer_email, formData.estimate_title, formData.job_address, formData.salesperson_name]);

  const validateScopeTab = useCallback(() => {
    const missing: string[] = [];
    if (!formData.work_scope_description?.trim() && groups.length === 0) {
      missing.push("Work Scope Description or Line Items");
    }
    if (!formData.sq_ft_to_build?.trim()) {
      missing.push("Sq/Ft To Build");
    }
    if (!formData.finishing_grade?.trim()) {
      missing.push("Finishing Grade");
    }
    return { isValid: missing.length === 0, missing };
  }, [formData.work_scope_description, formData.sq_ft_to_build, formData.finishing_grade, groups.length]);

  const validatePaymentsTab = useCallback(() => {
    // Payments tab has no required fields - always valid
    return { isValid: true, missing: [] as string[] };
  }, []);

  const validateClarificationTab = useCallback(() => {
    // Clarification tab is optional - always valid
    return { isValid: true, missing: [] as string[] };
  }, []);

  // Helper to get validation error class for required fields - always show red borders on empty required fields
  const getFieldErrorClass = useCallback((fieldValue: string | undefined | null) => {
    if (!fieldValue?.trim()) return "border-destructive ring-1 ring-destructive/30 focus-visible:ring-destructive";
    return "";
  }, []);

  // Tab order for navigation - manual mode skips clarification
  const tabOrder: string[] = estimateMode === 'manual'
    ? ["customer", "scope", "payments", "photos", "files", "terms"]
    : ["customer", "scope", "clarification", "payments", "photos", "files", "terms"];

  const handleNextTab = useCallback((currentTab: string, validation: { isValid: boolean; missing: string[] }) => {
    if (!validation.isValid) {
      setShowValidationErrors(true);
      toast.error(`Please fill in: ${validation.missing.join(", ")}`);
      return;
    }
    setShowValidationErrors(false);
    const currentIndex = tabOrder.indexOf(currentTab as typeof tabOrder[number]);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  }, [tabOrder]);

  // Next button component for tab bar - renders inline in TabsList
  const TabBarNextButton = useCallback(() => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex >= tabOrder.length - 1) return null; // No next button on last tab
    
    const nextTabName = tabOrder[currentIndex + 1];
    const nextTabLabels: Record<string, string> = {
      scope: "Scope",
      clarification: "Clarification",
      photos: "Photos",
      files: "Files",
      payments: "Progress Payments",
      terms: "T&C",
    };

    // Get validation for current tab
    const validation = activeTab === 'customer' ? validateCustomerTab() 
      : activeTab === 'scope' ? validateScopeTab()
      : activeTab === 'clarification' ? validateClarificationTab()
      : activeTab === 'payments' ? validatePaymentsTab()
      : { isValid: true, missing: [] as string[] };

    return (
      <Button
        type="button"
        onClick={() => handleNextTab(activeTab, validation)}
        variant={validation.isValid ? "default" : "outline"}
        size="sm"
        className="ml-auto h-8"
      >
        Next: {nextTabLabels[nextTabName] || nextTabName}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    );
  }, [activeTab, tabOrder, validateCustomerTab, validateScopeTab, validateClarificationTab, validatePaymentsTab, handleNextTab]);

  // Page mode: render inline without Dialog wrapper
  const isPageMode = mode === 'page';
  
  // Helper to handle closing - uses onClose in page mode, onOpenChange in dialog mode
  const handleClose = () => {
    if (isPageMode && onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  };

  if (loadingEstimate && isEditing) {
    if (isPageMode) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-6xl h-[90vh]"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Shared header buttons
  const headerButtons = (
    <>
      {isSuperAdmin && isEditing && (
        <Button 
          variant="outline" 
          size="sm"
          className="text-muted-foreground" 
          onClick={() => {
            const debugInfo = `Estimate ID: ${estimateId}\nOpportunity GHL ID: ${linkedOpportunityGhlId || 'null'}\nOpportunity UUID: ${linkedOpportunityUuid || 'null'}\nProject ID: ${linkedProjectId || 'null'}`;
            navigator.clipboard.writeText(debugInfo);
            toast.success("Debug info copied to clipboard");
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          Debug
        </Button>
      )}
      {/* AI Generate Scope button moved to Estimate Method card in scope tab */}
      {isEditing && (
        <Button 
          variant="outline" 
          onClick={() => saveAsNewMutation.mutate()} 
          disabled={saveAsNewMutation.isPending}
        >
          {saveAsNewMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {existingEstimate?.estimate?.status && existingEstimate.estimate.status !== 'draft' 
            ? "Create New Estimate" 
            : "Save As New"}
        </Button>
      )}
      {/* Save buttons - always show for editing */}
      <Button 
        onClick={() => {
          setSavingAction('save');
          saveMutation.mutate();
        }} 
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending && savingAction === 'save' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {existingEstimate?.estimate?.status && existingEstimate.estimate.status !== 'draft' ? 'Save Proposal' : 'Save Estimate'}
      </Button>
      <Button
        variant="secondary"
        disabled={saveMutation.isPending}
        onClick={async () => {
          setSavingAction('saveClose');
          try {
            await saveMutation.mutateAsync();
            handleClose();
          } catch (err) {
            // Error handled by mutation
          }
        }}
      >
        {saveMutation.isPending && savingAction === 'saveClose' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save & Close
      </Button>
      <Button 
        variant="outline" 
        onClick={() => {
          if (isGeneratingScope) {
            toast.info("AI generation will continue in the background. Re-open this estimate to see progress.", {
              duration: 5000,
            });
          }
          // Delete the DB draft on close (user abandoned without saving)
          clearDraft();
          deleteDraftDB();
          handleClose();
        }}
      >
        Close
      </Button>
    </>
  );

  const titleText = isEditing 
    ? (existingEstimate?.estimate?.status && existingEstimate.estimate.status !== 'draft' 
        ? "Edit Proposal"
        : "Edit Estimate")
    : isCloneMode ? "New Estimate (from Declined)" : "New Estimate";

  return (
    <>
      {/* AI Generation Progress Overlay */}
      <AIGenerationProgress 
        isGenerating={isGeneratingScope && showAiProgress} 
        hasPlansFile={!!plansFileUrl}
        currentStage={currentAIStage}
        stageProgress={stageProgress}
        queuePosition={queuePosition}
        onClose={() => setShowAiProgress(false)}
      />
      
      <Dialog open={open} modal={!isPageMode} onOpenChange={isPageMode ? undefined : onOpenChange}>
        <DialogContent 
          className={`${isPageMode ? 'w-full h-full' : 'max-w-[95vw] w-full h-[90vh]'} flex flex-col p-0`}
          onInteractOutside={(e) => isPageMode || e.preventDefault()}
          onPointerDownOutside={(e) => isPageMode || e.preventDefault()}
          onEscapeKeyDown={(e) => isPageMode || e.preventDefault()}
          hideCloseButton
          disablePortal={isPageMode}
        >
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl flex items-center gap-2">
                <span>{titleText}</span>
                {isEditing && (existingEstimate as any)?.estimate?.estimate_number && (
                  <Badge variant="outline" className="text-xs">
                    Est #{(existingEstimate as any).estimate.estimate_number}
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {headerButtons}
              </div>
            </div>
          </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={(newTab) => {
              // Block navigation away from customer tab if required fields are missing
              if (activeTab === 'customer' && newTab !== 'customer') {
                const validation = validateCustomerTab();
                if (!validation.isValid) {
                  setShowValidationErrors(true);
                  toast.error(`Please fill in: ${validation.missing.join(", ")}`);
                  return;
                }
              }
              // Block navigation away from scope tab if required fields are missing
              if (activeTab === 'scope' && newTab !== 'scope' && newTab !== 'customer') {
                const validation = validateScopeTab();
                if (!validation.isValid) {
                  setShowValidationErrors(true);
                  toast.error(`Please fill in: ${validation.missing.join(", ")}`);
                  return;
                }
              }
              setShowValidationErrors(false);
              setActiveTab(newTab);
            }} className="h-full flex flex-col">
              <TabsList className="mx-6 mt-4 w-auto justify-start">
                <TabsTrigger value="customer" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer
                </TabsTrigger>
                <TabsTrigger value="scope" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Scope
                </TabsTrigger>
                {groups.length > 0 && estimateMode !== 'manual' && (
                  <TabsTrigger value="clarification" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Clarification
                    {(() => {
                      const parsedQuestions = parseMissingInfo(aiSummary.missing_info || []);
                      const unansweredCount = parsedQuestions.filter(q => !clarificationAnswers[q.id]?.trim()).length;
                      return unansweredCount > 0 ? (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {unansweredCount}
                        </Badge>
                      ) : parsedQuestions.length > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-primary ml-1" />
                      ) : null;
                    })()}
                  </TabsTrigger>
                )}
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Phases
                </TabsTrigger>
                {/* Photos tab - always visible, triggers save+project creation if needed */}
                {linkedProjectId ? (
                  <TabsTrigger value="photos" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Photos
                  </TabsTrigger>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 h-9 px-3 text-sm font-medium"
                    disabled={saveMutation.isPending || isProposalReadOnly}
                    onClick={async () => {
                      // Save estimate which will auto-create project, then switch to photos tab
                      try {
                        const savedId = await saveMutation.mutateAsync();
                        if (savedId) {
                          // Give a moment for linkedProjectId to be set
                          setTimeout(() => {
                            setActiveTab("photos");
                          }, 300);
                        }
                      } catch (err) {
                        // Error already handled by mutation
                      }
                    }}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload Photos
                  </Button>
                )}
                {/* Files tab */}
                {linkedProjectId ? (
                  <TabsTrigger value="files" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Files
                  </TabsTrigger>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 h-9 px-3 text-sm font-medium"
                    disabled={saveMutation.isPending || isProposalReadOnly}
                    onClick={async () => {
                      try {
                        const savedId = await saveMutation.mutateAsync();
                        if (savedId) {
                          setTimeout(() => {
                            setActiveTab("files");
                          }, 300);
                        }
                      } catch (err) {
                        // Error already handled by mutation
                      }
                    }}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Upload Files
                  </Button>
                )}
                <TabsTrigger value="terms" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  T&C
                </TabsTrigger>
                {/* Next button in tab bar */}
                <TabBarNextButton />
              </TabsList>

              <ScrollArea className="flex-1 px-6 py-4">
              <TabsContent value="customer" className="mt-0 space-y-4">
                  {/* Read-only notice for proposals */}
                  {isProposalReadOnly && (
                    <div className="bg-muted/50 border border-muted-foreground/20 rounded-lg p-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span>This proposal has been sent and cannot be edited. Use "Create New Estimate" to create a copy.</span>
                    </div>
                  )}
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="customer_name" className="text-xs">Customer Name *</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          placeholder="John Smith"
                          className={cn("h-8 text-sm", getFieldErrorClass(formData.customer_name))}
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="customer_email" className="text-xs">Email *</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          onFocus={() => {
                            // Capture the original email when user starts editing
                            if (!originalEmail && formData.customer_email) {
                              setOriginalEmail(formData.customer_email);
                            }
                          }}
                          onBlur={(e) => {
                            const newEmail = e.target.value.trim();
                            // If email changed and we have a linked contact, show sync dialog
                            if (linkedContactUuid && originalEmail && newEmail && newEmail !== originalEmail) {
                              setPendingEmail(newEmail);
                              setEmailSyncDialogOpen(true);
                            }
                          }}
                          placeholder="john@example.com"
                          required
                          className={cn("h-8 text-sm", getFieldErrorClass(formData.customer_email))}
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="customer_phone" className="text-xs">Phone</Label>
                        <Input
                          id="customer_phone"
                          value={formatPhoneNumber(formData.customer_phone)}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value);
                            setFormData({ ...formData, customer_phone: formatted });
                          }}
                          placeholder="(555) 123-4567"
                          className="h-8 text-sm"
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="estimate_title" className="text-xs">Project Title *</Label>
                        <Input
                          id="estimate_title"
                          value={formData.estimate_title}
                          onChange={(e) => setFormData({ ...formData, estimate_title: e.target.value })}
                          placeholder="Kitchen Remodel"
                          className={cn("h-8 text-sm", getFieldErrorClass(formData.estimate_title))}
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label htmlFor="job_address" className="text-xs">Job Site Address *</Label>
                        <Input
                          id="job_address"
                          value={formData.job_address}
                          onChange={(e) => setFormData({ ...formData, job_address: e.target.value })}
                          placeholder="123 Main St, Los Angeles, CA 90001"
                          required
                          className={cn("h-8 text-sm", getFieldErrorClass(formData.job_address))}
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="estimate_date" className="text-xs">Estimate Date</Label>
                        <Input
                          id="estimate_date"
                          type="date"
                          value={formData.estimate_date}
                          onChange={(e) => setFormData({ ...formData, estimate_date: e.target.value })}
                          className="h-8 text-sm"
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="expiration_date" className="text-xs">Expiration Date</Label>
                        <Input
                          id="expiration_date"
                          type="date"
                          value={formData.expiration_date}
                          onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                          className="h-8 text-sm"
                          disabled={isProposalReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="salesperson_name" className="text-xs">Salesperson <span className="text-destructive">*</span></Label>
                        <Select
                          value={formData.salesperson_name || ""}
                          onValueChange={(value) => {
                            setFormData({ ...formData, salesperson_name: value });
                            syncSalespersonToProject(value);
                          }}
                          disabled={isProposalReadOnly}
                        >
                          <SelectTrigger className={cn("h-8 text-sm", getFieldErrorClass(formData.salesperson_name))}>
                            <SelectValue placeholder="Select salesperson..." />
                          </SelectTrigger>
                          <SelectContent>
                            {salespeople.map((sp) => (
                              <SelectItem key={sp.id} value={sp.name}>
                                {sp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!formData.salesperson_name?.trim() && (
                          <p className="text-xs text-destructive">Required</p>
                        )}
                      </div>
                      <div className="space-y-1 col-span-2 lg:col-span-3">
                        <Label htmlFor="linked_project" className="text-xs">Link to Project (Optional)</Label>
                        <Select
                          value={linkedProjectId || "none"}
                          onValueChange={(value) => setLinkedProjectId(value === "none" ? null : value)}
                          disabled={isProposalReadOnly}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select a project to link..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project linked</SelectItem>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                #{project.project_number} - {project.project_name || `${project.customer_first_name} ${project.customer_last_name}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                </TabsContent>

                <TabsContent value="scope" className="mt-0 space-y-4">
                  {/* Estimate Mode Selector */}
                  {!isProposalReadOnly && (
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <Label className="text-sm font-bold mb-2 block">Estimate Method</Label>
                        <div className="flex items-center gap-6">
                          <RadioGroup
                            value={estimateMode}
                            onValueChange={(val) => setEstimateMode(val as 'ai' | 'manual')}
                            className="flex gap-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="ai" id="mode-ai" />
                              <Label htmlFor="mode-ai" className="text-sm cursor-pointer font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Wand2 className="h-3.5 w-3.5" />
                                  AI Generated
                                </span>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="manual" id="mode-manual" />
                              <Label htmlFor="mode-manual" className="text-sm cursor-pointer font-medium">
                                <span className="flex items-center gap-1.5">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  Manual Entry
                                </span>
                              </Label>
                            </div>
                          </RadioGroup>
                          {estimateMode === 'ai' && (
                            <div className="ml-auto">
                              {isGeneratingScope ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowAiProgress(true)}
                                  className="border-primary/50 text-primary"
                                >
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  View Progress
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={generateScope}
                                >
                                  <Wand2 className="mr-2 h-4 w-4" />
                                  {groups.length > 0 ? 'Regenerate AI Scope' : 'AI Generate Scope'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Manual Entry Mode */}
                  {estimateMode === 'manual' ? (
                    <>
                      {/* Work Scope Description - always available for manual mode too */}
                      <Card>
                        <CardContent className="pt-5 pb-4 space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-bold flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" />
                              Work Scope Description
                            </Label>
                            <Textarea
                              value={formData.work_scope_description}
                              onChange={(e) => setFormData({ ...formData, work_scope_description: e.target.value })}
                              placeholder="Describe the work scope for this estimate..."
                              className="min-h-[120px]"
                              disabled={isProposalReadOnly}
                            />
                            <p className="text-xs text-muted-foreground">
                              Optional — describe the project scope for reference.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Manual Total Entry */}
                      <Card>
                        <CardContent className="pt-5 pb-4 space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-bold flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5" />
                              Estimate Total <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-muted-foreground">$</span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={manualTotalDraft || (manualTotal > 0 ? manualTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                    setManualTotalDraft(val);
                                    if (val !== '' && val !== '.' && !val.endsWith('.')) {
                                      setManualTotal(parseFloat(val) || 0);
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  const val = parseFloat(manualTotalDraft) || 0;
                                  setManualTotal(val);
                                  setManualTotalDraft('');
                                }}
                                placeholder="Enter total estimate amount"
                                className="max-w-[250px] text-lg font-semibold h-11"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Enter the total price for this estimate. Payment phases will be based on this amount.
                            </p>
                          </div>

                          {manualTotal > 0 && (
                            <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-semibold">{formatCurrency(manualTotal)}</span>
                              </div>
                              {totals.depositAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Deposit ({formData.deposit_percent}%)</span>
                                  <span className="font-medium">{formatCurrency(totals.depositAmount)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Next button to go to payment phases */}
                      {manualTotal > 0 && (
                        <div className="flex justify-end">
                          <Button onClick={() => setActiveTab("payments")} size="sm">
                            Next: Payment Phases
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                  {/* Sq/Ft To Build & Finishing Grade */}
                  <Card>
                    <CardContent className="pt-5 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-bold">Sq/Ft To Build <span className="text-destructive">*</span></Label>
                          <Input
                            value={formData.sq_ft_to_build}
                            onChange={(e) => setFormData({ ...formData, sq_ft_to_build: e.target.value })}
                            placeholder='e.g. 2500 or "Home Improvement project"'
                            disabled={isProposalReadOnly}
                            className="text-base font-medium"
                          />
                          <p className="text-xs text-muted-foreground">Enter square footage or "Home Improvement project"</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-bold">Garage Sq/Ft</Label>
                          <Input
                            value={formData.garage_sq_ft}
                            onChange={(e) => setFormData({ ...formData, garage_sq_ft: e.target.value })}
                            placeholder="e.g. 600 (optional)"
                            disabled={isProposalReadOnly}
                            className="text-base font-medium"
                          />
                          <p className="text-xs text-muted-foreground">Leave blank if no garage</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-bold">Finishing Grade <span className="text-destructive">*</span></Label>
                          <RadioGroup
                            value={formData.finishing_grade}
                            onValueChange={(val) => setFormData({ ...formData, finishing_grade: val })}
                            className="flex flex-wrap gap-3 pt-1"
                            disabled={isProposalReadOnly}
                          >
                            {["Builder", "Mid", "High", "Ultra Luxury"].map((grade) => (
                              <div key={grade} className="flex items-center space-x-1.5">
                                <RadioGroupItem value={grade} id={`grade-${grade}`} />
                                <Label htmlFor={`grade-${grade}`} className="text-sm font-semibold cursor-pointer">{grade}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Work Scope Description - Collapsible, defaulted to collapsed */}
                  <Card>
                    <Collapsible open={showWorkScopeDescription} onOpenChange={setShowWorkScopeDescription}>
                      <CardHeader className="py-3">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary w-full">
                          {showWorkScopeDescription ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <FileText className="h-4 w-4" />
                          <span className="font-semibold text-sm">Work Scope Description</span>
                          {formData.work_scope_description?.trim() && (
                            <Badge variant="outline" className="ml-auto">
                              {formData.work_scope_description.length} chars
                            </Badge>
                          )}
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Textarea
                            value={formData.work_scope_description}
                            onChange={(e) => setFormData({ ...formData, work_scope_description: e.target.value })}
                            placeholder="Describe the work in detail. Include all measurements, quantities, and specifications. Example:

Kitchen remodel:
- Remove existing cabinets (12 linear ft upper, 15 linear ft lower)
- Install new shaker-style cabinets
- Granite countertop: 45 sqft with 4 inch backsplash
- New sink and faucet installation
- Electrical: add 3 outlets, relocate 1 switch
- Flooring: 150 sqft luxury vinyl plank

The more detail you provide, the more accurate the AI-generated estimate will be."
                            className="min-h-[150px]"
                            disabled={isProposalReadOnly}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Include measurements (sqft, linear ft, quantities) and specific materials. 
                            The AI uses this + job site ZIP code for location-based pricing.
                          </p>
                          
                          {/* Plans File Upload - Future Feature */}
                          <div className="mt-4 pt-4 border-t opacity-50">
                            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                              <Upload className="h-4 w-4" />
                              Construction Plans (Optional)
                              <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Future Feature</span>
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                              Upload PDF/image or paste a Google Drive link. The AI will analyze plans to generate a more accurate estimate.
                            </p>
                            
                            <div className="space-y-3">
                              {/* File Upload Option - Disabled */}
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full cursor-not-allowed"
                                  disabled
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Plans (PDF or Image)
                                </Button>
                              </div>
                              
                              {/* OR Divider */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">OR</span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              
                              {/* Google Drive URL Input - Disabled */}
                              <div className="flex gap-2">
                                <Input
                                  type="url"
                                  placeholder="Paste Google Drive link..."
                                  className="flex-1 text-sm"
                                  disabled
                                />
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled
                                >
                                  Add
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Make sure the file is shared as "Anyone with the link"
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>

                  <AISummaryCard
                    summary={aiSummary}
                    open={showAiSummary}
                    onOpenChange={setShowAiSummary}
                    onAnswerQuestions={() => setShowMissingInfoPanel(true)}
                    isBusy={isGeneratingScope || isRegeneratingWithAnswers}
                  />

                  {/* Check if mandatory fields are filled for AI generation */}
                  {(() => {
                    const canGenerateAI = formData.customer_name?.trim() && formData.job_address?.trim() && formData.estimate_title?.trim() && formData.salesperson_name?.trim() && formData.sq_ft_to_build?.trim() && formData.finishing_grade?.trim();
                    const missingFields = [];
                    if (!formData.customer_name?.trim()) missingFields.push('Customer Name');
                    if (!formData.job_address?.trim()) missingFields.push('Job Address');
                    if (!formData.estimate_title?.trim()) missingFields.push('Project Title');
                    if (!formData.salesperson_name?.trim()) missingFields.push('Salesperson');
                    if (!formData.sq_ft_to_build?.trim()) missingFields.push('Sq/Ft To Build');
                    if (!formData.finishing_grade?.trim()) missingFields.push('Finishing Grade');
                    
                    return groups.length === 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Line Items</h3>
                        </div>
                        <Card>
                          <CardContent className="py-8 text-center">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-4">No scope items yet. Use AI to generate an estimate from the Work Scope Description above.</p>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <>
                        {/* Hide Add Area button for read-only proposals */}
                        {!isProposalReadOnly && (
                          <div className="flex items-center justify-end mb-2">
                            <Button onClick={addGroup} size="sm" variant="outline">
                              <FolderPlus className="mr-2 h-4 w-4" />
                              Add Area
                            </Button>
                          </div>
                        )}
                        <Card>
                        <Collapsible open={showLineItems} onOpenChange={setShowLineItems}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between gap-2">
                              <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary">
                                {showLineItems ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <h3 className="font-semibold">Line Items</h3>
                                <Badge variant="secondary">
                                  {groups.length} {groups.length === 1 ? 'area' : 'areas'}
                                </Badge>
                                <Badge variant="outline">
                                  {groups.reduce((sum, g) => sum + g.items.length, 0)} items
                                </Badge>
                              </CollapsibleTrigger>
                              {/* Hide Clear All / Regenerate buttons for read-only proposals */}
                              {!isProposalReadOnly && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSkipAutoRecovery(true);
                                      setWasManuallyCleared(true);
                                      setGroups([]);
                                      setPaymentSchedule([]);
                                      setAiSummary({ ...emptyAiSummary });
                                      setShowAiSummary(false);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent className="space-y-4 pt-0">
                      {groups.map((group) => (
                        <Card key={group.id}>
                          <Collapsible open={group.isOpen} onOpenChange={() => toggleGroup(group.id)}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between gap-2">
                                <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary flex-1 min-w-0">
                                  {group.isOpen ? (
                                    <ChevronDown className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0" />
                                  )}
                                  <Input
                                    value={group.group_name}
                                    onChange={(e) => updateGroup(group.id, { group_name: e.target.value })}
                                    className="font-semibold border-0 p-0 h-auto focus-visible:ring-0 min-w-[120px] flex-1"
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isProposalReadOnly}
                                  />
                                  <Badge variant="secondary" className="ml-2 shrink-0">
                                    {group.items.length} items
                                  </Badge>
                                  <Badge variant="outline" className="ml-1 shrink-0">
                                    {formatCurrency(group.items.reduce((sum, i) => sum + i.line_total, 0))}
                                  </Badge>
                                </CollapsibleTrigger>
                                {/* Hide Add/Delete buttons for read-only proposals */}
                                {!isProposalReadOnly && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addLineItem(group.id)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteGroup(group.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                            <CollapsibleContent>
                              <CardContent className="pt-0">
                                {group.items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No items in this area. Click + to add one.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Header row - Labor $ and Materials $ columns */}
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                                      <div className="flex-1 min-w-[200px]">Description</div>
                                      <div className="w-16">Qty</div>
                                      <div className="w-20">Unit</div>
                                      <div className="w-20">Labor $</div>
                                      <div className="w-20">Material $</div>
                                      <div className="w-16">Markup</div>
                                      <div className="w-24">Price</div>
                                      <div className="w-24 text-right">Total</div>
                                      <div className="w-8"></div>
                                    </div>
                                    {group.items.map((item) => (
                                      <div key={item.id} className="flex items-start gap-2">
                                        <Textarea
                                          value={item.description}
                                          onChange={(e) => updateLineItem(group.id, item.id, { description: e.target.value })}
                                          className="flex-1 min-w-[200px] min-h-[32px] text-sm resize-none overflow-hidden py-1.5"
                                          placeholder="Item description"
                                          rows={1}
                                          disabled={isProposalReadOnly}
                                          onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = `${target.scrollHeight}px`;
                                          }}
                                          ref={(el) => {
                                            if (el) {
                                              el.style.height = 'auto';
                                              el.style.height = `${el.scrollHeight}px`;
                                            }
                                          }}
                                        />
                                        <div className="flex items-center gap-2 mt-1">
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={item.quantity}
                                            onChange={(e) => { 
                                              const val = e.target.value; 
                                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                updateLineItem(group.id, item.id, { quantity: parseFloat(val) || 0 }); 
                                              }
                                            }}
                                            className="w-16 h-8 text-sm"
                                            disabled={isProposalReadOnly}
                                          />
                                          <Select
                                            value={item.unit}
                                            onValueChange={(v) => updateLineItem(group.id, item.id, { unit: v })}
                                            disabled={isProposalReadOnly}
                                          >
                                            <SelectTrigger className="w-20 h-8 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {units.map((u) => (
                                                <SelectItem key={u} value={u}>
                                                  {u}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          {/* Labor $ field */}
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={laborCostDrafts[item.id] ?? formatMoney(item.labor_cost)}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/,/g, ".");
                                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                                setLaborCostDrafts((prev) => ({ ...prev, [item.id]: val }));
                                                if (val !== "" && val !== "." && !val.endsWith(".")) {
                                                  updateLineItem(group.id, item.id, { labor_cost: Number(val) });
                                                  setUnitPriceDrafts((prev) => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                  });
                                                }
                                              }
                                            }}
                                            onBlur={() => {
                                              const draft = laborCostDrafts[item.id];
                                              if (draft === undefined) return;
                                              const normalized = draft === "" || draft === "." ? 0 : Number(draft);
                                              updateLineItem(group.id, item.id, { labor_cost: normalized });
                                              setLaborCostDrafts((prev) => ({ ...prev, [item.id]: formatMoney(normalized) }));
                                            }}
                                            className="w-20 h-8 text-sm"
                                            placeholder="0.00"
                                            disabled={isProposalReadOnly}
                                          />
                                          {/* Material $ field */}
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={materialCostDrafts[item.id] ?? formatMoney(item.material_cost)}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/,/g, ".");
                                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                                setMaterialCostDrafts((prev) => ({ ...prev, [item.id]: val }));
                                                if (val !== "" && val !== "." && !val.endsWith(".")) {
                                                  updateLineItem(group.id, item.id, { material_cost: Number(val) });
                                                  setUnitPriceDrafts((prev) => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                  });
                                                }
                                              }
                                            }}
                                            onBlur={() => {
                                              const draft = materialCostDrafts[item.id];
                                              if (draft === undefined) return;
                                              const normalized = draft === "" || draft === "." ? 0 : Number(draft);
                                              updateLineItem(group.id, item.id, { material_cost: normalized });
                                              setMaterialCostDrafts((prev) => ({ ...prev, [item.id]: formatMoney(normalized) }));
                                            }}
                                            className="w-20 h-8 text-sm"
                                            placeholder="0.00"
                                            disabled={isProposalReadOnly}
                                          />
                                          {/* Markup % field */}
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={item.markup_percent}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                updateLineItem(group.id, item.id, { markup_percent: parseFloat(val) || 0 });
                                                setUnitPriceDrafts((prev) => {
                                                  const next = { ...prev };
                                                  delete next[item.id];
                                                  return next;
                                                });
                                              }
                                            }}
                                            className="w-16 h-8 text-sm"
                                            placeholder="35"
                                            disabled={isProposalReadOnly}
                                          />
                                          {/* Price field */}
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={unitPriceDrafts[item.id] ?? formatMoney(item.unit_price)}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/,/g, ".");
                                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                                setUnitPriceDrafts((prev) => ({ ...prev, [item.id]: val }));
                                                if (val !== "" && val !== "." && !val.endsWith(".")) {
                                                  updateLineItem(group.id, item.id, { unit_price: Number(val) });
                                                }
                                              }
                                            }}
                                            onBlur={() => {
                                              const draft = unitPriceDrafts[item.id];
                                              if (draft === undefined) return;
                                              const normalized = draft === "" || draft === "." ? 0 : Number(draft);
                                              updateLineItem(group.id, item.id, { unit_price: normalized });
                                              setUnitPriceDrafts((prev) => ({ ...prev, [item.id]: formatMoney(normalized) }));
                                            }}
                                            className="w-24 h-8 text-sm"
                                            disabled={isProposalReadOnly}
                                          />
                                          <div className="w-24 text-sm font-medium text-right">
                                            {formatCurrency(item.line_total)}
                                          </div>
                                          {/* Hide delete button for read-only proposals */}
                                          {!isProposalReadOnly && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => deleteLineItem(group.id, item.id)}
                                              className="w-8 h-8 p-0 text-destructive"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                      </>
                    );
                  })()}
                    </>
                  )}

                </TabsContent>

                <TabsContent value="clarification" className="mt-0 space-y-4">
                  {/* Regenerate button at top when questions are answered */}
                  {(() => {
                    const parsedQuestions = parseMissingInfo(aiSummary.missing_info || []);
                    const answeredCount = parsedQuestions.filter(q => clarificationAnswers[q.id]?.trim()).length;
                    
                    if (answeredCount > 0) {
                      const handleRegenerateWithAnswers = () => {
                        const formattedAnswers: Record<string, string> = {};
                        parsedQuestions.forEach((q) => {
                          if (clarificationAnswers[q.id]?.trim()) {
                            formattedAnswers[q.text] = clarificationAnswers[q.id].trim();
                          }
                        });
                        handleMissingInfoSubmit(formattedAnswers);
                      };

                      return (
                        <div className="flex gap-2">
                          <Button
                            onClick={handleRegenerateWithAnswers}
                            disabled={isRegeneratingWithAnswers || isGeneratingScope}
                            variant="outline"
                            className="flex-1"
                            size="lg"
                          >
                            {isRegeneratingWithAnswers ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Regenerate with Answers ({answeredCount}) - Optional
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => setActiveTab("payments")}
                            size="lg"
                            className="flex-1"
                          >
                            Next: Phases
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Additional Clarification (Optional)
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Answer these questions to refine your estimate.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const parsedQuestions = parseMissingInfo(aiSummary.missing_info || []);
                        const groupedQuestions = groupByCategory(parsedQuestions);
                        const answeredCount = Object.values(clarificationAnswers).filter(v => v && v.trim()).length;
                        const totalCount = parsedQuestions.length;
                        const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

                        const updateAnswer = (id: string, value: string) => {
                          setClarificationAnswers(prev => ({ ...prev, [id]: value }));
                        };

                        const updateMultiSelectAnswer = (id: string, selected: string[]) => {
                          setClarificationAnswers(prev => ({ ...prev, [id]: selected.join(", ") }));
                        };

                        const getMultiSelectValue = (id: string): string[] => {
                          const value = clarificationAnswers[id];
                          if (!value) return [];
                          return value.split(", ").filter(s => s.trim());
                        };

                        const handleRegenerateWithAnswers = () => {
                          const formattedAnswers: Record<string, string> = {};
                          parsedQuestions.forEach((q) => {
                            if (clarificationAnswers[q.id]?.trim()) {
                              formattedAnswers[q.text] = clarificationAnswers[q.id].trim();
                            }
                          });
                          handleMissingInfoSubmit(formattedAnswers);
                        };

                        if (parsedQuestions.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                              <p className="text-muted-foreground">
                                No clarification questions at this time.
                              </p>
                              <p className="text-sm text-muted-foreground mt-2">
                                Generate an estimate with AI to see questions here.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {/* Progress indicator */}
                            <div className="border rounded-lg p-4 bg-muted/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">
                                  {answeredCount} of {totalCount} answered
                                </span>
                                <Badge variant={progress === 100 ? "default" : "secondary"}>
                                  {progress}%
                                </Badge>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>

                            {/* Questions grouped by category - unanswered first, then answered */}
                            {(() => {
                              // Separate questions into unanswered and answered
                              // A question is only "answered" if it has content AND is not currently focused
                              const allQuestions = Object.entries(groupedQuestions).flatMap(([category, questions]) => 
                                questions.map(q => ({ ...q, category }))
                              );
                              const isQuestionAnswered = (q: typeof allQuestions[0]) => 
                                clarificationAnswers[q.id]?.trim() && focusedQuestionId !== q.id;
                              
                              const unansweredQuestions = allQuestions.filter(q => !isQuestionAnswered(q));
                              const answeredQuestions = allQuestions.filter(q => isQuestionAnswered(q));

                              // Group by category for unanswered
                              const unansweredByCategory: Record<string, typeof unansweredQuestions> = {};
                              unansweredQuestions.forEach(q => {
                                if (!unansweredByCategory[q.category]) unansweredByCategory[q.category] = [];
                                unansweredByCategory[q.category].push(q);
                              });

                              return (
                                <>
                                  {/* Unanswered questions */}
                                  {Object.entries(unansweredByCategory).map(([category, questions]) => (
                                    <div key={category}>
                                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                        {category}
                                      </h4>
                                      <div className="space-y-4">
                                        {questions.map((question) => (
                                          <div key={question.id} className="space-y-2 p-3 rounded-lg border border-border bg-background">
                                            <Label className="text-sm flex items-start gap-2">
                                              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                              <span>{question.text}</span>
                                            </Label>
                                            
                                            {question.type === "multiselect" && question.options ? (
                                              <MultiSelectDropdown
                                                options={question.options}
                                                selected={getMultiSelectValue(question.id)}
                                                onChange={(selected) => updateMultiSelectAnswer(question.id, selected)}
                                                placeholder="Select one or more options..."
                                              />
                                            ) : (
                                              <Input
                                                type="text"
                                                value={clarificationAnswers[question.id] || ""}
                                                onChange={(e) => updateAnswer(question.id, e.target.value)}
                                                onFocus={() => setFocusedQuestionId(question.id)}
                                                onBlur={() => setFocusedQuestionId(null)}
                                                placeholder="Enter your answer..."
                                              />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}

                                  {/* Answered questions section */}
                                  {answeredQuestions.length > 0 && (
                                    <div className="border-t pt-4 mt-4">
                                      <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Answered ({answeredQuestions.length})
                                      </h4>
                                      <div className="space-y-3">
                                        {answeredQuestions.map((question) => (
                                          <div 
                                            key={question.id} 
                                            className="p-3 rounded-lg border border-primary/20 bg-primary/5"
                                          >
                                            <div className="flex items-start gap-2 mb-2">
                                              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                              <span className="text-sm font-medium">{question.text}</span>
                                            </div>
                                            <div className="ml-6">
                                              {question.type === "multiselect" && question.options ? (
                                                <MultiSelectDropdown
                                                  options={question.options}
                                                  selected={getMultiSelectValue(question.id)}
                                                  onChange={(selected) => updateMultiSelectAnswer(question.id, selected)}
                                                  placeholder="Select one or more options..."
                                                />
                                              ) : (
                                                <Input
                                                  type="text"
                                                  value={clarificationAnswers[question.id] || ""}
                                                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                                                  onFocus={() => setFocusedQuestionId(question.id)}
                                                  onBlur={() => setFocusedQuestionId(null)}
                                                  placeholder="Enter your answer..."
                                                  className="border-primary/30 bg-background"
                                                />
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {/* Regenerate button moved to top of tab */}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Pricing & Payment Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        {/* Markup */}
                        <div className="border rounded p-2 bg-background min-w-0">
                          <Label htmlFor="default_markup_percent" className="text-[10px] text-muted-foreground mb-0.5 block">Markup</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              id="default_markup_percent"
                              type="text"
                              inputMode="decimal"
                              value={formData.default_markup_percent}
                              onChange={(e) => {
                                const newMarkup = parseFloat(e.target.value) || 0;
                                setFormData({ ...formData, default_markup_percent: newMarkup });
                                setGroups(prevGroups => prevGroups.map(g => ({
                                  ...g,
                                  items: g.items.map(item => {
                                    const newUnitPrice = item.cost * (1 + newMarkup / 100);
                                    return {
                                      ...item,
                                      markup_percent: newMarkup,
                                      unit_price: newUnitPrice,
                                      line_total: item.quantity * newUnitPrice,
                                    };
                                  }),
                                })));
                              }}
                              className="w-14 h-7 text-sm"
                              placeholder="50"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>


                        {/* Deposit */}
                        <div className="border rounded p-2 bg-background min-w-0">
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Deposit (min of % or max $)</Label>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id="deposit_required"
                              checked={formData.deposit_required}
                              onCheckedChange={(v) => setFormData({ ...formData, deposit_required: v })}
                              className="scale-75"
                            />
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formData.deposit_percent}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  const numVal = parseFloat(val) || 0;
                                  // Cap at company default deposit percent
                                  const maxPercent = estimateDefaults?.percent ?? 100;
                                  const cappedVal = Math.min(numVal, maxPercent);
                                  setFormData({ ...formData, deposit_percent: cappedVal });
                                }
                              }}
                              disabled={!formData.deposit_required}
                              className="w-16 h-7 text-sm"
                              title={estimateDefaults ? `Max: ${estimateDefaults.percent}% (from company settings)` : undefined}
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                            {estimateDefaults && (
                              <span className="text-[10px] text-muted-foreground/60">(max {estimateDefaults.percent}%)</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">or max</span>
                            <span className="text-[10px] text-muted-foreground">$</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formData.deposit_max_amount}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setFormData({ ...formData, deposit_max_amount: parseFloat(val) || 0 });
                                }
                              }}
                              disabled={!formData.deposit_required}
                              className="w-20 h-7 text-sm"
                            />
                          </div>
                        </div>

                        {/* Discount */}
                        <div className="border rounded p-2 bg-background min-w-0">
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Discount</Label>
                          <div className="flex items-center gap-1">
                            <Select
                              value={formData.discount_type}
                              onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
                            >
                              <SelectTrigger className="w-12 h-7 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="fixed">$</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formData.discount_value === 0 ? '' : formData.discount_value}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setFormData({ ...formData, discount_value: val === '' ? 0 : (val.endsWith('.') ? val : parseFloat(val) || 0) as number });
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setFormData({ ...formData, discount_value: val });
                              }}
                              placeholder="0"
                              className="w-24 h-7 text-sm"
                            />
                            {totals.discountAmount > 0 && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                -{formatCurrency(totals.discountAmount)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Final Price Override */}
                        <div className="border rounded p-2 bg-background min-w-0">
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Final Price</Label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={finalPriceDraft}
                              placeholder={formatCurrency(totals.total).replace('$', '').replace(',', '')}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setFinalPriceDraft(val);
                                }
                              }}
                              onBlur={() => {
                                if (finalPriceDraft) {
                                  applyFinalPrice();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  applyFinalPrice();
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-32 h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">Payment Schedule</CardTitle>
                      <Button onClick={addPaymentPhase} size="sm" variant="outline" className="h-7 text-xs">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Progress Payment
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {paymentSchedule.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No progress payments defined. Add progress payments or use AI to generate.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {/* Deposit row - always shown first and uneditable */}
                          {totals.depositAmount > 0 && (
                            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                              <Input
                                value="Deposit"
                                disabled
                                className="w-40 bg-muted"
                              />
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  value="—"
                                  disabled
                                  className="w-20 bg-muted text-center"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                = {formatCurrency(totals.depositAmount)}
                              </span>
                              <Select value="on_approval" disabled>
                                <SelectTrigger className="w-32 bg-muted">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_approval">On Approval</SelectItem>
                                </SelectContent>
                              </Select>
                              <textarea
                                value="Due upon contract signing"
                                disabled
                                className="flex-1 min-h-[36px] rounded-md border border-input bg-muted px-3 py-2 text-sm resize-none overflow-hidden"
                                rows={1}
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                              />
                              <div className="w-8" /> {/* Spacer for alignment with delete buttons */}
                            </div>
                          )}
                          
                          {/* Other payment phases - editable with drag to reorder */}
                          {paymentSchedule
                            .filter(p => p.phase_name !== "Deposit")
                            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            .map((phase) => (
                            <div 
                              key={phase.id} 
                              className={`flex flex-wrap items-center gap-3 p-3 border-2 rounded-lg transition-all duration-150 ${
                                draggedPhaseId === phase.id 
                                  ? 'opacity-50 border-primary scale-[0.98]' 
                                  : dragOverPhaseId === phase.id && draggedPhaseId !== phase.id
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : 'border-border'
                              }`}
                              draggable
                              onDragStart={(e) => handlePhaseDragStart(e, phase.id)}
                              onDragOver={(e) => handlePhaseDragOver(e, phase.id)}
                              onDragLeave={handlePhaseDragLeave}
                              onDrop={(e) => handlePhaseDrop(e, phase.id)}
                              onDragEnd={handlePhaseDragEnd}
                            >
                              <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <textarea
                                value={phase.phase_name}
                                onChange={(e) => updatePaymentPhase(phase.id, { phase_name: e.target.value })}
                                className="w-52 min-h-[36px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none overflow-hidden"
                                placeholder="Phase name"
                                rows={1}
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                              />
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={phase.percent}
                                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updatePaymentPhase(phase.id, { percent: parseFloat(val) || 0 }); }}
                                  className="w-20"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                = {formatCurrency((Math.max(0, totals.total - totals.depositAmount) * (phase.percent || 0)) / 100)}
                              </span>
                              <Select
                                value={phase.due_type}
                                onValueChange={(v) => updatePaymentPhase(phase.id, { due_type: v })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_approval">On Approval</SelectItem>
                                  <SelectItem value="milestone">Milestone</SelectItem>
                                  <SelectItem value="date">By Date</SelectItem>
                                </SelectContent>
                              </Select>
                              <textarea
                                value={phase.description}
                                onChange={(e) => updatePaymentPhase(phase.id, { description: e.target.value })}
                                className="flex-1 min-w-[120px] min-h-[36px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none overflow-hidden"
                                placeholder="Description"
                                rows={1}
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                onKeyDown={(e) => e.stopPropagation()}
                                onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  deletePaymentPhase(phase.id);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-destructive shrink-0"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {/* Payment phases total vs estimate total indicator */}
                          {(() => {
                            // Only count non-deposit phases for percent calculation
                            const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
                            const remainingAfterDeposit = Math.max(0, totals.total - totals.depositAmount);
                            
                            // Phases total = deposit + sum of non-deposit phase amounts
                            const phasesTotal = totals.depositAmount + nonDepositPhases.reduce((sum, phase) => {
                              return sum + ((remainingAfterDeposit * (phase.percent || 0)) / 100);
                            }, 0);
                            
                            const difference = Math.round((phasesTotal - totals.total) * 100) / 100;
                            const isBalanced = Math.abs(difference) < 0.01;
                            
                            // Only sum percent of non-deposit phases (should equal 100%)
                            const percentTotal = nonDepositPhases.reduce((sum, p) => sum + (p.percent || 0), 0);
                            
                            // Find the last non-deposit phase for auto-balance
                            const lastPhase = nonDepositPhases[nonDepositPhases.length - 1];
                            const canAutoBalance = lastPhase && !isBalanced && totals.total > 0;
                            
                            const handleAutoBalance = () => {
                              if (!lastPhase) return;
                              
                              // Calculate the remaining amount after deposit
                              const remainingAfterDeposit = Math.max(0, totals.total - totals.depositAmount);
                              if (remainingAfterDeposit <= 0) return;
                              
                              // Calculate sum of all other non-deposit phases (excluding last one)
                              const otherPhasesPercent = nonDepositPhases
                                .filter(p => p.id !== lastPhase.id)
                                .reduce((sum, p) => sum + (p.percent || 0), 0);
                              
                              // The last phase needs to cover the remaining percentage
                              const newLastPhasePercent = Math.round((100 - otherPhasesPercent) * 100) / 100;
                              
                              if (newLastPhasePercent >= 0 && newLastPhasePercent <= 100) {
                                updatePaymentPhase(lastPhase.id, { percent: newLastPhasePercent });
                              }
                            };
                            
                            return (
                              <div className={`mt-4 p-3 rounded-lg border ${isBalanced ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    {isBalanced ? (
                                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    ) : (
                                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                    )}
                                    <span className={isBalanced ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                                      {isBalanced ? 'Phases balanced' : 'Phases not balanced'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground">
                                      {percentTotal}% of remaining
                                      {percentTotal !== 100 && <span className="text-amber-500 ml-1">(should be 100%)</span>}
                                    </span>
                                    {canAutoBalance && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAutoBalance}
                                        className="h-6 text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                      >
                                        Auto-balance
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Phases Total:</span>
                                    <span className={`ml-2 font-medium ${isBalanced ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}`}>
                                      {formatCurrency(phasesTotal)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Estimate Total:</span>
                                    <span className="ml-2 font-medium">{formatCurrency(totals.total)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Difference:</span>
                                    <span className={`ml-2 font-medium ${isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                      {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </TabsContent>

                <TabsContent value="terms" className="mt-0 space-y-3">
                  {/* Save button for Terms tab */}
                  <Button 
                    onClick={() => saveMutation.mutate()} 
                    disabled={saveMutation.isPending}
                    className="w-full h-9"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {existingEstimate?.estimate?.status && existingEstimate.estimate.status !== 'draft' ? 'Save Proposal' : 'Save Estimate'}
                      </>
                    )}
                  </Button>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Customer View Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5 flex-1">
                          <Label className="text-xs">Show SalesRep Scope Description</Label>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            Show scope of work text from Scope tab
                          </p>
                        </div>
                        <Switch
                          checked={formData.show_scope_to_customer}
                          onCheckedChange={(checked) => {
                            setFormData({ ...formData, show_scope_to_customer: checked });
                            autoSaveVisibilityToggle('show_scope_to_customer', checked);
                          }}
                        />
                      </div>
                      {estimateMode === 'ai' && (
                        <>
                          <div className="flex items-center justify-between gap-4 pt-2 border-t">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-xs">Show AI Generated Line Items</Label>
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                Show itemized scope breakdown (titles only)
                              </p>
                            </div>
                            <Switch
                              checked={formData.show_line_items_to_customer}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, show_line_items_to_customer: checked });
                                autoSaveVisibilityToggle('show_line_items_to_customer', checked);
                                if (!checked && formData.show_details_to_customer) {
                                  setFormData(prev => ({ ...prev, show_line_items_to_customer: checked, show_details_to_customer: false }));
                                  autoSaveVisibilityToggle('show_details_to_customer', false);
                                }
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-4 pt-2 border-t">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-xs">Show AI Driven Line Item Details</Label>
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                Show qty, unit, and unit price per item
                              </p>
                            </div>
                            <Switch
                              checked={formData.show_details_to_customer}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, show_details_to_customer: checked });
                                autoSaveVisibilityToggle('show_details_to_customer', checked);
                              }}
                              disabled={!formData.show_line_items_to_customer}
                            />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Add internal notes (not visible to customer)..."
                        rows={3}
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Notes to Customer</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Textarea
                        value={formData.notes_to_customer}
                        onChange={(e) => setFormData({ ...formData, notes_to_customer: e.target.value })}
                        placeholder="Add notes that will be shown to the customer..."
                        rows={3}
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Terms & Conditions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Textarea
                        value={formData.terms_and_conditions}
                        onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                        placeholder="Enter terms and conditions..."
                        rows={5}
                        className="text-sm"
                        disabled={isProposalReadOnly}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Photos Tab */}
                <TabsContent value="photos" className="mt-0">
                  {linkedProjectId ? (
                    <PhotosSection 
                      projectId={linkedProjectId} 
                      uploadLimitMb={15}
                      photoCategory="Estimate Photo"
                      filterCategory="Estimate Photo"
                      sectionTitle="Estimate Photos"
                      estimateId={currentEstimateId || undefined}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-4">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Save the estimate first to upload photos
                      </p>
                      <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save & Continue
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Files Tab */}
                <TabsContent value="files" className="mt-0">
                  {linkedProjectId && currentEstimateId ? (
                    <EstimateFilesSection
                      projectId={linkedProjectId}
                      estimateId={currentEstimateId}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Save the estimate first to upload files
                      </p>
                      <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save & Continue
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Sidebar - Totals with Profit Metrics */}
          <Collapsible defaultOpen={false} className="w-80 border-l bg-muted/30">
            <div className="p-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="font-semibold">Estimate Summary</h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="px-4 pb-4 overflow-y-auto">
            <div className="space-y-3 text-sm">
              {/* Cost & Profit Section */}
              <div className="p-3 bg-background rounded-lg border space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Cost</span>
                  <span>{formatCurrency(totals.totalCost)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Gross Profit</span>
                  <span className="font-medium">{formatCurrency(totals.grossProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span className={`font-medium ${totals.marginPercent >= 30 ? 'text-green-600' : totals.marginPercent >= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                    {totals.marginPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (Selling)</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              
              {formData.deposit_required && (
                <div className="flex justify-between text-primary">
                  <span>Deposit</span>
                  <span className="font-medium">{formatCurrency(totals.depositAmount)}</span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Default Markup</span>
                <span>{formData.default_markup_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Areas</span>
                <span>{groups.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Line Items</span>
                <span>{groups.reduce((sum, g) => sum + g.items.length, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Phases</span>
                <span>{paymentSchedule.length}</span>
              </div>
            </div>

            {groups.length > 0 && (
              <>
                <Separator className="my-4" />
                <h4 className="font-medium mb-2 text-sm">By Area</h4>
                <div className="space-y-2 text-sm">
                  {groups.map((group) => (
                    <div key={group.id} className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground flex-1 break-words">
                        {group.group_name}
                      </span>
                      <span className="font-medium shrink-0">
                        {formatCurrency(group.items.reduce((sum, i) => sum + i.line_total, 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            </CollapsibleContent>
          </Collapsible>
        </div>
        </DialogContent>
      </Dialog>
      
      {/* Missing Info Panel */}
      <MissingInfoPanel
        open={showMissingInfoPanel}
        onOpenChange={setShowMissingInfoPanel}
        missingInfo={aiSummary.missing_info}
        onSubmit={handleMissingInfoSubmit}
        isSubmitting={isRegeneratingWithAnswers}
      />
      
      {/* Email Sync Dialog */}
      <EmailSyncDialog
        open={emailSyncDialogOpen}
        onOpenChange={setEmailSyncDialogOpen}
        contactUuid={linkedContactUuid}
        oldEmail={originalEmail}
        newEmail={pendingEmail}
        onSyncConfirmed={() => {
          // Email was synced across all records, update local state
          setOriginalEmail(pendingEmail);
        }}
        onUpdateLocalOnly={() => {
          // Just update the original email tracker (local change only)
          setOriginalEmail(pendingEmail);
        }}
      />
    </>
  );
}
