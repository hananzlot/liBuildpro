import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  FileText,
  Eye,
  Send,
  MapPin,
  User,
  DollarSign,
  CheckCircle,
  Pencil,
  Tag,
  LayoutList,
} from "lucide-react";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { SendProposalDialog } from "@/components/estimates/SendProposalDialog";

interface PortalEstimateDetailSheetProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface LineItem {
  id: string;
  group_id: string | null;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

interface Group {
  id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
}

interface EditedItem {
  description?: string;
  quantity?: number;
  unit_price?: number;
}

interface EditedCustomerInfo {
  customer_email?: string;
  job_address?: string;
  estimate_title?: string;
}

export function PortalEstimateDetailSheet({
  estimateId,
  open,
  onOpenChange,
  companyId,
}: PortalEstimateDetailSheetProps) {
  const queryClient = useQueryClient();
  const [editedItems, setEditedItems] = useState<Record<string, EditedItem>>({});
  const [editedCustomerInfo, setEditedCustomerInfo] = useState<EditedCustomerInfo>({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewBeforeSend, setPreviewBeforeSend] = useState(false);

  // Discount state
  const [discountType, setDiscountType] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<number | null>(null);

  // Visibility toggles state (null = not changed by user yet)
  const [showDetails, setShowDetails] = useState<boolean | null>(null);
  const [showScope, setShowScope] = useState<boolean | null>(null);
  const [showLineItems, setShowLineItems] = useState<boolean | null>(null);

  // Fetch estimate details
  const { data: estimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["portal-estimate-detail", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!estimateId && open,
  });

  // Fetch line items
  const { data: lineItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["portal-estimate-items", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!estimateId && open,
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ["portal-estimate-groups", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_groups")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!estimateId && open,
  });

  const handleItemChange = (
    itemId: string,
    field: keyof EditedItem,
    value: string | number
  ) => {
    setEditedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const getItemValue = (item: LineItem, field: keyof EditedItem) => {
    const edited = editedItems[item.id];
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    return item[field];
  };

  const calculateLineTotal = (item: LineItem) => {
    const qty = Number(getItemValue(item, "quantity")) || 0;
    const price = Number(getItemValue(item, "unit_price")) || 0;
    return qty * price;
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const hasItemChanges = Object.keys(editedItems).length > 0;
  const hasCustomerChanges = Object.keys(editedCustomerInfo).length > 0;
  const hasDiscountChanges = discountType !== null || discountValue !== null;
  const hasVisibilityChanges = showDetails !== null || showScope !== null || showLineItems !== null;
  const hasChanges = hasItemChanges || hasCustomerChanges || hasDiscountChanges || hasVisibilityChanges;

  const handleSave = async () => {
    if (!hasChanges || !estimateId) return;

    setIsSaving(true);
    try {
      // Update each edited line item
      const updates = Object.entries(editedItems).map(async ([itemId, changes]) => {
        const item = lineItems.find((i) => i.id === itemId);
        if (!item) return;

        const qty = changes.quantity !== undefined ? changes.quantity : item.quantity;
        const price = changes.unit_price !== undefined ? changes.unit_price : item.unit_price;
        const lineTotal = Number(qty) * Number(price);

        const { error } = await supabase
          .from("estimate_line_items")
          .update({
            description: changes.description ?? item.description,
            quantity: qty,
            unit_price: price,
            line_total: lineTotal,
          })
          .eq("id", itemId);

        if (error) throw error;
      });

      await Promise.all(updates);

      // Build the estimate update object
      const estimateUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Compute discount amount
      const effectiveDiscountType = discountType ?? estimate?.discount_type ?? "percent";
      const effectiveDiscountValue = discountValue ?? estimate?.discount_value ?? 0;
      const subtotalForDiscount = hasItemChanges ? calculateTotal() : (estimate?.subtotal ?? 0);
      let discountAmount = 0;
      if (effectiveDiscountType === "percent") {
        discountAmount = Math.round((subtotalForDiscount * effectiveDiscountValue) / 100 * 100) / 100;
      } else {
        discountAmount = Number(effectiveDiscountValue);
      }

      // Add recalculated total if line items or discount changed
      if (hasItemChanges || hasDiscountChanges) {
        const rawSubtotal = hasItemChanges ? calculateTotal() : (estimate?.subtotal ?? 0);
        estimateUpdate.subtotal = rawSubtotal;
        estimateUpdate.discount_type = effectiveDiscountType;
        estimateUpdate.discount_value = effectiveDiscountValue;
        estimateUpdate.discount_amount = discountAmount;
        estimateUpdate.total = Math.max(0, rawSubtotal - discountAmount);
      }

      // Add customer info changes
      if (editedCustomerInfo.customer_email !== undefined) {
        estimateUpdate.customer_email = editedCustomerInfo.customer_email;
      }
      if (editedCustomerInfo.job_address !== undefined) {
        estimateUpdate.job_address = editedCustomerInfo.job_address;
      }
      if (editedCustomerInfo.estimate_title !== undefined) {
        estimateUpdate.estimate_title = editedCustomerInfo.estimate_title;
      }

      // Add visibility changes
      if (showDetails !== null) estimateUpdate.show_details_to_customer = showDetails;
      if (showScope !== null) estimateUpdate.show_scope_to_customer = showScope;
      if (showLineItems !== null) estimateUpdate.show_line_items_to_customer = showLineItems;

      const { error: updateError } = await supabase
        .from("estimates")
        .update(estimateUpdate)
        .eq("id", estimateId);

      if (updateError) throw updateError;

      setEditedItems({});
      setEditedCustomerInfo({});
      setDiscountType(null);
      setDiscountValue(null);
      setShowDetails(null);
      setShowScope(null);
      setShowLineItems(null);
      toast.success("Estimate saved successfully!");
      // Invalidate portal queries
      queryClient.invalidateQueries({ queryKey: ["portal-estimate-detail", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["portal-estimate-items", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["portal-my-estimates"] });
      // Also invalidate main app estimate queries so totals refresh there too
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimate-detail", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimate-line-items", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["company-estimates"] });
    } catch (error) {
      console.error("Error saving estimate:", error);
      toast.error("Failed to save estimate");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-700">Sent</Badge>;
      case "signed":
      case "accepted":
        return <Badge className="bg-emerald-100 text-emerald-700">Signed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const groupedItems = groups.map((group) => ({
    ...group,
    items: lineItems.filter((item) => item.group_id === group.id),
  }));

  const ungroupedItems = lineItems.filter((item) => !item.group_id);

  const isLoading = loadingEstimate || loadingItems;
  const canSendProposal = estimate && estimate.total > 0 && estimate.status === "draft";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
          onInteractOutside={(e) => {
            if (document.visibilityState === "hidden" || !document.hasFocus()) {
              e.preventDefault();
            }
          }}
        >
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Estimate #{estimate?.estimate_number || "..."}
                </SheetTitle>
                <SheetDescription>
                  Review and edit estimate details
                </SheetDescription>
              </div>
              {estimate && getStatusBadge(estimate.status)}
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : estimate ? (
            <>
              <ScrollArea className="flex-1 -mx-6 px-6">
                {/* Customer Info - Editable */}
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer & Project Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="font-medium">{estimate.customer_name}</p>
                    
                    {/* Estimate Title / Project Name */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Project Name</label>
                      <Input
                        value={editedCustomerInfo.estimate_title ?? estimate.estimate_title ?? ""}
                        onChange={(e) => setEditedCustomerInfo(prev => ({ ...prev, estimate_title: e.target.value }))}
                        placeholder="Enter project name"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Customer Email */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Customer Email</label>
                      <Input
                        type="email"
                        value={editedCustomerInfo.customer_email ?? estimate.customer_email ?? ""}
                        onChange={(e) => setEditedCustomerInfo(prev => ({ ...prev, customer_email: e.target.value }))}
                        placeholder="Enter customer email"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Job Address */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Job Address
                      </label>
                      <Input
                        value={editedCustomerInfo.job_address ?? estimate.job_address ?? ""}
                        onChange={(e) => setEditedCustomerInfo(prev => ({ ...prev, job_address: e.target.value }))}
                        placeholder="Enter job address with zip code"
                        className="h-8 text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Discount Editor */}
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Discount
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={discountType ?? estimate.discount_type ?? "percent"}
                        onValueChange={(v) => setDiscountType(v)}
                      >
                        <SelectTrigger className="w-28 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent (%)</SelectItem>
                          <SelectItem value="fixed">Fixed ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 text-sm flex-1"
                        placeholder={(discountType ?? estimate.discount_type ?? "percent") === "percent" ? "e.g. 5" : "e.g. 500"}
                        value={discountValue !== null ? discountValue : (estimate.discount_value ?? 0)}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {(discountType ?? estimate.discount_type ?? "percent") === "percent" ? "%" : "$"}
                      </span>
                    </div>
                    {/* Live preview of discount */}
                    {(() => {
                      const effType = discountType ?? estimate.discount_type ?? "percent";
                      const effValue = discountValue !== null ? discountValue : (estimate.discount_value ?? 0);
                      const subtotal = hasItemChanges ? calculateTotal() : (estimate.subtotal ?? 0);
                      const da = effType === "percent"
                        ? Math.round(subtotal * effValue / 100 * 100) / 100
                        : Number(effValue);
                      if (da <= 0) return null;
                      return (
                        <p className="text-xs text-green-600">
                          Discount: -${da.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Visibility Toggles */}
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <LayoutList className="h-4 w-4" />
                      Customer PDF / Preview Visibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="toggle-scope" className="text-sm cursor-pointer">
                        Show scope of work text
                      </Label>
                      <Switch
                        id="toggle-scope"
                        checked={showScope !== null ? showScope : (estimate.show_scope_to_customer ?? false)}
                        onCheckedChange={(v) => setShowScope(v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="toggle-lineitems" className="text-sm cursor-pointer">
                        Show line item breakdown
                      </Label>
                      <Switch
                        id="toggle-lineitems"
                        checked={showLineItems !== null ? showLineItems : (estimate.show_line_items_to_customer ?? false)}
                        onCheckedChange={(v) => setShowLineItems(v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="toggle-details" className="text-sm cursor-pointer">
                        Show scope / project details
                      </Label>
                      <Switch
                        id="toggle-details"
                        checked={showDetails !== null ? showDetails : (estimate.show_details_to_customer ?? false)}
                        onCheckedChange={(v) => setShowDetails(v)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These control what the customer sees in the PDF and Review &amp; Sign page.
                    </p>
                  </CardContent>
                </Card>

                {/* Line Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Line Items
                    </h3>
                    {hasChanges && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Unsaved changes
                      </Badge>
                    )}
                  </div>

                  {groupedItems.map((group) => (
                    <Card key={group.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{group.group_name}</CardTitle>
                        {group.description && (
                          <p className="text-xs text-muted-foreground">{group.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-muted/50"
                          >
                            <div className="col-span-5">
                              <Input
                                value={getItemValue(item, "description") as string}
                                onChange={(e) =>
                                  handleItemChange(item.id, "description", e.target.value)
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={getItemValue(item, "quantity")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "quantity", parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-sm text-center"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={getItemValue(item, "unit_price")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "unit_price", parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-sm text-right"
                              />
                            </div>
                            <div className="col-span-3 text-right font-medium text-sm">
                              ${calculateLineTotal(item).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}

                  {ungroupedItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Other Items</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {ungroupedItems.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-muted/50"
                          >
                            <div className="col-span-5">
                              <Input
                                value={getItemValue(item, "description") as string}
                                onChange={(e) =>
                                  handleItemChange(item.id, "description", e.target.value)
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={getItemValue(item, "quantity")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "quantity", parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-sm text-center"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={getItemValue(item, "unit_price")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "unit_price", parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-sm text-right"
                              />
                            </div>
                            <div className="col-span-3 text-right font-medium text-sm">
                              ${calculateLineTotal(item).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {lineItems.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <p>No line items yet. AI generation may still be in progress.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Pricing Summary */}
                <Separator className="my-4" />
                <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      ${(hasItemChanges ? calculateTotal() : (estimate.subtotal ?? 0)).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {(() => {
                    const effType = discountType ?? estimate.discount_type ?? "percent";
                    const effValue = discountValue !== null ? discountValue : (estimate.discount_value ?? 0);
                    const subtotal = hasItemChanges ? calculateTotal() : (estimate.subtotal ?? 0);
                    const da = effType === "percent"
                      ? Math.round(subtotal * effValue / 100 * 100) / 100
                      : Number(effValue);
                    if (da <= 0) return null;
                    return (
                      <div className="flex items-center justify-between text-green-700">
                        <span className="text-sm">Discount</span>
                        <span className="font-medium">
                          -${da.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })()}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total
                    </span>
                    <span className="text-xl font-bold text-primary">
                      ${(() => {
                        const effType = discountType ?? estimate.discount_type ?? "percent";
                        const effValue = discountValue !== null ? discountValue : (estimate.discount_value ?? 0);
                        const subtotal = hasItemChanges ? calculateTotal() : (estimate.subtotal ?? 0);
                        const da = effType === "percent"
                          ? Math.round(subtotal * effValue / 100 * 100) / 100
                          : Number(effValue);
                        return Math.max(0, subtotal - da).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      })()}
                    </span>
                  </div>
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="pt-4 space-y-2 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview PDF
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
                <Button
                  variant="default"
                  className="w-full"
                  disabled={!canSendProposal}
                  onClick={() => setPreviewBeforeSend(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send as Proposal
                </Button>
                {!canSendProposal && estimate.status !== "draft" && (
                  <p className="text-xs text-center text-muted-foreground">
                    Proposal already sent
                  </p>
                )}
                {!canSendProposal && estimate.status === "draft" && estimate.total === 0 && (
                  <p className="text-xs text-center text-amber-600">
                    Cannot send — estimate total is $0. Wait for AI to complete or add items manually.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Estimate not found
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Preview Dialog */}
      <EstimatePreviewDialog
        estimateId={estimateId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {/* Preview-before-send Dialog */}
      <EstimatePreviewDialog
        estimateId={estimateId}
        open={previewBeforeSend}
        onOpenChange={(open) => {
          setPreviewBeforeSend(open);
        }}
        onConfirmSend={() => {
          setPreviewBeforeSend(false);
          setSendDialogOpen(true);
        }}
        confirmSendLabel="Confirm & Send"
      />

      {/* Send Proposal Dialog */}
      {estimate && (
        <SendProposalDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          estimateId={estimate.id}
          companyId={companyId}
          customerName={estimate.customer_name || ""}
          customerEmail={editedCustomerInfo.customer_email ?? estimate.customer_email}
          customerPhone={estimate.customer_phone}
          jobAddress={editedCustomerInfo.job_address ?? estimate.job_address}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["portal-estimate-detail", estimateId] });
            queryClient.invalidateQueries({ queryKey: ["portal-my-estimates"] });
            queryClient.invalidateQueries({ queryKey: ["salesperson-portal-proposals"] });
            queryClient.invalidateQueries({ queryKey: ["estimates"] });
            queryClient.invalidateQueries({ queryKey: ["company-estimates"] });
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
