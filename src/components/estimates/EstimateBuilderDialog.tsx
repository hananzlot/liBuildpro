import { useState, useEffect, useCallback } from "react";
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
  ChevronDown, ChevronRight, FolderPlus, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { updateOpportunityValueFromEstimates } from "@/lib/estimateValueUtils";

import type { LinkedOpportunity } from "./EstimateSourceDialog";

interface EstimateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId?: string | null;
  onSuccess?: () => void;
  linkedOpportunity?: LinkedOpportunity | null;
  createOpportunityOnSave?: boolean;
}

interface LineItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost: number;
  markup_percent: number;
  line_total: number;
  is_taxable: boolean;
  sort_order: number;
}

interface Group {
  id: string;
  group_name: string;
  description: string;
  sort_order: number;
  items: LineItem[];
  isOpen: boolean;
}

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
  terms_and_conditions: string;
  work_scope_description: string;
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

export function EstimateBuilderDialog({ open, onOpenChange, estimateId, onSuccess, linkedOpportunity, createOpportunityOnSave = false }: EstimateBuilderDialogProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  
  // Handle clone mode (creating new estimate from declined one)
  const isCloneMode = estimateId?.startsWith("clone:");
  const sourceEstimateId = isCloneMode ? estimateId.replace("clone:", "") : estimateId;
  const isEditing = !!estimateId && !isCloneMode;

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
    terms_and_conditions: "",
    work_scope_description: "",
    show_details_to_customer: false,
    show_scope_to_customer: false,
    show_line_items_to_customer: false,
    salesperson_name: "",
  });

  const [groups, setGroups] = useState<Group[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentPhase[]>([]);
  const [isGeneratingScope, setIsGeneratingScope] = useState(false);
  const [activeTab, setActiveTab] = useState("customer");
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  
  // Linked opportunity tracking
  const [linkedOpportunityUuid, setLinkedOpportunityUuid] = useState<string | null>(null);
  const [linkedOpportunityGhlId, setLinkedOpportunityGhlId] = useState<string | null>(null);

  // Draft string values for money inputs so users can type decimals (e.g. "12.")
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [unitPriceDrafts, setUnitPriceDrafts] = useState<Record<string, string>>({});
  // Draft for final price input (auto-discount calculation)
  const [finalPriceDraft, setFinalPriceDraft] = useState<string>("");

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

  // Calculate totals including cost and profit
  const calculateTotals = useCallback(() => {
    const subtotal = groups.reduce((sum, group) => 
      sum + group.items.reduce((itemSum, item) => itemSum + item.line_total, 0), 0
    );
    
    const totalCost = groups.reduce((sum, group) => 
      sum + group.items.reduce((itemSum, item) => itemSum + (item.quantity * item.cost), 0), 0
    );
    
    const taxableAmount = groups.reduce((sum, group) => 
      sum + group.items.filter(item => item.is_taxable).reduce((itemSum, item) => itemSum + item.line_total, 0), 0
    );
    
    const taxAmount = (taxableAmount * formData.tax_rate) / 100;
    
    let discountAmount = 0;
    if (formData.discount_type === "percent") {
      discountAmount = (subtotal * formData.discount_value) / 100;
    } else {
      discountAmount = formData.discount_value;
    }
    
    const total = subtotal + taxAmount - discountAmount;
    // Deposit = min(total * percent, max_amount)
    const percentDeposit = (total * formData.deposit_percent) / 100;
    const depositAmount = Math.min(percentDeposit, formData.deposit_max_amount);
    const grossProfit = subtotal - totalCost;
    const marginPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    
    return { subtotal, totalCost, grossProfit, marginPercent, taxAmount, discountAmount, total, depositAmount };
  }, [groups, formData.tax_rate, formData.discount_type, formData.discount_value, formData.deposit_percent, formData.deposit_max_amount]);

  const totals = calculateTotals();

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
  });

  // Fetch default deposit settings and expiration days from company settings
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
  });

  // Fetch existing estimate if editing or cloning
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
  });

  // Populate form when editing
  useEffect(() => {
    if (existingEstimate?.estimate) {
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
        terms_and_conditions: est.terms_and_conditions || "",
        work_scope_description: est.work_scope_description || "",
        show_details_to_customer: est.show_details_to_customer ?? false,
        show_scope_to_customer: est.show_scope_to_customer ?? false,
        show_line_items_to_customer: est.show_line_items_to_customer ?? false,
        salesperson_name: est.salesperson_name || "",
      });

      // Populate groups with items
      const groupsWithItems = existingEstimate.groups.map((g: any) => ({
        ...g,
        isOpen: true,
        items: existingEstimate.items
          .filter((i: any) => i.group_id === g.id)
          .map((i: any) => ({ ...i })),
      }));
      setGroups(groupsWithItems);
      
      // Populate payment schedule
      setPaymentSchedule(existingEstimate.schedule.map((s: any) => ({ ...s })));

      // Set linked project
      setLinkedProjectId(est.project_id || null);
    }
  }, [existingEstimate]);

  // Reset form when dialog opens for new estimate
  useEffect(() => {
    if (open && !estimateId) {
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
        terms_and_conditions: "",
        work_scope_description: "",
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
    }
  }, [open, estimateId]);

  // Auto-populate from linked opportunity when provided
  useEffect(() => {
    if (open && linkedOpportunity && !estimateId) {
      // Set opportunity tracking
      setLinkedOpportunityUuid(linkedOpportunity.id);
      setLinkedOpportunityGhlId(linkedOpportunity.ghl_id);
      
      // Auto-fill form data from opportunity
      setFormData(prev => ({
        ...prev,
        customer_name: linkedOpportunity.contact_name || prev.customer_name,
        customer_email: linkedOpportunity.contact_email || prev.customer_email,
        customer_phone: linkedOpportunity.contact_phone || prev.customer_phone,
        job_address: linkedOpportunity.address || prev.job_address,
        work_scope_description: linkedOpportunity.scope_of_work || prev.work_scope_description,
        estimate_title: linkedOpportunity.name || prev.estimate_title,
      }));
    }
  }, [open, linkedOpportunity, estimateId]);

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

  // AI Scope Generation
  const generateScope = async () => {
    if (!formData.job_address?.trim()) {
      toast.error("Please enter the job site address first (required for accurate pricing)");
      return;
    }
    if (!formData.work_scope_description?.trim()) {
      toast.error("Please describe the work scope with measurements before generating");
      setActiveTab("scope");
      return;
    }

    setIsGeneratingScope(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-estimate-scope", {
        body: {
          projectType: formData.estimate_title,
          projectDescription: formData.notes,
          workScopeDescription: formData.work_scope_description,
          jobAddress: formData.job_address,
          existingGroups: groups.map(g => g.group_name),
          defaultMarkupPercent: formData.default_markup_percent,
          companyId: companyId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const scope = data.scope;
      
      // Add generated groups and items - always use the form's default markup, ignoring AI recommendations
      const newGroups: Group[] = scope.groups.map((g: any, gIdx: number) => ({
        id: generateId(),
        group_name: g.group_name,
        description: g.description || "",
        sort_order: groups.length + gIdx,
        isOpen: true,
        items: g.items.map((item: any, iIdx: number) => {
          const itemCost = item.cost || 0;
          // Always use the form's default markup, ignore AI markup suggestions
          const itemMarkup = formData.default_markup_percent;
          const itemUnitPrice = itemCost * (1 + itemMarkup / 100);
          const itemQuantity = item.quantity || 1;
          
          return {
            id: generateId(),
            item_type: item.item_type || "material",
            description: item.description,
            quantity: itemQuantity,
            unit: item.unit || "each",
            cost: itemCost,
            markup_percent: itemMarkup,
            unit_price: itemUnitPrice,
            line_total: itemQuantity * itemUnitPrice,
            is_taxable: item.is_taxable !== false,
            sort_order: iIdx,
          };
        }),
      }));

      setGroups(prev => [...prev, ...newGroups]);

      // Build payment schedule: always start with deposit, then add AI phases
      const depositPhase: PaymentPhase = {
        id: generateId(),
        phase_name: "Deposit",
        percent: 0, // Will be calculated based on min(percent, max) logic
        amount: 0,
        due_type: "on_approval",
        due_date: null,
        description: "Due upon contract signing",
        sort_order: 0,
      };
      
      // Filter out any "Deposit" phases from AI and add remaining phases
      const aiPhases: PaymentPhase[] = (scope.payment_schedule || [])
        .filter((p: any) => p.phase_name?.toLowerCase() !== 'deposit')
        .map((p: any, idx: number) => ({
          id: generateId(),
          phase_name: p.phase_name || (idx === 0 ? 'Site Prep' : `Phase ${idx + 1}`),
          percent: p.percent || 0,
          amount: 0,
          due_type: p.due_type || "milestone",
          due_date: null,
          description: p.description || "",
          sort_order: idx + 1,
        }));
      
      setPaymentSchedule([depositPhase, ...aiPhases]);

      // Update tax rate if suggested (but NOT deposit - keep company defaults)
      if (scope.suggested_tax_rate) {
        setFormData(prev => ({ ...prev, tax_rate: scope.suggested_tax_rate }));
      }
      // Note: We no longer override deposit_percent from AI - company settings take precedence
      if (scope.notes) {
        setFormData(prev => ({ ...prev, notes: prev.notes ? `${prev.notes}\n\n${scope.notes}` : scope.notes }));
      }

      toast.success("AI generated scope added successfully!");
      setActiveTab("scope");
    } catch (error) {
      console.error("Error generating scope:", error);
      toast.error("Failed to generate scope. Please try again.");
    } finally {
      setIsGeneratingScope(false);
    }
  };

  // Group management
  const addGroup = () => {
    const newGroup: Group = {
      id: generateId(),
      group_name: "New Area",
      description: "",
      sort_order: groups.length,
      isOpen: true,
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
      markup_percent: formData.default_markup_percent,
      unit_price: 0,
      line_total: 0,
      is_taxable: true,
      sort_order: groups.find(g => g.id === groupId)?.items.length || 0,
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
          
          // If cost or markup changed, recalculate unit_price
          if ('cost' in updates || 'markup_percent' in updates) {
            updated.unit_price = updated.cost * (1 + updated.markup_percent / 100);
          }
          
          // If unit_price was directly edited, back-calculate markup (optional behavior)
          // For now, just allow direct price edits
          
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
      phase_name: "New Phase",
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
    
    // Validate payment phases total equals estimate total
    if (paymentSchedule.length > 0) {
      const { total, depositAmount } = calculateTotals();
      // Calculate phases total same way as the visual indicator
      const phasesTotal = paymentSchedule.reduce((sum, phase) => {
        if (phase.phase_name === "Deposit") {
          return sum + depositAmount;
        }
        return sum + ((Math.max(0, total - depositAmount) * (phase.percent || 0)) / 100);
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
    mutationFn: async () => {
      if (!validateEstimate()) {
        throw new Error("Validation failed");
      }

      const { subtotal, taxAmount, discountAmount, total, depositAmount } = calculateTotals();
      
      // When editing, preserve existing status; for new estimates use draft
      const currentStatus = isEditing && existingEstimate?.estimate?.status 
        ? existingEstimate.estimate.status 
        : "draft";
      
      // Prepare estimate data
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
        tax_rate: formData.tax_rate,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        notes: formData.notes || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        work_scope_description: formData.work_scope_description || null,
        created_by: user?.id || null,
        project_id: linkedProjectId || null,
        show_details_to_customer: formData.show_details_to_customer,
        show_scope_to_customer: formData.show_scope_to_customer,
        show_line_items_to_customer: formData.show_line_items_to_customer,
        salesperson_name: formData.salesperson_name || null,
        company_id: companyId,
        opportunity_uuid: linkedOpportunityUuid || null,
        opportunity_id: linkedOpportunityGhlId || null,
      };
      
      // Only set status for new estimates (not when editing)
      const insertData = isEditing ? estimateData : { ...estimateData, status: "draft" as const };

      let savedEstimateId = sourceEstimateId;

      if (isEditing && sourceEstimateId) {
        // Update existing estimate - scope by company_id for security
        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateData)
          .eq("id", sourceEstimateId)
          .eq("company_id", companyId);
        if (updateError) throw updateError;

        // Delete existing line items, groups, and schedule - scope by company_id
        // Must delete line items first since they reference groups
        await supabase.from("estimate_line_items").delete().eq("estimate_id", sourceEstimateId).eq("company_id", companyId);
        await supabase.from("estimate_groups").delete().eq("estimate_id", sourceEstimateId).eq("company_id", companyId);
        await supabase.from("estimate_payment_schedule").delete().eq("estimate_id", sourceEstimateId).eq("company_id", companyId);
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
      if (paymentSchedule.length > 0) {
        const remainingTotal = Math.max(0, total - depositAmount);
        const scheduleToInsert = paymentSchedule.map((phase) => {
          const isDepositPhase = phase.phase_name === "Deposit";
          return {
            estimate_id: savedEstimateId,
            phase_name: phase.phase_name,
            // Deposit is a fixed amount (capped by deposit_max_amount), so don't store it as a percent.
            percent: isDepositPhase ? 0 : phase.percent,
            amount: isDepositPhase ? depositAmount : (remainingTotal * (phase.percent || 0)) / 100,
            due_type: phase.due_type,
            due_date: phase.due_date || null,
            description: phase.description || null,
            sort_order: phase.sort_order,
            company_id: companyId,
          };
        });
        
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
              // Update estimate with the new opportunity ID
              await supabase
                .from("estimates")
                .update({
                  opportunity_id: createResult.opportunityId,
                })
                .eq("id", savedEstimateId);
              
              console.log("Created new opportunity and linked to estimate:", createResult.opportunityId);
            }
          } catch (err) {
            console.error("Failed to create opportunity:", err);
            // Don't fail the save for this
          }
        }
      }

      return savedEstimateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success(isEditing ? "Estimate updated successfully!" : "Estimate created successfully!");
      onOpenChange(false);
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
    mutationFn: async () => {
      if (!validateEstimate()) {
        throw new Error("Validation failed");
      }

      const { subtotal, taxAmount, discountAmount, total, depositAmount } = calculateTotals();
      
      // Prepare estimate data for a new estimate
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
        tax_rate: formData.tax_rate,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        notes: formData.notes || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        work_scope_description: formData.work_scope_description || null,
        status: "draft" as const,
        created_by: user?.id || null,
        show_details_to_customer: formData.show_details_to_customer,
        show_scope_to_customer: formData.show_scope_to_customer,
        show_line_items_to_customer: formData.show_line_items_to_customer,
        salesperson_name: formData.salesperson_name || null,
        company_id: companyId,
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
      if (paymentSchedule.length > 0) {
        const remainingTotal = Math.max(0, total - depositAmount);
        const scheduleToInsert = paymentSchedule.map((phase) => {
          const isDepositPhase = phase.phase_name === "Deposit";
          return {
            estimate_id: savedEstimateId,
            phase_name: phase.phase_name,
            percent: isDepositPhase ? 0 : phase.percent,
            amount: isDepositPhase ? depositAmount : (remainingTotal * (phase.percent || 0)) / 100,
            due_type: phase.due_type,
            due_date: phase.due_date || null,
            description: phase.description || null,
            sort_order: phase.sort_order,
            company_id: companyId,
          };
        });
        
        const { error: scheduleError } = await supabase
          .from("estimate_payment_schedule")
          .insert(scheduleToInsert);
        if (scheduleError) throw scheduleError;
      }

      return savedEstimateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
      toast.success("New estimate created from copy!");
      onOpenChange(false);
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

  if (loadingEstimate && isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {isEditing ? "Edit Estimate" : isCloneMode ? "New Estimate (from Declined)" : "New Estimate"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={generateScope}
                disabled={isGeneratingScope}
              >
                {isGeneratingScope ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                AI Generate Scope
              </Button>
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
                  Save As New
                </Button>
              )}
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Estimate
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="mx-6 mt-4 w-auto justify-start">
                <TabsTrigger value="customer" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer
                </TabsTrigger>
                <TabsTrigger value="scope" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Scope ({groups.reduce((sum, g) => sum + g.items.length, 0)} items)
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Payments
                </TabsTrigger>
                <TabsTrigger value="terms" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Terms & Notes
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6 py-4">
                <TabsContent value="customer" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="customer_name">Customer Name *</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          placeholder="John Smith"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_email">Email *</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_phone">Phone</Label>
                        <Input
                          id="customer_phone"
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estimate_title">Project Title *</Label>
                        <Input
                          id="estimate_title"
                          value={formData.estimate_title}
                          onChange={(e) => setFormData({ ...formData, estimate_title: e.target.value })}
                          placeholder="Kitchen Remodel"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="job_address">Job Site Address *</Label>
                        <Input
                          id="job_address"
                          value={formData.job_address}
                          onChange={(e) => setFormData({ ...formData, job_address: e.target.value })}
                          placeholder="123 Main St, Los Angeles, CA 90001"
                          required
                        />
                        <p className="text-xs text-muted-foreground">Include full address with city, state, and ZIP code for accurate pricing</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estimate_date">Estimate Date</Label>
                        <Input
                          id="estimate_date"
                          type="date"
                          value={formData.estimate_date}
                          onChange={(e) => setFormData({ ...formData, estimate_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expiration_date">Expiration Date</Label>
                        <Input
                          id="expiration_date"
                          type="date"
                          value={formData.expiration_date}
                          onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salesperson_name">Salesperson</Label>
                        <Select
                          value={formData.salesperson_name || "none"}
                          onValueChange={(value) => setFormData({ ...formData, salesperson_name: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select salesperson..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No salesperson assigned</SelectItem>
                            {salespeople.map((sp) => (
                              <SelectItem key={sp.id} value={sp.name}>
                                {sp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Link to Project */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Link to Project (Optional)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="linked_project">Project</Label>
                        <Select
                          value={linkedProjectId || "none"}
                          onValueChange={(value) => setLinkedProjectId(value === "none" ? null : value)}
                        >
                          <SelectTrigger>
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
                        <p className="text-xs text-muted-foreground">
                          Link this estimate to an existing project. Multiple proposals can be linked to the same project.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                </TabsContent>

                <TabsContent value="scope" className="mt-0 space-y-4">
                  {/* Work Scope Description - First item in Scope tab */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Work Scope Description
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Include measurements (sqft, linear ft, quantities) and specific materials. 
                        The AI uses this + job site ZIP code for location-based pricing.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Check if mandatory fields are filled for AI generation */}
                  {(() => {
                    const canGenerateAI = formData.customer_name?.trim() && formData.job_address?.trim() && formData.estimate_title?.trim();
                    const missingFields = [];
                    if (!formData.customer_name?.trim()) missingFields.push('Customer Name');
                    if (!formData.job_address?.trim()) missingFields.push('Job Address');
                    if (!formData.estimate_title?.trim()) missingFields.push('Project Title');
                    
                    return groups.length === 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Line Items</h3>
                        </div>
                        <Card>
                          <CardContent className="py-8 text-center">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-4">No scope items yet.</p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Button onClick={addGroup} variant="outline" size="sm">
                                <FolderPlus className="mr-2 h-4 w-4" />
                                Add Area
                              </Button>
                              <Button 
                                size="sm"
                                onClick={generateScope} 
                                disabled={isGeneratingScope || !canGenerateAI}
                                title={!canGenerateAI ? `Missing: ${missingFields.join(', ')}` : 'Generate scope with AI'}
                              >
                                {isGeneratingScope ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Wand2 className="mr-2 h-4 w-4" />
                                )}
                                Generate with AI
                              </Button>
                            </div>
                            {!canGenerateAI && (
                              <p className="text-xs text-amber-600 mt-3">
                                Fill in {missingFields.join(', ')} in Customer tab to enable AI generation
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <div className="space-y-4">
                        {/* Line Items header (left) + actions (center) */}
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <h3 className="font-semibold justify-self-start">Line Items</h3>

                          <div className="flex flex-wrap items-center justify-center gap-2 justify-self-center">
                            <Button onClick={addGroup} size="sm" variant="outline">
                              <FolderPlus className="mr-2 h-4 w-4" />
                              Add Area
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setGroups([]);
                                setPaymentSchedule([]);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Clear All
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setGroups([]);
                                setPaymentSchedule([]);
                                setTimeout(() => generateScope(), 100);
                              }}
                              disabled={isGeneratingScope || !canGenerateAI}
                              title={!canGenerateAI ? `Missing: ${missingFields.join(', ')}` : 'Clear and regenerate with AI'}
                            >
                              {isGeneratingScope ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="mr-2 h-4 w-4" />
                              )}
                              Regenerate AI
                            </Button>
                          </div>

                          <div aria-hidden="true" />
                        </div>
                      {groups.map((group) => (
                        <Card key={group.id}>
                          <Collapsible open={group.isOpen} onOpenChange={() => toggleGroup(group.id)}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary">
                                  {group.isOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Input
                                    value={group.group_name}
                                    onChange={(e) => updateGroup(group.id, { group_name: e.target.value })}
                                    className="font-semibold border-0 p-0 h-auto focus-visible:ring-0 w-48"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Badge variant="secondary" className="ml-2">
                                    {group.items.length} items
                                  </Badge>
                                  <Badge variant="outline" className="ml-1">
                                    {formatCurrency(group.items.reduce((sum, i) => sum + i.line_total, 0))}
                                  </Badge>
                                </CollapsibleTrigger>
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
                                    {/* Header row - Wider layout with better readability */}
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                                      <div className="w-24">Type</div>
                                      <div className="flex-1 min-w-[180px]">Description</div>
                                      <div className="w-20">Qty</div>
                                      <div className="w-20">Unit</div>
                                      <div className="w-24">Cost</div>
                                      <div className="w-20">Markup %</div>
                                      <div className="w-28">Price</div>
                                      <div className="w-28">Total</div>
                                      <div className="w-8"></div>
                                    </div>
                                    {group.items.map((item) => (
                                      <div key={item.id} className="flex items-start gap-2">
                                        <Select
                                          value={item.item_type}
                                          onValueChange={(v) => updateLineItem(group.id, item.id, { item_type: v })}
                                        >
                                          <SelectTrigger className="w-24 h-8 text-xs mt-1">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {itemTypes.map((t) => (
                                              <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Textarea
                                          value={item.description}
                                          onChange={(e) => updateLineItem(group.id, item.id, { description: e.target.value })}
                                          className="flex-1 min-w-[180px] min-h-[32px] text-sm resize-none overflow-hidden py-1.5"
                                          placeholder="Item description"
                                          rows={1}
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
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateLineItem(group.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-20 h-8 text-sm"
                                          />
                                          <Select
                                            value={item.unit}
                                            onValueChange={(v) => updateLineItem(group.id, item.id, { unit: v })}
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
                                          {/* Cost field - 2 decimal display */}
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={costDrafts[item.id] ?? formatMoney(item.cost)}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/,/g, ".");
                                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                                setCostDrafts((prev) => ({ ...prev, [item.id]: val }));

                                                // Only commit to numeric state when it's a valid number (not a trailing dot)
                                                if (val !== "" && val !== "." && !val.endsWith(".")) {
                                                  updateLineItem(group.id, item.id, { cost: Number(val) });
                                                  // Cost changes recalc unit price; drop any manual price draft
                                                  setUnitPriceDrafts((prev) => {
                                                    if (!(item.id in prev)) return prev;
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                  });
                                                }
                                              }
                                            }}
                                            onBlur={() => {
                                              const draft = costDrafts[item.id];
                                              if (draft === undefined) return;

                                              const normalized = draft === "" || draft === "." ? 0 : Number(draft);
                                              updateLineItem(group.id, item.id, { cost: normalized });

                                              setCostDrafts((prev) => ({ ...prev, [item.id]: formatMoney(normalized) }));
                                              setUnitPriceDrafts((prev) => {
                                                if (!(item.id in prev)) return prev;
                                                const next = { ...prev };
                                                delete next[item.id];
                                                return next;
                                              });
                                            }}
                                            className="w-24 h-8 text-sm"
                                            placeholder="0.00"
                                          />
                                          {/* Markup % field - aligned */}
                                          <Input
                                            type="number"
                                            value={item.markup_percent}
                                            onChange={(e) => {
                                              updateLineItem(group.id, item.id, {
                                                markup_percent: parseFloat(e.target.value) || 0,
                                              });
                                              // Markup changes recalc unit price; drop any manual price draft
                                              setUnitPriceDrafts((prev) => {
                                                if (!(item.id in prev)) return prev;
                                                const next = { ...prev };
                                                delete next[item.id];
                                                return next;
                                              });
                                            }}
                                            className="w-20 h-8 text-sm"
                                            step="1"
                                            placeholder="35"
                                          />
                                          {/* Price field - 2 decimal display */}
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
                                            className="w-28 h-8 text-sm"
                                          />
                                          <div className="w-28 text-sm font-medium text-right">
                                            {formatCurrency(item.line_total)}
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteLineItem(group.id, item.id)}
                                            className="w-8 h-8 p-0 text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
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
                    </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="payments" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
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

                        {/* Tax Rate */}
                        <div className="border rounded p-2 bg-background min-w-0">
                          <Label htmlFor="tax_rate" className="text-[10px] text-muted-foreground mb-0.5 block">Tax</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              id="tax_rate"
                              type="text"
                              inputMode="decimal"
                              value={formData.tax_rate}
                              onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                              className="w-12 h-7 text-sm"
                              placeholder="9.5"
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
                                  setFormData({ ...formData, deposit_percent: parseFloat(val) || 0 });
                                }
                              }}
                              disabled={!formData.deposit_required}
                              className="w-16 h-7 text-sm"
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
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
                              className="w-16 h-7 text-sm"
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
                          <div className="flex items-center gap-1">
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
                                const finalPrice = parseFloat(finalPriceDraft);
                                if (!isNaN(finalPrice) && finalPrice >= 0) {
                                  const preTaxTotal = totals.subtotal + totals.taxAmount;
                                  
                                  if (finalPrice > preTaxTotal) {
                                    const bufferAmount = 1200;
                                    
                                    if (totals.subtotal > 0 && totals.totalCost > 0) {
                                      const targetPreDiscountTotal = finalPrice + bufferAmount;
                                      const currentPreDiscountTotal = totals.subtotal + totals.taxAmount;
                                      const scaleFactor = targetPreDiscountTotal / currentPreDiscountTotal;
                                      const newMarkupPercent = ((totals.subtotal * scaleFactor / totals.totalCost) - 1) * 100;
                                      
                                      let newSubtotal = 0;
                                      let newTaxableAmount = 0;
                                      groups.forEach(g => {
                                        g.items.forEach(item => {
                                          const newUnitPrice = Math.round(item.cost * (1 + newMarkupPercent / 100) * 100) / 100;
                                          const newLineTotal = Math.round(item.quantity * newUnitPrice * 100) / 100;
                                          newSubtotal += newLineTotal;
                                          if (item.is_taxable) {
                                            newTaxableAmount += newLineTotal;
                                          }
                                        });
                                      });
                                      const newTaxAmount = (newTaxableAmount * formData.tax_rate) / 100;
                                      const newPreDiscountTotal = newSubtotal + newTaxAmount;
                                      const requiredDiscount = Math.round((newPreDiscountTotal - finalPrice) * 100) / 100;
                                      
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
                                    const newDiscount = Math.max(0, preTaxTotal - finalPrice);
                                    setFormData({ 
                                      ...formData, 
                                      discount_type: 'fixed',
                                      discount_value: Math.round(newDiscount * 100) / 100 
                                    });
                                  }
                                }
                                setFinalPriceDraft('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-20 h-7 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Payment Schedule</CardTitle>
                      <Button onClick={addPaymentPhase} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Phase
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {paymentSchedule.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No payment phases defined. Add phases or use AI to generate.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {paymentSchedule.map((phase) => (
                            <div key={phase.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <Input
                                value={phase.phase_name}
                                onChange={(e) => updatePaymentPhase(phase.id, { phase_name: e.target.value })}
                                className="w-40"
                                placeholder="Phase name"
                              />
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={phase.phase_name === "Deposit" ? 0 : phase.percent}
                                  disabled={phase.phase_name === "Deposit"}
                                  onChange={(e) => updatePaymentPhase(phase.id, { percent: parseFloat(e.target.value) || 0 })}
                                  className="w-20"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                = {formatCurrency(
                                  phase.phase_name === "Deposit"
                                    ? totals.depositAmount
                                    : (Math.max(0, totals.total - totals.depositAmount) * (phase.percent || 0)) / 100
                                )}
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
                              <Input
                                value={phase.description}
                                onChange={(e) => updatePaymentPhase(phase.id, { description: e.target.value })}
                                className="flex-1"
                                placeholder="Description"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePaymentPhase(phase.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {/* Payment phases total vs estimate total indicator */}
                          {(() => {
                            const phasesTotal = paymentSchedule.reduce((sum, phase) => {
                              if (phase.phase_name === "Deposit") {
                                return sum + totals.depositAmount;
                              }
                              return sum + ((Math.max(0, totals.total - totals.depositAmount) * (phase.percent || 0)) / 100);
                            }, 0);
                            const difference = Math.round((phasesTotal - totals.total) * 100) / 100;
                            const isBalanced = Math.abs(difference) < 0.01;
                            const percentTotal = paymentSchedule.reduce((sum, p) => sum + p.percent, 0);
                            
                            // Find the last non-deposit phase for auto-balance
                            const nonDepositPhases = paymentSchedule.filter(p => p.phase_name !== "Deposit");
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

                <TabsContent value="terms" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Customer View Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Show SalesRep Scope Description</Label>
                          <p className="text-sm text-muted-foreground">
                            Show the scope of work text description from the Scope tab
                          </p>
                        </div>
                        <Switch
                          checked={formData.show_scope_to_customer}
                          onCheckedChange={(checked) => setFormData({ ...formData, show_scope_to_customer: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="space-y-0.5">
                          <Label>Show AI Generated Line Items</Label>
                          <p className="text-sm text-muted-foreground">
                            Show the itemized scope breakdown (titles only)
                          </p>
                        </div>
                        <Switch
                          checked={formData.show_line_items_to_customer}
                          onCheckedChange={(checked) => setFormData({ ...formData, show_line_items_to_customer: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="space-y-0.5">
                          <Label>Show AI Driven Line Item Details</Label>
                          <p className="text-sm text-muted-foreground">
                            Show quantity, unit, and unit price for each line item
                          </p>
                        </div>
                        <Switch
                          checked={formData.show_details_to_customer}
                          onCheckedChange={(checked) => setFormData({ ...formData, show_details_to_customer: checked })}
                          disabled={!formData.show_line_items_to_customer}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Add any notes about this estimate..."
                        rows={4}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Terms & Conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={formData.terms_and_conditions}
                        onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                        placeholder="Enter terms and conditions..."
                        rows={6}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Sidebar - Totals with Profit Metrics */}
          <div className="w-80 border-l bg-muted/30 p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4">Estimate Summary</h3>
            
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
              
              {formData.tax_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({formData.tax_rate}%)</span>
                  <span>{formatCurrency(totals.taxAmount)}</span>
                </div>
              )}
              
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
                <div className="space-y-1 text-sm">
                  {groups.map((group) => (
                    <div key={group.id} className="flex justify-between">
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {group.group_name}
                      </span>
                      <span>
                        {formatCurrency(group.items.reduce((sum, i) => sum + i.line_total, 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
