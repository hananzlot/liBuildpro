import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatCurrencyWithDecimals } from "@/lib/utils";
import { Calendar, Printer, Search, ArrowUpDown, Layers, List, Pencil, Circle, CalendarIcon, X, Trash2 } from "lucide-react";
import { PayableWithCashImpact } from "@/hooks/useProductionAnalytics";
import { format, nextFriday, previousSaturday, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

interface PayablesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payables: PayableWithCashImpact[];
  onProjectClick?: (projectId: string, initialTab?: string, returnTo?: 'payables', financeSubTab?: 'bills' | 'history') => void;
  onBillClick?: (projectId: string, billId: string) => void;
  onSchedulePayment?: (payable: PayableWithCashImpact, scheduledDateFilter?: Date) => void;
  onMarkAsPaid?: (payable: PayableWithCashImpact) => void;
  hideCloseButton?: boolean;
}

type SortField = 'project_number' | 'vendor' | 'amount_due' | 'project_current_cash' | 'cash_after_payment' | 'scheduled_payment_date';
type SortDir = 'asc' | 'desc';

// Helper to calculate total scheduled payments per project (filtered by date)
const getProjectScheduledTotal = (
  payables: PayableWithCashImpact[], 
  projectId: string,
  filterDate?: Date
): number => {
  return payables
    .filter(p => {
      if (p.project_id !== projectId || !p.scheduled_payment_date) return false;
      if (!filterDate) return true;
      const scheduledDate = parseISO(p.scheduled_payment_date);
      return scheduledDate <= filterDate;
    })
    .reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0);
};

// Helper to calculate cash after ALL scheduled payments for the project (filtered by date)
const getCashAfterAllScheduledPayments = (
  payable: PayableWithCashImpact, 
  allPayables: PayableWithCashImpact[],
  filterDate?: Date
): number | null => {
  const totalScheduled = getProjectScheduledTotal(allPayables, payable.project_id, filterDate);
  if (totalScheduled === 0) return null;
  return payable.project_current_cash - totalScheduled;
};

// Get the next Friday from today (or today if it's Friday)
const getNextFriday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // If today is Friday (5), return today, otherwise get next Friday
  if (dayOfWeek === 5) return today;
  return nextFriday(today);
};

// Get the previous Saturday from today (or today if it's Saturday)
const getPastSaturday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // If today is Saturday (6), return today, otherwise get previous Saturday
  if (dayOfWeek === 6) return today;
  return previousSaturday(today);
};

export function PayablesSheet({
  open,
  onOpenChange,
  payables,
  onProjectClick,
  onBillClick,
  onSchedulePayment,
  onMarkAsPaid,
  hideCloseButton,
}: PayablesSheetProps) {
  const { isAdmin, isProduction } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"outstanding" | "history">("outstanding");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('amount_due');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [groupByProject, setGroupByProject] = useState(false);
  const [scheduledDateFilter, setScheduledDateFilter] = useState<Date | undefined>(getNextFriday());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Paid History tab state
  const [historyStartDate, setHistoryStartDate] = useState<Date>(getPastSaturday());
  const [historyEndDate, setHistoryEndDate] = useState<Date>(getNextFriday());
  const [historyStartPickerOpen, setHistoryStartPickerOpen] = useState(false);
  const [historyEndPickerOpen, setHistoryEndPickerOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  
  // Delete confirmation state
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch bill payments for history tab - scoped by company
  const { data: billPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["bill-payments-history", companyId, historyStartDate?.toISOString(), historyEndDate?.toISOString()],
    queryFn: async () => {
      if (!companyId) return [];
      const startDateStr = historyStartDate ? format(historyStartDate, 'yyyy-MM-dd') : null;
      const endDateStr = historyEndDate ? format(historyEndDate, 'yyyy-MM-dd') : null;
      
      let query = supabase
        .from("bill_payments")
        .select(`
          *,
          project_bills!inner (
            id,
            project_id,
            installer_company,
            bill_ref,
            category,
            memo,
            projects!inner (
              id,
              project_number,
              project_name,
              project_address
            )
          )
        `)
        .eq("company_id", companyId)
        .order("payment_date", { ascending: false });
      
      if (startDateStr) {
        query = query.gte("payment_date", startDateStr);
      }
      if (endDateStr) {
        query = query.lte("payment_date", endDateStr);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Get unique project IDs to fetch their cash positions
      const projectIds = [...new Set((data || []).map((bp: any) => bp.project_bills?.projects?.id).filter(Boolean))];
      
      if (projectIds.length === 0) return data || [];
      
      // Fetch payments received per project - scoped by company
      const { data: projectPayments, error: paymentsError } = await supabase
        .from("project_payments")
        .select("project_id, payment_amount")
        .eq("company_id", companyId)
        .in("project_id", projectIds)
        .eq("is_voided", false);
      
      if (paymentsError) throw paymentsError;
      
      // Fetch bills paid per project (sum of bill_payments) - scoped by company
      const { data: billPaymentsTotals, error: billPaymentsError } = await supabase
        .from("bill_payments")
        .select(`
          payment_amount,
          project_bills!inner (project_id)
        `)
        .eq("company_id", companyId);
      
      if (billPaymentsError) throw billPaymentsError;
      
      // Calculate cash position per project: payments received - bills paid
      const projectCashMap = new Map<string, number>();
      
      // Sum payments received
      (projectPayments || []).forEach((p: any) => {
        const current = projectCashMap.get(p.project_id) || 0;
        projectCashMap.set(p.project_id, current + (p.payment_amount || 0));
      });
      
      // Subtract bills paid
      (billPaymentsTotals || []).forEach((bp: any) => {
        const projectId = bp.project_bills?.project_id;
        if (projectId) {
          const current = projectCashMap.get(projectId) || 0;
          projectCashMap.set(projectId, current - (bp.payment_amount || 0));
        }
      });
      
      // Attach cash position to each bill payment
      return (data || []).map((bp: any) => ({
        ...bp,
        projectCashLeft: projectCashMap.get(bp.project_bills?.projects?.id) ?? null
      }));
    },
    enabled: open && activeTab === "history" && !!companyId,
  });

  // Delete bill payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // Fetch payment + associated bill so we can recompute rollups from bill_payments (source of truth)
      const { data: payment, error: paymentFetchError } = await supabase
        .from("bill_payments")
        .select("id, bill_id, payment_amount")
        .eq("id", paymentId)
        .single();

      if (paymentFetchError) throw paymentFetchError;

      const billId = payment.bill_id;
      const paymentAmount = payment.payment_amount || 0;

      // Get bill amount for balance calc
      const { data: bill, error: billFetchError } = await supabase
        .from("project_bills")
        .select("id, bill_amount")
        .eq("id", billId)
        .single();

      if (billFetchError) throw billFetchError;

      // Compute totals from bill_payments table (pre-delete), so we can rollback safely
      const { data: allPayments, error: paymentsError } = await supabase
        .from("bill_payments")
        .select("payment_amount")
        .eq("bill_id", billId);

      if (paymentsError) throw paymentsError;

      const totalPaidBefore = (allPayments ?? []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      const newTotalPaid = Math.max(0, totalPaidBefore - paymentAmount);
      const billAmount = bill?.bill_amount || 0;
      const newBalance = billAmount - newTotalPaid;

      // Update bill rollup first; rollback if delete fails
      const { error: updateError } = await supabase
        .from("project_bills")
        .update({
          amount_paid: newTotalPaid,
          balance: newBalance,
        })
        .eq("id", bill.id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", paymentId);

      if (deleteError) {
        // Best-effort rollback
        await supabase
          .from("project_bills")
          .update({
            amount_paid: totalPaidBefore,
            balance: billAmount - totalPaidBefore,
          })
          .eq("id", bill.id);

        throw deleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-payments-history"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      queryClient.invalidateQueries({ queryKey: ["all-bill-payments"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Payment deleted successfully");
      setDeleteDialogOpen(false);
      setDeletePaymentId(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete payment: " + error.message);
    },
  });

  const handleDeletePayment = (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletePaymentId(paymentId);
    setDeleteDialogOpen(true);
  };

  const confirmDeletePayment = () => {
    if (deletePaymentId) {
      deletePaymentMutation.mutate(deletePaymentId);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleScheduleFilter = (filter: 'scheduled' | 'unscheduled') => {
    setScheduleFilter(prev => prev === filter ? 'all' : filter);
  };

  const filteredPayables = useMemo(() => {
    let result = payables;
    
    // Schedule filter
    if (scheduleFilter === 'scheduled') {
      result = result.filter(p => p.scheduled_payment_date);
    } else if (scheduleFilter === 'unscheduled') {
      result = result.filter(p => !p.scheduled_payment_date);
    }
    
    // Scheduled date filter - show payables scheduled on or before this date
    if (scheduledDateFilter && scheduleFilter !== 'unscheduled') {
      result = result.filter(p => {
        if (!p.scheduled_payment_date) return scheduleFilter !== 'scheduled';
        const scheduledDate = parseISO(p.scheduled_payment_date);
        return scheduledDate <= scheduledDateFilter;
      });
    }
    
    // Schedule filter
    if (scheduleFilter === 'scheduled') {
      result = result.filter(p => p.scheduled_payment_date);
    } else if (scheduleFilter === 'unscheduled') {
      result = result.filter(p => !p.scheduled_payment_date);
    }
    
    // Search filter
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(p =>
        p.project_name.toLowerCase().includes(lower) ||
        p.project_address?.toLowerCase().includes(lower) ||
        p.vendor?.toLowerCase().includes(lower) ||
        p.bill_ref?.toLowerCase().includes(lower) ||
        String(p.project_number).includes(lower)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
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
          const cashA = getCashAfterAllScheduledPayments(a, payables, scheduledDateFilter);
          const cashB = getCashAfterAllScheduledPayments(b, payables, scheduledDateFilter);
          if (cashA === null && cashB === null) cmp = 0;
          else if (cashA === null) cmp = 1;
          else if (cashB === null) cmp = -1;
          else cmp = cashA - cashB;
          break;
        case 'scheduled_payment_date':
          if (!a.scheduled_payment_date && !b.scheduled_payment_date) cmp = 0;
          else if (!a.scheduled_payment_date) cmp = 1;
          else if (!b.scheduled_payment_date) cmp = -1;
          else cmp = new Date(a.scheduled_payment_date).getTime() - new Date(b.scheduled_payment_date).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [payables, search, sortField, sortDir, scheduleFilter, scheduledDateFilter]);

  const totals = useMemo(() => {
    // Apply date filter for counts if date is set
    let filteredForCounts = payables;
    if (scheduledDateFilter) {
      filteredForCounts = payables.filter(p => {
        if (!p.scheduled_payment_date) return true; // unscheduled always included
        const scheduledDate = parseISO(p.scheduled_payment_date);
        return scheduledDate <= scheduledDateFilter;
      });
    }
    
    return {
      totalDue: payables.reduce((sum, p) => sum + p.amount_due, 0),
      scheduled: filteredForCounts.filter(p => p.scheduled_payment_date).length,
      unscheduled: filteredForCounts.filter(p => !p.scheduled_payment_date).length,
      totalScheduledAmount: filteredForCounts
        .filter(p => p.scheduled_payment_date)
        .reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0),
    };
  }, [payables, scheduledDateFilter]);

  // Group payables by project
  const groupedPayables = useMemo(() => {
    if (!groupByProject) return null;
    
    const groups = new Map<string, {
      project_id: string;
      project_number: number;
      project_name: string;
      project_address: string | null;
      project_current_cash: number;
      total_ap: number;
      cash_if_all_paid: number;
      bills: PayableWithCashImpact[];
    }>();
    
    filteredPayables.forEach(p => {
      if (!groups.has(p.project_id)) {
        groups.set(p.project_id, {
          project_id: p.project_id,
          project_number: p.project_number,
          project_name: p.project_name,
          project_address: p.project_address,
          project_current_cash: p.project_current_cash,
          total_ap: p.total_project_payables,
          cash_if_all_paid: p.cash_if_all_project_payables_paid,
          bills: [],
        });
      }
      groups.get(p.project_id)!.bills.push(p);
    });
    
    return Array.from(groups.values()).sort((a, b) => b.total_ap - a.total_ap);
  }, [filteredPayables, groupByProject]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => toggleSort(field)}
    >
      {children}
      <ArrowUpDown className={cn("ml-1 h-3 w-3", sortField === field && "text-primary")} />
    </Button>
  );

  // Filter bill payments by search
  const filteredBillPayments = useMemo(() => {
    if (!historySearch) return billPayments;
    const lower = historySearch.toLowerCase();
    return billPayments.filter((bp: any) => {
      const project = bp.project_bills?.projects;
      const bill = bp.project_bills;
      return (
        project?.project_name?.toLowerCase().includes(lower) ||
        project?.project_address?.toLowerCase().includes(lower) ||
        bill?.installer_company?.toLowerCase().includes(lower) ||
        bill?.bill_ref?.toLowerCase().includes(lower) ||
        String(project?.project_number).includes(lower)
      );
    });
  }, [billPayments, historySearch]);

  // Calculate total paid in history
  const historyTotalPaid = useMemo(() => {
    return filteredBillPayments.reduce((sum: number, bp: any) => sum + (bp.payment_amount || 0), 0);
  }, [filteredBillPayments]);

  return (
    <Sheet open={open} onOpenChange={hideCloseButton ? undefined : onOpenChange}>
      <SheetContent className="w-full sm:max-w-[85rem] overflow-y-auto" hideCloseButton={hideCloseButton}>
        <SheetHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Accounts Payable</SheetTitle>
              <SheetDescription>
                  {activeTab === "outstanding" ? (
                    <>
                      {payables.length} unpaid bills totaling {formatCurrencyWithDecimals(totals.totalDue)}
                      {totals.totalScheduledAmount > 0 && (
                        <span className="ml-2 text-primary font-medium">
                          • {formatCurrencyWithDecimals(totals.totalScheduledAmount)} scheduled
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {filteredBillPayments.length} payments totaling {formatCurrencyWithDecimals(historyTotalPaid)}
                    </>
                  )}
              </SheetDescription>
            </div>
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
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-2 border-b no-print">
            <button
              onClick={() => setActiveTab("outstanding")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "outstanding"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Outstanding ({payables.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "history"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Paid History ({billPayments.length})
            </button>
          </div>

          {activeTab === "outstanding" ? (
            <>
              {/* Controls row */}
              <div className="flex items-center justify-between gap-4 no-print flex-wrap">
            {/* Summary badges - clickable filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <Badge 
                variant="outline" 
                className={cn(
                  "cursor-pointer transition-colors",
                  scheduleFilter === 'scheduled' 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted/50 hover:bg-muted"
                )}
                onClick={() => toggleScheduleFilter('scheduled')}
              >
                {totals.scheduled} Scheduled
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(
                  "cursor-pointer transition-colors",
                  scheduleFilter === 'unscheduled' 
                    ? "bg-amber-500 text-white border-amber-500" 
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                )}
                onClick={() => toggleScheduleFilter('unscheduled')}
              >
                {totals.unscheduled} Unscheduled
              </Badge>
              {scheduleFilter !== 'all' && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer bg-muted/50 hover:bg-muted"
                  onClick={() => setScheduleFilter('all')}
                >
                  Clear filter
                </Badge>
              )}
            </div>

            {/* Date filter and Group by toggle */}
            <div className="flex gap-2 items-center">
              {/* Scheduled Date Filter */}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !scheduledDateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {scheduledDateFilter ? (
                      <>Due by {format(scheduledDateFilter, "MMM d")}</>
                    ) : (
                      "Filter by date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={scheduledDateFilter}
                    onSelect={(date) => {
                      setScheduledDateFilter(date);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {scheduledDateFilter && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setScheduledDateFilter(undefined)}
                  title="Clear date filter"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Group by toggle */}
              <Button
                variant={groupByProject ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByProject(!groupByProject)}
                className="shrink-0"
              >
                {groupByProject ? <List className="h-4 w-4 mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
                {groupByProject ? "Flat View" : "Group by Project"}
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by project, vendor, or bill ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="no-print w-[50px]"></TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    <SortButton field="scheduled_payment_date">Scheduled<br/>Date</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">Scheduled<br/>Amount</TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="cash_after_payment">Cash After<br/>Payment</SortButton>
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>
                    <SortButton field="vendor">Vendor</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">Total<br/>Bill</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Paid to<br/>Date</TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="amount_due">Balance<br/>Due</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="project_current_cash">Project<br/>Cash</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">Total Project<br/>AP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupByProject && groupedPayables ? (
                  // Grouped view
                  groupedPayables.map((group) => (
                    <>
                      {/* Project header row */}
                      <TableRow 
                        key={`group-${group.project_id}`}
                        className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                        onClick={() => onProjectClick?.(group.project_id)}
                      >
                        <TableCell className="no-print" />
                        <TableCell />
                        <TableCell />
                        <TableCell className={cn(
                          "text-center font-semibold",
                          group.cash_if_all_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrencyWithDecimals(group.cash_if_all_paid)}
                        </TableCell>
                        <TableCell className="font-semibold" colSpan={2}>
                          <div className="flex flex-col">
                            <span>{group.project_address || group.project_name}</span>
                            {group.project_address && (
                              <span className="text-xs text-muted-foreground">{group.project_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatCurrencyWithDecimals(group.bills.reduce((sum, b) => sum + b.total_bill, 0))}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatCurrencyWithDecimals(group.bills.reduce((sum, b) => sum + b.amount_paid, 0))}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatCurrencyWithDecimals(group.bills.reduce((sum, b) => sum + b.amount_due, 0))}
                        </TableCell>
                        <TableCell className={cn(
                          "text-center font-semibold",
                          group.project_current_cash >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrencyWithDecimals(group.project_current_cash)}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-muted-foreground">
                          {formatCurrencyWithDecimals(group.total_ap)}
                        </TableCell>
                      </TableRow>
                      {/* Bill rows */}
                      {group.bills.map((payable) => {
                        const cashAfterPayment = getCashAfterAllScheduledPayments(payable, payables, scheduledDateFilter);
                        return (
                        <TableRow
                          key={payable.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onProjectClick?.(payable.project_id, "finance", "payables", "bills")}
                        >
                          <TableCell className="no-print">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSchedulePayment?.(payable, scheduledDateFilter);
                              }}
                            >
                              {payable.scheduled_payment_date ? (
                                <Pencil className="h-4 w-4" />
                              ) : (
                                <Calendar className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            {payable.scheduled_payment_date ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                {new Date(payable.scheduled_payment_date).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                          {payable.scheduled_payment_amount ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-medium text-primary">{formatCurrencyWithDecimals(payable.scheduled_payment_amount)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 no-print"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsPaid?.(payable);
                                  }}
                                  title="Mark as Paid"
                                >
                                  <Circle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className={cn(
                            "text-center",
                            cashAfterPayment !== null 
                              ? (cashAfterPayment >= 0 ? 'text-emerald-600' : 'text-red-600')
                              : 'text-muted-foreground'
                          )}>
                            {cashAfterPayment !== null ? formatCurrencyWithDecimals(cashAfterPayment) : '-'}
                          </TableCell>
                          <TableCell className="pl-8 text-muted-foreground text-sm">
                            └ Bill
                          </TableCell>
                          <TableCell>{payable.vendor || '-'}</TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {formatCurrencyWithDecimals(payable.total_bill)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {payable.amount_paid > 0 ? formatCurrencyWithDecimals(payable.amount_paid) : '-'}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {formatCurrencyWithDecimals(payable.amount_due)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                        </TableRow>
                        );
                      })}
                    </>
                  ))
                ) : (
                  // Flat view
                  filteredPayables.map((payable) => {
                    const cashAfterPayment = getCashAfterAllScheduledPayments(payable, payables, scheduledDateFilter);
                    return (
                      <TableRow
                        key={payable.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onProjectClick?.(payable.project_id, "finance", "payables", "bills")}
                      >
                        <TableCell className="no-print">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSchedulePayment?.(payable, scheduledDateFilter);
                            }}
                          >
                            {payable.scheduled_payment_date ? (
                              <Pencil className="h-4 w-4" />
                            ) : (
                              <Calendar className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          {payable.scheduled_payment_date ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              {new Date(payable.scheduled_payment_date).toLocaleDateString()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {payable.scheduled_payment_amount ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-medium text-primary">{formatCurrencyWithDecimals(payable.scheduled_payment_amount)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 no-print"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAsPaid?.(payable);
                                }}
                                title="Mark as Paid"
                              >
                                <Circle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "text-center",
                          cashAfterPayment !== null 
                            ? (cashAfterPayment >= 0 ? 'text-emerald-600' : 'text-red-600')
                            : 'text-muted-foreground'
                        )}>
                          {cashAfterPayment !== null ? formatCurrencyWithDecimals(cashAfterPayment) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex flex-col">
                            <span className="truncate">{payable.project_address || payable.project_name}</span>
                            {payable.project_address && (
                              <span className="text-xs text-muted-foreground truncate">{payable.project_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{payable.vendor || '-'}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {formatCurrencyWithDecimals(payable.total_bill)}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {payable.amount_paid > 0 ? formatCurrencyWithDecimals(payable.amount_paid) : '-'}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatCurrencyWithDecimals(payable.amount_due)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-center",
                          payable.project_current_cash >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrencyWithDecimals(payable.project_current_cash)}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {formatCurrencyWithDecimals(payable.total_project_payables)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {filteredPayables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No payables found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
            </>
          ) : (
            /* Paid History Tab */
            <>
              {/* Date Range Filter */}
              <div className="flex items-center gap-4 no-print flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Popover open={historyStartPickerOpen} onOpenChange={setHistoryStartPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {historyStartDate ? format(historyStartDate, "MMM d, yyyy") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={historyStartDate}
                        onSelect={(date) => {
                          if (date) setHistoryStartDate(date);
                          setHistoryStartPickerOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Popover open={historyEndPickerOpen} onOpenChange={setHistoryEndPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {historyEndDate ? format(historyEndDate, "MMM d, yyyy") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={historyEndDate}
                        onSelect={(date) => {
                          if (date) setHistoryEndDate(date);
                          setHistoryEndPickerOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {filteredBillPayments.length} payments • {formatCurrencyWithDecimals(historyTotalPaid)}
                </Badge>
              </div>

              {/* Search */}
              <div className="relative no-print">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project, vendor, or bill ref..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* History Table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table className="print-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Cash Left</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Bank</TableHead>
                      {isAdmin && <TableHead className="w-[50px] no-print"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPayments ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredBillPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">
                          No payments found in this date range
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBillPayments.map((bp: any) => {
                        const project = bp.project_bills?.projects;
                        const bill = bp.project_bills;
                        const cashLeft = bp.projectCashLeft;
                        return (
                          <TableRow
                            key={bp.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (project?.id && bill?.id) {
                                onBillClick?.(project.id, bill.id);
                              }
                            }}
                          >
                            <TableCell className="text-sm">
                              {bp.payment_date ? format(parseISO(bp.payment_date), "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium truncate">
                                  #{project?.project_number} - {project?.project_address || project?.project_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{bill?.installer_company || "-"}</TableCell>
                            <TableCell className="text-sm">{bill?.category || "-"}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate" title={bill?.memo || ""}>
                              {bill?.memo || "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {formatCurrencyWithDecimals(bp.payment_amount)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right text-sm font-medium",
                              cashLeft !== undefined && cashLeft !== null && cashLeft < 0 && "text-destructive"
                            )}>
                              {cashLeft !== undefined && cashLeft !== null ? formatCurrencyWithDecimals(cashLeft) : "-"}
                            </TableCell>
                            <TableCell className="text-sm">{bp.payment_method || "-"}</TableCell>
                            <TableCell className="text-sm">{bp.payment_reference || "-"}</TableCell>
                            <TableCell className="text-sm">{bp.bank_name || "-"}</TableCell>
                            {isAdmin && (
                              <TableCell className="no-print">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleDeletePayment(bp.id, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>

      {/* Delete Payment Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
