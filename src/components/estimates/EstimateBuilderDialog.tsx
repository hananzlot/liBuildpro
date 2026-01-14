import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  ChevronDown, ChevronRight, FolderPlus
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EstimateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId?: string | null;
  onSuccess?: () => void;
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
  tax_rate: number;
  discount_type: string;
  discount_value: number;
  notes: string;
  terms_and_conditions: string;
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

export function EstimateBuilderDialog({ open, onOpenChange, estimateId, onSuccess }: EstimateBuilderDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!estimateId;

  // Form state
  const [formData, setFormData] = useState<EstimateFormData>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    job_address: "",
    billing_address: "",
    estimate_title: "",
    estimate_date: new Date().toISOString().split("T")[0],
    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    deposit_required: true,
    deposit_percent: 30,
    tax_rate: 9.5,
    discount_type: "percent",
    discount_value: 0,
    notes: "",
    terms_and_conditions: "",
  });

  const [groups, setGroups] = useState<Group[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentPhase[]>([]);
  const [isGeneratingScope, setIsGeneratingScope] = useState(false);
  const [activeTab, setActiveTab] = useState("customer");

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const subtotal = groups.reduce((sum, group) => 
      sum + group.items.reduce((itemSum, item) => itemSum + item.line_total, 0), 0
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
    const depositAmount = (total * formData.deposit_percent) / 100;
    
    return { subtotal, taxAmount, discountAmount, total, depositAmount };
  }, [groups, formData.tax_rate, formData.discount_type, formData.discount_value, formData.deposit_percent]);

  const totals = calculateTotals();

  // Fetch existing estimate if editing
  const { data: existingEstimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["estimate-edit", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      
      const [estimateRes, groupsRes, itemsRes, scheduleRes] = await Promise.all([
        supabase.from("estimates").select("*").eq("id", estimateId).single(),
        supabase.from("estimate_groups").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_line_items").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_payment_schedule").select("*").eq("estimate_id", estimateId).order("sort_order"),
      ]);
      
      return {
        estimate: estimateRes.data,
        groups: groupsRes.data || [],
        items: itemsRes.data || [],
        schedule: scheduleRes.data || [],
      };
    },
    enabled: !!estimateId && open,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingEstimate?.estimate) {
      const est = existingEstimate.estimate;
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
        deposit_percent: est.deposit_percent || 30,
        tax_rate: est.tax_rate || 9.5,
        discount_type: est.discount_type || "percent",
        discount_value: est.discount_value || 0,
        notes: est.notes || "",
        terms_and_conditions: est.terms_and_conditions || "",
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
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        deposit_required: true,
        deposit_percent: 30,
        tax_rate: 9.5,
        discount_type: "percent",
        discount_value: 0,
        notes: "",
        terms_and_conditions: "",
      });
      setGroups([]);
      setPaymentSchedule([]);
      setActiveTab("customer");
    }
  }, [open, estimateId]);

  // AI Scope Generation
  const generateScope = async () => {
    if (!formData.estimate_title && !formData.job_address) {
      toast.error("Please enter a project title or address first");
      return;
    }

    setIsGeneratingScope(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-estimate-scope", {
        body: {
          projectType: formData.estimate_title,
          projectDescription: formData.notes,
          jobAddress: formData.job_address,
          existingGroups: groups.map(g => g.group_name),
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const scope = data.scope;
      
      // Add generated groups and items
      const newGroups: Group[] = scope.groups.map((g: any, gIdx: number) => ({
        id: generateId(),
        group_name: g.group_name,
        description: g.description || "",
        sort_order: groups.length + gIdx,
        isOpen: true,
        items: g.items.map((item: any, iIdx: number) => ({
          id: generateId(),
          item_type: item.item_type || "material",
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit || "each",
          unit_price: item.unit_price || 0,
          cost: item.cost || 0,
          markup_percent: item.markup_percent || 0,
          line_total: (item.quantity || 1) * (item.unit_price || 0),
          is_taxable: item.is_taxable !== false,
          sort_order: iIdx,
        })),
      }));

      setGroups(prev => [...prev, ...newGroups]);

      // Add payment schedule if provided
      if (scope.payment_schedule?.length > 0) {
        const newSchedule: PaymentPhase[] = scope.payment_schedule.map((p: any, idx: number) => ({
          id: generateId(),
          phase_name: p.phase_name,
          percent: p.percent || 0,
          amount: 0,
          due_type: p.due_type || "milestone",
          due_date: null,
          description: p.description || "",
          sort_order: idx,
        }));
        setPaymentSchedule(newSchedule);
      }

      // Update tax rate and deposit if suggested
      if (scope.suggested_tax_rate) {
        setFormData(prev => ({ ...prev, tax_rate: scope.suggested_tax_rate }));
      }
      if (scope.suggested_deposit_percent) {
        setFormData(prev => ({ ...prev, deposit_percent: scope.suggested_deposit_percent }));
      }
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

  // Line item management
  const addLineItem = (groupId: string) => {
    const newItem: LineItem = {
      id: generateId(),
      item_type: "material",
      description: "",
      quantity: 1,
      unit: "each",
      unit_price: 0,
      cost: 0,
      markup_percent: 0,
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
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { subtotal, taxAmount, discountAmount, total } = calculateTotals();
      
      // Prepare estimate data
      const estimateData = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        job_address: formData.job_address || null,
        billing_address: formData.billing_address || null,
        estimate_title: formData.estimate_title,
        estimate_date: formData.estimate_date,
        expiration_date: formData.expiration_date || null,
        deposit_required: formData.deposit_required,
        deposit_percent: formData.deposit_percent,
        tax_rate: formData.tax_rate,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        notes: formData.notes || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        status: "draft" as const,
        created_by: user?.id || null,
      };

      let savedEstimateId = estimateId;

      if (isEditing && estimateId) {
        // Update existing estimate
        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateData)
          .eq("id", estimateId);
        if (updateError) throw updateError;

        // Delete existing groups, items, and schedule (cascade will handle items)
        await supabase.from("estimate_groups").delete().eq("estimate_id", estimateId);
        await supabase.from("estimate_payment_schedule").delete().eq("estimate_id", estimateId);
      } else {
        // Create new estimate
        const { data: newEstimate, error: insertError } = await supabase
          .from("estimates")
          .insert(estimateData)
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
          }));
          
          const { error: itemsError } = await supabase
            .from("estimate_line_items")
            .insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      // Insert payment schedule
      if (paymentSchedule.length > 0) {
        const scheduleToInsert = paymentSchedule.map(phase => ({
          estimate_id: savedEstimateId,
          phase_name: phase.phase_name,
          percent: phase.percent,
          amount: (total * phase.percent) / 100,
          due_type: phase.due_type,
          due_date: phase.due_date || null,
          description: phase.description || null,
          sort_order: phase.sort_order,
        }));
        
        const { error: scheduleError } = await supabase
          .from("estimate_payment_schedule")
          .insert(scheduleToInsert);
        if (scheduleError) throw scheduleError;
      }

      return savedEstimateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success(isEditing ? "Estimate updated successfully!" : "Estimate created successfully!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error saving estimate:", error);
      toast.error("Failed to save estimate. Please try again.");
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
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
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {isEditing ? "Edit Estimate" : "New Estimate"}
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
                        <Label htmlFor="customer_email">Email</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          placeholder="john@example.com"
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
                        <Label htmlFor="job_address">Job Site Address</Label>
                        <Input
                          id="job_address"
                          value={formData.job_address}
                          onChange={(e) => setFormData({ ...formData, job_address: e.target.value })}
                          placeholder="123 Main St, Los Angeles, CA 90001"
                        />
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
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="scope" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Work Scope</h3>
                    <Button onClick={addGroup} size="sm">
                      <FolderPlus className="mr-2 h-4 w-4" />
                      Add Area
                    </Button>
                  </div>

                  {groups.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No scope items yet.</p>
                        <div className="flex items-center justify-center gap-2">
                          <Button onClick={addGroup} variant="outline">
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Add Area Manually
                          </Button>
                          <Button onClick={generateScope} disabled={isGeneratingScope}>
                            {isGeneratingScope ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="mr-2 h-4 w-4" />
                            )}
                            Generate with AI
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
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
                                    {/* Header row */}
                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                                      <div className="col-span-1">Type</div>
                                      <div className="col-span-4">Description</div>
                                      <div className="col-span-1">Qty</div>
                                      <div className="col-span-1">Unit</div>
                                      <div className="col-span-2">Price</div>
                                      <div className="col-span-2">Total</div>
                                      <div className="col-span-1"></div>
                                    </div>
                                    {group.items.map((item) => (
                                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                        <Select
                                          value={item.item_type}
                                          onValueChange={(v) => updateLineItem(group.id, item.id, { item_type: v })}
                                        >
                                          <SelectTrigger className="col-span-1 h-8 text-xs">
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
                                        <Input
                                          value={item.description}
                                          onChange={(e) => updateLineItem(group.id, item.id, { description: e.target.value })}
                                          className="col-span-4 h-8 text-sm"
                                          placeholder="Item description"
                                        />
                                        <Input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) => updateLineItem(group.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                          className="col-span-1 h-8 text-sm"
                                        />
                                        <Select
                                          value={item.unit}
                                          onValueChange={(v) => updateLineItem(group.id, item.id, { unit: v })}
                                        >
                                          <SelectTrigger className="col-span-1 h-8 text-xs">
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
                                        <Input
                                          type="number"
                                          value={item.unit_price}
                                          onChange={(e) => updateLineItem(group.id, item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                          className="col-span-2 h-8 text-sm"
                                          step="0.01"
                                        />
                                        <div className="col-span-2 text-sm font-medium">
                                          {formatCurrency(item.line_total)}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteLineItem(group.id, item.id)}
                                          className="col-span-1 h-8 w-8 p-0 text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
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
                  )}
                </TabsContent>

                <TabsContent value="payments" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Deposit & Tax Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-4">
                        <Switch
                          id="deposit_required"
                          checked={formData.deposit_required}
                          onCheckedChange={(v) => setFormData({ ...formData, deposit_required: v })}
                        />
                        <Label htmlFor="deposit_required">Deposit Required</Label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deposit_percent">Deposit %</Label>
                        <Input
                          id="deposit_percent"
                          type="number"
                          value={formData.deposit_percent}
                          onChange={(e) => setFormData({ ...formData, deposit_percent: parseFloat(e.target.value) || 0 })}
                          disabled={!formData.deposit_required}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_rate">Tax Rate %</Label>
                        <Input
                          id="tax_rate"
                          type="number"
                          value={formData.tax_rate}
                          onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                          step="0.01"
                        />
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
                                  value={phase.percent}
                                  onChange={(e) => updatePaymentPhase(phase.id, { percent: parseFloat(e.target.value) || 0 })}
                                  className="w-20"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                = {formatCurrency((totals.total * phase.percent) / 100)}
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
                          <div className="text-right text-sm">
                            Total: {paymentSchedule.reduce((sum, p) => sum + p.percent, 0)}%
                            {paymentSchedule.reduce((sum, p) => sum + p.percent, 0) !== 100 && (
                              <span className="text-amber-500 ml-2">(should equal 100%)</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Discount</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                      <Select
                        value={formData.discount_type}
                        onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={formData.discount_value}
                        onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">
                        {formData.discount_type === "percent" ? "%" : "$"}
                      </span>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="terms" className="mt-0 space-y-4">
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

          {/* Right Sidebar - Totals */}
          <div className="w-72 border-l bg-muted/30 p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4">Estimate Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
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
                  <span>Deposit ({formData.deposit_percent}%)</span>
                  <span className="font-medium">{formatCurrency(totals.depositAmount)}</span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2 text-sm">
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
