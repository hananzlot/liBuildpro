import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, MapPin, Mail, Phone, Calendar, DollarSign, FileText, Percent } from "lucide-react";
import { format } from "date-fns";

interface EstimateDetailSheetProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

interface PaymentSchedule {
  id: string;
  phase_name: string;
  amount: number;
  percent: number;
  due_type: string;
  due_date: string | null;
  description: string | null;
  sort_order: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  viewed: "bg-purple-500",
  needs_changes: "bg-amber-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  needs_changes: "Needs Changes",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

const itemTypeLabels: Record<string, string> = {
  labor: "Labor",
  material: "Material",
  equipment: "Equipment",
  permit: "Permit",
  assembly: "Assembly",
  note: "Note",
};

export function EstimateDetailSheet({ estimateId, open, onOpenChange }: EstimateDetailSheetProps) {
  // Fetch estimate details
  const { data: estimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["estimate", estimateId],
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
    enabled: !!estimateId,
  });

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ["estimate-groups", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_groups")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!estimateId,
  });

  // Fetch line items
  const { data: lineItems } = useQuery({
    queryKey: ["estimate-line-items", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!estimateId,
  });

  // Fetch payment schedule
  const { data: paymentSchedule } = useQuery({
    queryKey: ["estimate-payment-schedule", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_payment_schedule")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as PaymentSchedule[];
    },
    enabled: !!estimateId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Group line items by group
  const groupedItems = groups?.map((group) => ({
    ...group,
    items: lineItems?.filter((item) => item.group_id === group.id) || [],
  })) || [];

  const ungroupedItems = lineItems?.filter((item) => !item.group_id) || [];

  if (loadingEstimate) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!estimate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              Estimate #{estimate.estimate_number}
            </SheetTitle>
            <Badge className={`${statusColors[estimate.status]} text-white`}>
              {statusLabels[estimate.status]}
            </Badge>
          </div>
          <SheetDescription>{estimate.estimate_title}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="font-semibold">{estimate.customer_name}</div>
              {estimate.customer_email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {estimate.customer_email}
                </div>
              )}
              {estimate.customer_phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {estimate.customer_phone}
                </div>
              )}
              {estimate.job_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {estimate.job_address}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estimate Date:</span>
                <div className="font-medium">{format(new Date(estimate.estimate_date), "MMMM d, yyyy")}</div>
              </div>
              {estimate.expiration_date && (
                <div>
                  <span className="text-muted-foreground">Expires:</span>
                  <div className="font-medium">{format(new Date(estimate.expiration_date), "MMMM d, yyyy")}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scope of Work */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Scope of Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedItems.map((group) => (
                <div key={group.id} className="space-y-2">
                  <h4 className="font-semibold text-sm border-b pb-1">{group.group_name}</h4>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-sm py-1">
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground mr-2">
                            [{itemTypeLabels[item.item_type]}]
                          </span>
                          <span>{item.description}</span>
                          <span className="text-muted-foreground ml-2">
                            ({item.quantity} {item.unit} × {formatCurrency(item.unit_price)})
                          </span>
                        </div>
                        <span className="font-medium ml-4">{formatCurrency(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {ungroupedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm border-b pb-1">Other Items</h4>
                  <div className="space-y-1">
                    {ungroupedItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-sm py-1">
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground mr-2">
                            [{itemTypeLabels[item.item_type]}]
                          </span>
                          <span>{item.description}</span>
                          <span className="text-muted-foreground ml-2">
                            ({item.quantity} {item.unit} × {formatCurrency(item.unit_price)})
                          </span>
                        </div>
                        <span className="font-medium ml-4">{formatCurrency(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Schedule */}
          {paymentSchedule && paymentSchedule.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Payment Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {paymentSchedule.map((phase) => (
                  <div key={phase.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{phase.phase_name}</span>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground">{phase.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{phase.percent}%</span>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency((estimate.total * phase.percent) / 100)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
              {estimate.tax_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({estimate.tax_rate}%)</span>
                  <span>{formatCurrency(estimate.tax_amount)}</span>
                </div>
              )}
              {estimate.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(estimate.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(estimate.total)}</span>
              </div>
              {estimate.deposit_required && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Deposit Required ({estimate.deposit_percent}%)</span>
                  <span>{formatCurrency((estimate.total * estimate.deposit_percent) / 100)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
