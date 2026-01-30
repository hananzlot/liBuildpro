import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarIcon, FileText, CreditCard, Receipt, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface QuickBooksSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastSyncAt?: string | null;
}

interface SyncRecord {
  id: string;
  date: string;
  amount: number;
  description: string;
  isSynced: boolean;
  excludeFromQb: boolean;
}

export function QuickBooksSyncDialog({ open, onOpenChange, lastSyncAt }: QuickBooksSyncDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  
  // Date range state - default from last sync to today
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    lastSyncAt ? new Date(lastSyncAt) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  
  // Selection state
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  
  // Preview mode
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("invoices");

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["qb-sync-invoices", companyId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("project_invoices")
        .select(`
          id, 
          invoice_number, 
          invoice_date, 
          amount,
          exclude_from_qb,
          projects!inner(project_name, company_id)
        `)
        .eq("projects.company_id", companyId)
        .order("invoice_date", { ascending: false });

      if (dateFrom) {
        query = query.gte("invoice_date", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("invoice_date", endOfDay(dateTo).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get sync status
      const { data: syncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "invoice")
        .eq("sync_status", "synced");

      const syncedIds = new Set((syncLog || []).map(s => s.record_id));

      return (data || []).map(inv => ({
        id: inv.id,
        date: inv.invoice_date,
        amount: inv.amount || 0,
        description: `#${inv.invoice_number} - ${(inv.projects as any)?.project_name || "Unknown"}`,
        isSynced: syncedIds.has(inv.id),
        excludeFromQb: inv.exclude_from_qb || false,
      })) as SyncRecord[];
    },
    enabled: open && !!companyId,
  });

  // Fetch payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["qb-sync-payments", companyId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("project_payments")
        .select(`
          id,
          payment_amount,
          projected_received_date,
          bank_name,
          exclude_from_qb,
          projects!inner(project_name, company_id)
        `)
        .eq("projects.company_id", companyId)
        .order("projected_received_date", { ascending: false });

      if (dateFrom) {
        query = query.gte("projected_received_date", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("projected_received_date", endOfDay(dateTo).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const { data: syncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .eq("sync_status", "synced");

      const syncedIds = new Set((syncLog || []).map(s => s.record_id));

      return (data || []).map(pmt => ({
        id: pmt.id,
        date: pmt.projected_received_date,
        amount: pmt.payment_amount || 0,
        description: `${(pmt.projects as any)?.project_name || "Unknown"} - ${pmt.bank_name || "Payment"}`,
        isSynced: syncedIds.has(pmt.id),
        excludeFromQb: pmt.exclude_from_qb || false,
      })) as SyncRecord[];
    },
    enabled: open && !!companyId,
  });

  // Fetch bills
  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["qb-sync-bills", companyId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("project_bills")
        .select(`
          id,
          bill_ref,
          bill_amount,
          installer_company,
          created_at,
          exclude_from_qb,
          projects!inner(project_name, company_id)
        `)
        .eq("projects.company_id", companyId)
        .order("created_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const { data: syncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .eq("sync_status", "synced");

      const syncedIds = new Set((syncLog || []).map(s => s.record_id));

      return (data || []).map(bill => ({
        id: bill.id,
        date: bill.created_at,
        amount: bill.bill_amount || 0,
        description: `${bill.installer_company || "Unknown"} - ${bill.bill_ref || "Bill"}`,
        isSynced: syncedIds.has(bill.id),
        excludeFromQb: bill.exclude_from_qb || false,
      })) as SyncRecord[];
    },
    enabled: open && !!companyId,
  });

  // Filter to unsycned and not excluded
  const unsyncedInvoices = useMemo(() => 
    (invoices || []).filter(i => !i.isSynced && !i.excludeFromQb), [invoices]);
  const unsyncedPayments = useMemo(() => 
    (payments || []).filter(p => !p.isSynced && !p.excludeFromQb), [payments]);
  const unsyncedBills = useMemo(() => 
    (bills || []).filter(b => !b.isSynced && !b.excludeFromQb), [bills]);

  // Toggle exclude mutation
  const toggleExcludeMutation = useMutation({
    mutationFn: async ({ table, id, exclude }: { table: string; id: string; exclude: boolean }) => {
      const { error } = await supabase
        .from(table as any)
        .update({ exclude_from_qb: exclude })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb-sync-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-payments"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-bills"] });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const recordIds = {
        invoices: Array.from(selectedInvoices),
        payments: Array.from(selectedPayments),
        bills: Array.from(selectedBills),
      };

      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: { 
          companyId, 
          selectedRecords: recordIds,
          syncSelected: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`Synced ${data.synced} records to QuickBooks`);
      } else if (data.failed > 0) {
        toast.error(`${data.failed} records failed to sync`);
      } else {
        toast.info("No records synced");
      }
      queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-payments"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-bills"] });
      setShowPreview(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Sync failed: " + error.message);
    },
  });

  const selectAll = (type: "invoices" | "payments" | "bills") => {
    if (type === "invoices") {
      setSelectedInvoices(new Set(unsyncedInvoices.map(i => i.id)));
    } else if (type === "payments") {
      setSelectedPayments(new Set(unsyncedPayments.map(p => p.id)));
    } else {
      setSelectedBills(new Set(unsyncedBills.map(b => b.id)));
    }
  };

  const deselectAll = (type: "invoices" | "payments" | "bills") => {
    if (type === "invoices") {
      setSelectedInvoices(new Set());
    } else if (type === "payments") {
      setSelectedPayments(new Set());
    } else {
      setSelectedBills(new Set());
    }
  };

  const toggleSelection = (type: "invoices" | "payments" | "bills", id: string) => {
    if (type === "invoices") {
      const newSet = new Set(selectedInvoices);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedInvoices(newSet);
    } else if (type === "payments") {
      const newSet = new Set(selectedPayments);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedPayments(newSet);
    } else {
      const newSet = new Set(selectedBills);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedBills(newSet);
    }
  };

  const totalSelected = selectedInvoices.size + selectedPayments.size + selectedBills.size;
  const isLoading = invoicesLoading || paymentsLoading || billsLoading;

  const renderRecordList = (
    records: SyncRecord[],
    selected: Set<string>,
    type: "invoices" | "payments" | "bills",
    tableName: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => selectAll(type)}>
            Select All ({records.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => deselectAll(type)}>
            Deselect All
          </Button>
        </div>
        <Badge variant="secondary">{selected.size} selected</Badge>
      </div>
      <ScrollArea className="h-[280px] border rounded-md">
        <div className="p-3 space-y-2">
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No unsynced records in selected date range
            </p>
          ) : (
            records.map(record => (
              <div
                key={record.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md border",
                  selected.has(record.id) ? "bg-primary/5 border-primary/30" : "bg-background"
                )}
              >
                <Checkbox
                  checked={selected.has(record.id)}
                  onCheckedChange={() => toggleSelection(type, record.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{record.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.date ? format(new Date(record.date), "MMM d, yyyy") : "No date"} • ${record.amount.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => toggleExcludeMutation.mutate({
                    table: tableName,
                    id: record.id,
                    exclude: true,
                  })}
                  title="Exclude from QB sync"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
        <AlertCircle className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Ready to sync {totalSelected} records</p>
          <p className="text-sm text-muted-foreground">
            Review below before confirming
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedInvoices.size > 0 && (
          <div className="p-3 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Invoices ({selectedInvoices.size})</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {unsyncedInvoices.filter(i => selectedInvoices.has(i.id)).slice(0, 5).map(inv => (
                <p key={inv.id}>{inv.description}</p>
              ))}
              {selectedInvoices.size > 5 && (
                <p className="text-xs">...and {selectedInvoices.size - 5} more</p>
              )}
            </div>
          </div>
        )}

        {selectedPayments.size > 0 && (
          <div className="p-3 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-green-500" />
              <span className="font-medium">Payments ({selectedPayments.size})</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {unsyncedPayments.filter(p => selectedPayments.has(p.id)).slice(0, 5).map(pmt => (
                <p key={pmt.id}>{pmt.description}</p>
              ))}
              {selectedPayments.size > 5 && (
                <p className="text-xs">...and {selectedPayments.size - 5} more</p>
              )}
            </div>
          </div>
        )}

        {selectedBills.size > 0 && (
          <div className="p-3 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Bills ({selectedBills.size})</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {unsyncedBills.filter(b => selectedBills.has(b.id)).slice(0, 5).map(bill => (
                <p key={bill.id}>{bill.description}</p>
              ))}
              {selectedBills.size > 5 && (
                <p className="text-xs">...and {selectedBills.size - 5} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showPreview ? "Confirm Sync to QuickBooks" : "Sync to QuickBooks"}
          </DialogTitle>
          <DialogDescription>
            {showPreview 
              ? "Review the records that will be synced"
              : "Select which transactions to sync to QuickBooks"
            }
          </DialogDescription>
        </DialogHeader>

        {showPreview ? (
          renderPreview()
        ) : (
          <div className="space-y-4">
            {/* Date Range Filter */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[140px] justify-start">
                      <CalendarIcon className="h-3 w-3 mr-2" />
                      {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[140px] justify-start">
                      <CalendarIcon className="h-3 w-3 mr-2" />
                      {dateTo ? format(dateTo, "MMM d, yyyy") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
              >
                Clear dates
              </Button>
            </div>

            {/* Transaction Tabs */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="invoices" className="gap-1">
                    <FileText className="h-3 w-3" />
                    Invoices ({unsyncedInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="gap-1">
                    <CreditCard className="h-3 w-3" />
                    Payments ({unsyncedPayments.length})
                  </TabsTrigger>
                  <TabsTrigger value="bills" className="gap-1">
                    <Receipt className="h-3 w-3" />
                    Bills ({unsyncedBills.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="invoices" className="mt-4">
                  {renderRecordList(unsyncedInvoices, selectedInvoices, "invoices", "project_invoices")}
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  {renderRecordList(unsyncedPayments, selectedPayments, "payments", "project_payments")}
                </TabsContent>

                <TabsContent value="bills" className="mt-4">
                  {renderRecordList(unsyncedBills, selectedBills, "bills", "project_bills")}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back
              </Button>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirm Sync ({totalSelected})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => setShowPreview(true)}
                disabled={totalSelected === 0}
              >
                Preview Sync ({totalSelected})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
