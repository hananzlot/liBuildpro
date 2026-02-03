import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProductionAnalytics, PayableWithCashImpact } from "@/hooks/useProductionAnalytics";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatCurrencyWithDecimals } from "@/lib/utils";
import { Printer, Search, ArrowUpDown, Layers, List, Pencil, Circle, CalendarIcon, X, Trash2, Info, ChevronUp, ChevronDown } from "lucide-react";
import { format, nextFriday, previousSaturday, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";
import { SchedulePaymentDialog } from "@/components/production/analytics/SchedulePaymentDialog";
import { MarkAsPaidDialog } from "@/components/production/analytics/MarkAsPaidDialog";
import { EditBillPaymentDialog } from "@/components/production/analytics/EditBillPaymentDialog";
import { QBBillSelectionDialog } from "@/components/production/analytics/QBBillSelectionDialog";

// Type for paid bill records from the query
interface PaidBillRecord {
  id: string;
  payment_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  bank_name: string | null;
  payment_reference: string | null;
  bill: {
    id: string;
    bill_ref: string | null;
    installer_company: string | null;
    category: string | null;
    project: {
      id: string;
      project_number: number | null;
      project_name: string | null;
      project_address: string | null;
    } | null;
  } | null;
}

type SortField = 'project_number' | 'vendor' | 'amount_due' | 'project_current_cash' | 'cash_after_payment' | 'scheduled_payment_date';
type SortDir = 'asc' | 'desc';

type PaidSortField = 'payment_date' | 'project_number' | 'vendor' | 'ref' | 'amount' | 'method' | 'check' | 'bank';

// Get the next Friday from today (or today if it's Friday)
const getNextFriday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 5) return today;
  return nextFriday(today);
};

// Get the previous Saturday from today (or today if it's Saturday)
const getPastSaturday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 6) return today;
  return previousSaturday(today);
};

export default function OutstandingAP() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('project_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [groupByProject, setGroupByProject] = useState(false);
  const [scheduledDateFilter, setScheduledDateFilter] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'all' | 'scheduled' | 'paid'>('all');
  const [paidDateRange, setPaidDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfWeek(new Date(), { weekStartsOn: 0 }),
    to: endOfWeek(new Date(), { weekStartsOn: 0 }),
  });
  const [schedulingPayable, setSchedulingPayable] = useState<PayableWithCashImpact | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [markingAsPaidPayable, setMarkingAsPaidPayable] = useState<PayableWithCashImpact | null>(null);
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  const [clearScheduleConfirmOpen, setClearScheduleConfirmOpen] = useState(false);
  const [payableToClear, setPayableToClear] = useState<PayableWithCashImpact | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaidBillRecord | null>(null);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [paidSortField, setPaidSortField] = useState<PaidSortField>('payment_date');
  const [paidSortDir, setPaidSortDir] = useState<SortDir>('desc');
  const [qbBillSelectionDialogOpen, setQbBillSelectionDialogOpen] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<{ billId: string; data: { paymentDate: Date; amount: number; bankName: string | null; paymentMethod: string | null; paymentReference: string | null }; vendorName: string; billRef: string | null } | null>(null);

  const { payablesWithCashImpact, isLoading } = useProductionAnalytics({
    dateRange: undefined,
    selectedProjects: [],
    selectedSalespeople: [],
  });

  // Fetch paid bills for the Paid tab
  const { data: paidBills = [], isLoading: loadingPaidBills } = useQuery<PaidBillRecord[]>({
    queryKey: ["paid-bills", companyId, paidDateRange.from, paidDateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_payments")
        .select(`
          id,
          payment_amount,
          payment_date,
          payment_method,
          bank_name,
          payment_reference,
          bill:project_bills(
            id,
            bill_ref,
            installer_company,
            category,
            project:projects(id, project_number, project_name, project_address)
          )
        `)
        .eq("company_id", companyId)
        .gte("payment_date", format(paidDateRange.from, 'yyyy-MM-dd'))
        .lte("payment_date", format(paidDateRange.to, 'yyyy-MM-dd'))
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      // Cast the nested join results to our expected type
      return (data || []).map(row => ({
        ...row,
        bill: Array.isArray(row.bill) ? row.bill[0] : row.bill,
      })) as PaidBillRecord[];
    },
    enabled: !!companyId && activeTab === 'paid',
  });

  // Check if QuickBooks is connected for this company
  const { data: qbConnection } = useQuery({
    queryKey: ["qb-connection-status", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("id, is_active, realm_id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 60000,
  });

  const isQBConnected = !!qbConnection?.is_active;

  // Handle clicking on a paid bill record to edit it
  const handlePaidBillClick = (payment: PaidBillRecord) => {
    setEditingPayment(payment);
    setEditPaymentDialogOpen(true);
  };

  // Handle sorting for the paid tab
  const handlePaidSort = (field: PaidSortField) => {
    if (paidSortField === field) {
      setPaidSortDir(paidSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setPaidSortField(field);
      setPaidSortDir('asc');
    }
  };

  // Filter and sort paid bills
  const filteredAndSortedPaidBills = useMemo(() => {
    let result = [...paidBills];
    
    // Text filter
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(p => {
        const project = p.bill?.project;
        const vendor = p.bill?.installer_company;
        return (
          project?.project_name?.toLowerCase().includes(lower) ||
          project?.project_address?.toLowerCase().includes(lower) ||
          vendor?.toLowerCase().includes(lower) ||
          p.bill?.bill_ref?.toLowerCase().includes(lower) ||
          String(project?.project_number).includes(lower)
        );
      });
    }
    
    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (paidSortField) {
        case 'payment_date':
          cmp = (a.payment_date || '').localeCompare(b.payment_date || '');
          break;
        case 'project_number':
          cmp = (a.bill?.project?.project_number || 0) - (b.bill?.project?.project_number || 0);
          break;
        case 'vendor':
          cmp = (a.bill?.installer_company || '').localeCompare(b.bill?.installer_company || '');
          break;
        case 'ref':
          cmp = (a.bill?.bill_ref || '').localeCompare(b.bill?.bill_ref || '');
          break;
        case 'amount':
          cmp = (a.payment_amount || 0) - (b.payment_amount || 0);
          break;
        case 'method':
          cmp = (a.payment_method || '').localeCompare(b.payment_method || '');
          break;
        case 'check':
          cmp = (a.payment_reference || '').localeCompare(b.payment_reference || '');
          break;
        case 'bank':
          cmp = (a.bank_name || '').localeCompare(b.bank_name || '');
          break;
      }
      return paidSortDir === 'asc' ? cmp : -cmp;
    });
    
    return result;
  }, [paidBills, search, paidSortField, paidSortDir]);

  // Sort icon component for paid table
  const PaidSortIcon = ({ field }: { field: PaidSortField }) => {
    if (paidSortField !== field) return <ChevronUp className="h-3 w-3 ml-1 opacity-30" />;
    return paidSortDir === 'asc' 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  // Filter and sort logic
  const filteredAndSorted = useMemo(() => {
    let result = [...payablesWithCashImpact];
    
    // Tab filter - scheduled tab shows only scheduled items
    if (activeTab === 'scheduled') {
      result = result.filter(p => p.scheduled_payment_date);
    }
    
    // Text filter
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(p =>
        p.project_name?.toLowerCase().includes(lower) ||
        p.vendor?.toLowerCase().includes(lower) ||
        p.bill_ref?.toLowerCase().includes(lower) ||
        String(p.project_number).includes(lower)
      );
    }

    // Date filter (only for scheduled tab)
    if (activeTab === 'scheduled' && scheduledDateFilter) {
      const filterStart = startOfDay(getPastSaturday());
      const filterEnd = endOfDay(scheduledDateFilter);
      result = result.filter(p => {
        if (!p.scheduled_payment_date) return false;
        const scheduledDate = parseISO(p.scheduled_payment_date);
        return isWithinInterval(scheduledDate, { start: filterStart, end: filterEnd });
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'project_number':
          cmp = a.project_number - b.project_number;
          break;
        case 'vendor':
          cmp = (a.vendor || '').localeCompare(b.vendor || '');
          break;
        case 'amount_due':
          cmp = a.amount_due - b.amount_due;
          break;
        case 'project_current_cash':
          cmp = a.project_current_cash - b.project_current_cash;
          break;
        case 'cash_after_payment':
          cmp = a.cash_if_this_paid - b.cash_if_this_paid;
          break;
        case 'scheduled_payment_date':
          const dateA = a.scheduled_payment_date ? new Date(a.scheduled_payment_date).getTime() : 0;
          const dateB = b.scheduled_payment_date ? new Date(b.scheduled_payment_date).getTime() : 0;
          cmp = dateA - dateB;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [payablesWithCashImpact, search, sortField, sortDir, scheduledDateFilter, activeTab]);

  const total = filteredAndSorted.reduce((sum, p) => sum + p.amount_due, 0);
  const scheduledTotal = filteredAndSorted.reduce((sum, p) => sum + (p.scheduled_payment_amount || 0), 0);
  
  // Calculate scheduled count for tab badge
  const scheduledCount = useMemo(() => 
    payablesWithCashImpact.filter(p => p.scheduled_payment_date).length,
  [payablesWithCashImpact]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleProjectClick = (projectId: string) => {
    const project = payablesWithCashImpact.find(p => p.project_id === projectId);
    openTab(`/project/${projectId}?tab=finance&financeTab=bills`, `Project-${project?.project_number || "Detail"}`);
  };

  // Schedule payment mutation
  const scheduleMutation = useMutation({
    mutationFn: async ({ billId, date, amount }: { billId: string; date: Date; amount: number }) => {
      const { error } = await supabase
        .from("project_bills")
        .update({
          scheduled_payment_date: format(date, 'yyyy-MM-dd'),
          scheduled_payment_amount: amount,
        })
        .eq("id", billId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment scheduled");
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-ap-due"] });
      setScheduleDialogOpen(false);
      setSchedulingPayable(null);
    },
    onError: (error) => toast.error(`Failed to schedule: ${error.message}`),
  });

  // Clear schedule mutation
  const clearScheduleMutation = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await supabase
        .from("project_bills")
        .update({
          scheduled_payment_date: null,
          scheduled_payment_amount: null,
        })
        .eq("id", billId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule cleared");
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-ap-due"] });
      setClearScheduleConfirmOpen(false);
      setPayableToClear(null);
    },
    onError: (error) => toast.error(`Failed to clear: ${error.message}`),
  });

  // Mark as paid mutation with QuickBooks sync
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ billId, data, syncToQB, selectedQbBillId }: { 
      billId: string; 
      data: { paymentDate: Date; amount: number; bankName: string | null; paymentMethod: string | null; paymentReference: string | null }; 
      syncToQB: boolean;
      selectedQbBillId?: string;
    }) => {
      // Insert the bill payment
      const { data: paymentRecord, error } = await supabase
        .from("bill_payments")
        .insert({
          bill_id: billId,
          payment_date: format(data.paymentDate, 'yyyy-MM-dd'),
          payment_amount: data.amount,
          bank_name: data.bankName,
          payment_method: data.paymentMethod,
          payment_reference: data.paymentReference,
          company_id: companyId,
        })
        .select()
        .single();
      if (error) throw error;
      
      // Clear scheduled payment fields
      await supabase
        .from("project_bills")
        .update({
          scheduled_payment_date: null,
          scheduled_payment_amount: null,
        })
        .eq("id", billId);

      // Sync to QuickBooks if enabled
      let qbSynced = false;
      if (syncToQB && companyId && paymentRecord && selectedQbBillId) {
        try {
          // Link the local bill to the selected QB bill (without creating a new one)
          await supabase.functions.invoke("sync-to-quickbooks", {
            body: {
              companyId,
              syncType: "link_bill",
              recordId: billId,
              qbBillId: selectedQbBillId,
            },
          });
          
          // Then sync the bill payment
          const { data: qbResult, error: qbError } = await supabase.functions.invoke("sync-to-quickbooks", {
            body: {
              companyId,
              syncType: "bill_payment",
              recordId: paymentRecord.id,
            },
          });
          
          if (!qbError && qbResult?.synced > 0) {
            qbSynced = true;
          }
        } catch (err) {
          console.error("Failed to sync to QuickBooks:", err);
        }
      }

      return { qbSynced };
    },
    onSuccess: (result) => {
      if (result.qbSynced) {
        toast.success("Payment recorded and synced to QuickBooks");
      } else {
        toast.success("Payment recorded");
      }
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
      queryClient.invalidateQueries({ queryKey: ["paid-bills"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-ap-due"] });
      queryClient.invalidateQueries({ queryKey: ["qb-vendor-bills"] });
      setMarkAsPaidDialogOpen(false);
      setMarkingAsPaidPayable(null);
      setPendingPaymentData(null);
      setQbBillSelectionDialogOpen(false);
    },
    onError: (error) => toast.error(`Failed to record: ${error.message}`),
  });

  // Handler when user clicks "Record Payment" in the MarkAsPaidDialog
  const handleMarkAsPaidSave = useCallback((billId: string, data: { paymentDate: Date; amount: number; bankName: string | null; paymentMethod: string | null; paymentReference: string | null }) => {
    if (isQBConnected) {
      // Find the payable to get vendor name and bill ref
      const payable = markingAsPaidPayable;
      const vendorName = payable?.vendor || "";
      const billRef = payable?.bill_ref || null;
      
      // Store pending data and show QB bill selection dialog
      setPendingPaymentData({ billId, data, vendorName, billRef });
      setQbBillSelectionDialogOpen(true);
    } else {
      // No QB connection, proceed directly without sync
      markAsPaidMutation.mutate({ billId, data, syncToQB: false });
    }
  }, [isQBConnected, markAsPaidMutation, markingAsPaidPayable]);

  // Handler when user selects a QB bill from the selection dialog
  const handleQbBillSelected = useCallback((qbBillId: string, qbDocNumber: string) => {
    if (pendingPaymentData) {
      markAsPaidMutation.mutate({ 
        billId: pendingPaymentData.billId, 
        data: pendingPaymentData.data, 
        syncToQB: true,
        selectedQbBillId: qbBillId,
      });
    }
  }, [pendingPaymentData, markAsPaidMutation]);

  // Handler when user cancels the QB bill selection
  const handleQbBillSelectionCancel = useCallback(() => {
    // Don't record the payment at all - just cancel
    setPendingPaymentData(null);
    setQbBillSelectionDialogOpen(false);
  }, []);

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Outstanding Payables (AP)</h1>
            <p className="text-sm text-muted-foreground">All unpaid bills with cash impact projections</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="no-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'scheduled' | 'paid')} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              All Outstanding
              <Badge variant="secondary" className="ml-2">{payablesWithCashImpact.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              Scheduled
              {scheduledCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary">{scheduledCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid
              {paidBills.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-emerald-500/20 text-emerald-600">{paidBills.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search vendors, projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      variant={groupByProject ? "default" : "outline"}
                      size="sm"
                      onClick={() => setGroupByProject(!groupByProject)}
                    >
                      {groupByProject ? <Layers className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                      {groupByProject ? "Grouped" : "Flat"}
                    </Button>
                  </div>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive">
                    Total Due: {formatCurrencyWithDecimals(total)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px]" />
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table className="print-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('project_number')}>
                            <div className="flex items-center gap-1">
                              Project
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('vendor')}>
                            <div className="flex items-center gap-1">
                              Vendor
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort('amount_due')}>
                            <div className="flex items-center justify-end gap-1">
                              Amount Due
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort('project_current_cash')}>
                            <div className="flex items-center justify-end gap-1">
                              Project Cash
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort('cash_after_payment')}>
                            <div className="flex items-center justify-end gap-1">
                              After Payment
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('scheduled_payment_date')}>
                            <div className="flex items-center gap-1">
                              Scheduled
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSorted.map((payable) => (
                          <TableRow
                            key={payable.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleProjectClick(payable.project_id)}
                          >
                            <TableCell className="max-w-[200px]">
                              <div className="truncate font-medium">#{payable.project_number}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {payable.project_address || payable.project_name}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{payable.vendor || '-'}</TableCell>
                            <TableCell>{payable.bill_ref || '-'}</TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {formatCurrencyWithDecimals(payable.amount_due)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right",
                              payable.project_current_cash >= 0 ? "text-emerald-600" : "text-destructive"
                            )}>
                              {formatCurrencyWithDecimals(payable.project_current_cash)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right",
                              payable.cash_if_this_paid >= 0 ? "text-emerald-600" : "text-destructive"
                            )}>
                              {formatCurrencyWithDecimals(payable.cash_if_this_paid)}
                            </TableCell>
                            <TableCell>
                              {payable.scheduled_payment_date ? (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="bg-primary/10 text-primary">
                                    {format(parseISO(payable.scheduled_payment_date), 'MMM d')}
                                  </Badge>
                                  {payable.scheduled_payment_amount && payable.scheduled_payment_amount !== payable.amount_due && (
                                    <span className="text-xs text-muted-foreground">
                                      ({formatCurrencyWithDecimals(payable.scheduled_payment_amount)})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setSchedulingPayable(payable);
                                        setScheduleDialogOpen(true);
                                      }}
                                    >
                                      <CalendarIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Schedule Payment</TooltipContent>
                                </Tooltip>
                                {payable.scheduled_payment_date && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => {
                                          setPayableToClear(payable);
                                          setClearScheduleConfirmOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clear Schedule</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-emerald-600"
                                      onClick={() => {
                                        setMarkingAsPaidPayable(payable);
                                        setMarkAsPaidDialogOpen(true);
                                      }}
                                    >
                                      <Circle className="h-3.5 w-3.5 fill-current" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Paid</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAndSorted.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No outstanding bills
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search vendors, projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn(scheduledDateFilter && "bg-primary/10")}>
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {scheduledDateFilter ? format(scheduledDateFilter, 'MMM d') : "Filter by date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={scheduledDateFilter}
                          onSelect={setScheduledDateFilter}
                          initialFocus
                        />
                        {scheduledDateFilter && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => setScheduledDateFilter(undefined)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Clear filter
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      Scheduled: {formatCurrencyWithDecimals(scheduledTotal)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px]" />
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table className="print-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('scheduled_payment_date')}>
                            <div className="flex items-center gap-1">
                              Scheduled Date
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('project_number')}>
                            <div className="flex items-center gap-1">
                              Project
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('vendor')}>
                            <div className="flex items-center gap-1">
                              Vendor
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort('amount_due')}>
                            <div className="flex items-center justify-end gap-1">
                              Amount Due
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Scheduled Amount</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSorted.map((payable) => (
                          <TableRow
                            key={payable.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleProjectClick(payable.project_id)}
                          >
                            <TableCell>
                              <Badge variant="outline" className="bg-primary/10 text-primary">
                                {payable.scheduled_payment_date && format(parseISO(payable.scheduled_payment_date), 'MMM d, yyyy')}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate font-medium">#{payable.project_number}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {payable.project_address || payable.project_name}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{payable.vendor || '-'}</TableCell>
                            <TableCell>{payable.bill_ref || '-'}</TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {formatCurrencyWithDecimals(payable.amount_due)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-primary">
                              {formatCurrencyWithDecimals(payable.scheduled_payment_amount || payable.amount_due)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setSchedulingPayable(payable);
                                        setScheduleDialogOpen(true);
                                      }}
                                    >
                                      <CalendarIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reschedule</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => {
                                        setPayableToClear(payable);
                                        setClearScheduleConfirmOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Clear Schedule</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-emerald-600"
                                      onClick={() => {
                                        setMarkingAsPaidPayable(payable);
                                        setMarkAsPaidDialogOpen(true);
                                      }}
                                    >
                                      <Circle className="h-3.5 w-3.5 fill-current" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Paid</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAndSorted.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No scheduled payments
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search vendors, projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {format(paidDateRange.from, 'MMM d')} - {format(paidDateRange.to, 'MMM d')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="range"
                          selected={{ from: paidDateRange.from, to: paidDateRange.to }}
                          onSelect={(range) => {
                            if (range?.from && range?.to) {
                              setPaidDateRange({ from: range.from, to: range.to });
                            } else if (range?.from) {
                              setPaidDateRange({ from: range.from, to: range.from });
                            }
                          }}
                          initialFocus
                          numberOfMonths={2}
                        />
                        <div className="p-2 border-t flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            onClick={() => setPaidDateRange({
                              from: startOfWeek(new Date(), { weekStartsOn: 0 }),
                              to: endOfWeek(new Date(), { weekStartsOn: 0 }),
                            })}
                          >
                            This Week
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const lastWeek = new Date();
                              lastWeek.setDate(lastWeek.getDate() - 7);
                              setPaidDateRange({
                                from: startOfWeek(lastWeek, { weekStartsOn: 0 }),
                                to: endOfWeek(lastWeek, { weekStartsOn: 0 }),
                              });
                            }}
                          >
                            Last Week
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                      Paid: {formatCurrencyWithDecimals(paidBills.reduce((sum, p) => sum + (p.payment_amount || 0), 0))}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPaidBills ? (
                  <Skeleton className="h-[400px]" />
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table className="print-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('payment_date')}
                          >
                            <div className="flex items-center">
                              Payment Date
                              <PaidSortIcon field="payment_date" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('project_number')}
                          >
                            <div className="flex items-center">
                              Project
                              <PaidSortIcon field="project_number" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('vendor')}
                          >
                            <div className="flex items-center">
                              Vendor
                              <PaidSortIcon field="vendor" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('ref')}
                          >
                            <div className="flex items-center">
                              Ref
                              <PaidSortIcon field="ref" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('amount')}
                          >
                            <div className="flex items-center justify-end">
                              Amount Paid
                              <PaidSortIcon field="amount" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('method')}
                          >
                            <div className="flex items-center">
                              Method
                              <PaidSortIcon field="method" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('check')}
                          >
                            <div className="flex items-center">
                              Check #
                              <PaidSortIcon field="check" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidSort('bank')}
                          >
                            <div className="flex items-center">
                              Bank
                              <PaidSortIcon field="bank" />
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedPaidBills.map((payment) => (
                          <TableRow
                            key={payment.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePaidBillClick(payment)}
                          >
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                                {payment.payment_date && format(parseISO(payment.payment_date), 'MMM d, yyyy')}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate font-medium">
                                {payment.bill?.project?.project_number ? `#${payment.bill.project.project_number}` : '-'}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {payment.bill?.project?.project_address || payment.bill?.project?.project_name || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{payment.bill?.installer_company || '-'}</TableCell>
                            <TableCell>{payment.bill?.bill_ref || '-'}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {formatCurrencyWithDecimals(payment.payment_amount || 0)}
                            </TableCell>
                            <TableCell>{payment.payment_method || '-'}</TableCell>
                            <TableCell>{payment.payment_reference || '-'}</TableCell>
                            <TableCell>{payment.bank_name || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {filteredAndSortedPaidBills.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No payments in this period
                            </TableCell>
                          </TableRow>
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

      {/* Schedule Payment Dialog */}
      <SchedulePaymentDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        payable={schedulingPayable}
        allPayables={payablesWithCashImpact}
        scheduledDateFilter={scheduledDateFilter}
        onSave={(billId, date, amount) => {
          scheduleMutation.mutate({ billId, date, amount });
        }}
        onDelete={(billId) => {
          clearScheduleMutation.mutate(billId);
        }}
      />

      {/* Mark as Paid Dialog */}
      <MarkAsPaidDialog
        open={markAsPaidDialogOpen}
        onOpenChange={setMarkAsPaidDialogOpen}
        payable={markingAsPaidPayable}
        onSave={handleMarkAsPaidSave}
      />

      {/* Edit Bill Payment Dialog */}
      <EditBillPaymentDialog
        open={editPaymentDialogOpen}
        onOpenChange={setEditPaymentDialogOpen}
        payment={editingPayment}
        onSuccess={() => setEditingPayment(null)}
      />

      {/* QuickBooks Bill Selection Dialog */}
      <QBBillSelectionDialog
        open={qbBillSelectionDialogOpen}
        onOpenChange={setQbBillSelectionDialogOpen}
        vendorName={pendingPaymentData?.vendorName || ""}
        localBillRef={pendingPaymentData?.billRef || null}
        localBillAmount={pendingPaymentData?.data.amount || 0}
        onSelect={handleQbBillSelected}
        onCancel={handleQbBillSelectionCancel}
      />

      {/* Clear Schedule Confirmation */}
      <AlertDialog open={clearScheduleConfirmOpen} onOpenChange={setClearScheduleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Scheduled Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the scheduled payment date for this bill. You can reschedule it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => payableToClear && clearScheduleMutation.mutate(payableToClear.id)}
            >
              Clear Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
