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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar, Printer, X, List, LineChart } from "lucide-react";
import { PayableWithCashImpact, CashFlowTimelinePoint } from "@/hooks/useProductionAnalytics";
import { CashFlowTimelineChart } from "./CashFlowTimelineChart";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

interface PaymentScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledPayments: PayableWithCashImpact[];
  cashFlowTimeline: CashFlowTimelinePoint[];
  onClearSchedule: (billId: string) => void;
  onProjectClick?: (projectId: string) => void;
}

export function PaymentScheduleSheet({
  open,
  onOpenChange,
  scheduledPayments,
  cashFlowTimeline,
  onClearSchedule,
  onProjectClick,
}: PaymentScheduleSheetProps) {
  const [activeTab, setActiveTab] = useState("list");

  // Calculate summary stats
  const summary = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const thisWeek = scheduledPayments.filter(p => {
      if (!p.scheduled_payment_date) return false;
      const date = parseISO(p.scheduled_payment_date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    const thisMonth = scheduledPayments.filter(p => {
      if (!p.scheduled_payment_date) return false;
      const date = parseISO(p.scheduled_payment_date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    return {
      totalScheduled: scheduledPayments.length,
      totalAmount: scheduledPayments.reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0),
      thisWeekCount: thisWeek.length,
      thisWeekAmount: thisWeek.reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0),
      thisMonthCount: thisMonth.length,
      thisMonthAmount: thisMonth.reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0),
    };
  }, [scheduledPayments]);

  // Sort by date
  const sortedPayments = useMemo(() => {
    return [...scheduledPayments].sort((a, b) => {
      if (!a.scheduled_payment_date) return 1;
      if (!b.scheduled_payment_date) return -1;
      return new Date(a.scheduled_payment_date).getTime() - new Date(b.scheduled_payment_date).getTime();
    });
  }, [scheduledPayments]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Payment Schedule</SheetTitle>
              <SheetDescription>
                {summary.totalScheduled} payments scheduled totaling {formatCurrency(summary.totalAmount)}
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
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 no-print">
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{summary.thisWeekCount}</p>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-sm font-medium text-primary">{formatCurrency(summary.thisWeekAmount)}</p>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{summary.thisMonthCount}</p>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-sm font-medium text-primary">{formatCurrency(summary.thisMonthAmount)}</p>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{summary.totalScheduled}</p>
              <p className="text-sm text-muted-foreground">Total Scheduled</p>
              <p className="text-sm font-medium text-primary">{formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="no-print">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-1.5">
                <List className="h-4 w-4" />
                Scheduled Payments
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                <LineChart className="h-4 w-4" />
                Timeline View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              {sortedPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payments scheduled</p>
                  <p className="text-sm">Schedule bill payments from the Outstanding AP view</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table className="print-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Bill Ref</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Project Cash</TableHead>
                        <TableHead className="no-print">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPayments.map((payment) => (
                        <TableRow
                          key={payment.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onProjectClick?.(payment.project_id)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <Calendar className="h-3 w-3 mr-1" />
                              {payment.scheduled_payment_date
                                ? new Date(payment.scheduled_payment_date).toLocaleDateString()
                                : '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{payment.project_number}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {payment.project_address || payment.project_name}
                          </TableCell>
                          <TableCell>{payment.vendor || '-'}</TableCell>
                          <TableCell>{payment.bill_ref || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.scheduled_payment_amount || payment.amount_due)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right",
                            payment.cash_if_this_paid >= 0 ? 'text-emerald-600' : 'text-red-600'
                          )}>
                            {formatCurrency(payment.cash_if_this_paid)}
                          </TableCell>
                          <TableCell className="no-print">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClearSchedule(payment.id);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <CashFlowTimelineChart data={cashFlowTimeline} />
            </TabsContent>
          </Tabs>

          {/* Print-only table */}
          <div className="hidden print-only">
            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill Ref</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.scheduled_payment_date
                        ? new Date(payment.scheduled_payment_date).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>{payment.project_number}</TableCell>
                    <TableCell>{payment.project_address || payment.project_name}</TableCell>
                    <TableCell>{payment.vendor || '-'}</TableCell>
                    <TableCell>{payment.bill_ref || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.scheduled_payment_amount || payment.amount_due)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
