import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar, Printer, Search, ArrowUpDown, Layers, List } from "lucide-react";
import { PayableWithCashImpact } from "@/hooks/useProductionAnalytics";

interface PayablesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payables: PayableWithCashImpact[];
  onProjectClick?: (projectId: string) => void;
  onSchedulePayment?: (payable: PayableWithCashImpact) => void;
}

type SortField = 'project_number' | 'vendor' | 'amount_due' | 'project_current_cash' | 'cash_if_this_paid' | 'scheduled_payment_date';
type SortDir = 'asc' | 'desc';

export function PayablesSheet({
  open,
  onOpenChange,
  payables,
  onProjectClick,
  onSchedulePayment,
}: PayablesSheetProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('amount_due');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [groupByProject, setGroupByProject] = useState(false);

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
        case 'cash_if_this_paid':
          cmp = a.cash_if_this_paid - b.cash_if_this_paid;
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
  }, [payables, search, sortField, sortDir, scheduleFilter]);

  const totals = useMemo(() => ({
    totalDue: payables.reduce((sum, p) => sum + p.amount_due, 0),
    scheduled: payables.filter(p => p.scheduled_payment_date).length,
    unscheduled: payables.filter(p => !p.scheduled_payment_date).length,
  }), [payables]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-7xl overflow-y-auto">
        <SheetHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Outstanding Payables (AP)</SheetTitle>
              <SheetDescription>
                {payables.length} unpaid bills totaling {formatCurrency(totals.totalDue)}
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
          {/* Controls row */}
          <div className="flex items-center justify-between gap-4 no-print">
            {/* Summary badges - clickable filters */}
            <div className="flex gap-2 flex-wrap">
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
                  <TableHead className="no-print w-[80px]">Action</TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    <SortButton field="scheduled_payment_date">Scheduled<br/>Date</SortButton>
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>
                    <SortButton field="vendor">Vendor</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="amount_due">Amount<br/>Due</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="project_current_cash">Project<br/>Cash</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <SortButton field="cash_if_this_paid">If<br/>Paid</SortButton>
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">Total<br/>AP</TableHead>
                  <TableHead className="text-center whitespace-nowrap">If All<br/>Paid</TableHead>
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
                        <TableCell className="font-semibold" colSpan={2}>
                          <div className="flex flex-col">
                            <span>{group.project_address || group.project_name}</span>
                            {group.project_address && (
                              <span className="text-xs text-muted-foreground">{group.project_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatCurrency(group.bills.reduce((sum, b) => sum + b.amount_due, 0))}
                        </TableCell>
                        <TableCell className={cn(
                          "text-center font-semibold",
                          group.project_current_cash >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrency(group.project_current_cash)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-center font-semibold text-muted-foreground">
                          {formatCurrency(group.total_ap)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-center font-semibold",
                          group.cash_if_all_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrency(group.cash_if_all_paid)}
                        </TableCell>
                      </TableRow>
                      {/* Bill rows */}
                      {group.bills.map((payable) => (
                        <TableRow
                          key={payable.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onProjectClick?.(payable.project_id)}
                        >
                          <TableCell className="no-print">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSchedulePayment?.(payable);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Schedule
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            {payable.scheduled_payment_date ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(payable.scheduled_payment_date).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="pl-8 text-muted-foreground text-sm">
                            └ Bill
                          </TableCell>
                          <TableCell>{payable.vendor || '-'}</TableCell>
                          <TableCell className="text-center font-medium">
                            {formatCurrency(payable.amount_due)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className={cn(
                            "text-center",
                            payable.cash_if_this_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                          )}>
                            {formatCurrency(payable.cash_if_this_paid)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))
                ) : (
                  // Flat view
                  filteredPayables.map((payable) => (
                    <TableRow
                      key={payable.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onProjectClick?.(payable.project_id)}
                    >
                      <TableCell className="no-print">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSchedulePayment?.(payable);
                          }}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Schedule
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        {payable.scheduled_payment_date ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(payable.scheduled_payment_date).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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
                      <TableCell className="text-center font-medium">
                        {formatCurrency(payable.amount_due)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-center",
                        payable.project_current_cash >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatCurrency(payable.project_current_cash)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-center",
                        payable.cash_if_this_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatCurrency(payable.cash_if_this_paid)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatCurrency(payable.total_project_payables)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-center",
                        payable.cash_if_all_project_payables_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatCurrency(payable.cash_if_all_project_payables_paid)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {filteredPayables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No payables found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
