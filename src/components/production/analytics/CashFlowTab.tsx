import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "./MetricCard";
import { ProjectWithFinancials, InvoiceWithAging, BankTransaction, PayableWithCashImpact, CashFlowTimelinePoint } from "@/hooks/useProductionAnalytics";
import { Banknote, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Wallet, Calendar } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { CashFlowKPISheet, CashFlowKPIType } from "./CashFlowKPISheet";
import { PayablesSheet } from "./PayablesSheet";
import { PaymentScheduleSheet } from "./PaymentScheduleSheet";
import { SchedulePaymentDialog } from "./SchedulePaymentDialog";
import { MarkAsPaidDialog } from "./MarkAsPaidDialog";
import { ProjectAmountDetailSheet, AmountType } from "./ProjectAmountDetailSheet";

interface CashFlowTabProps {
  projects: ProjectWithFinancials[];
  totals: {
    totalCollected: number;
    totalBillsPaid: number;
    totalReceivables: number;
    totalPayables: number;
    cashPosition: number;
  };
  invoicesWithAging: InvoiceWithAging[];
  bankTransactions: BankTransaction[];
  payablesWithCashImpact: PayableWithCashImpact[];
  cashFlowTimeline: CashFlowTimelinePoint[];
  scheduledPayments: PayableWithCashImpact[];
  onProjectClick?: (projectId: string, initialTab?: string, returnTo?: 'payables', financeSubTab?: 'bills' | 'history') => void;
  onSchedulePayment?: (billId: string, date: Date, amount: number) => void;
  onClearSchedule?: (billId: string) => void;
  onMarkAsPaid?: (billId: string, data: {
    paymentDate: Date;
    amount: number;
    bankName: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
  }) => void;
  reopenPayablesSheet?: boolean;
  onPayablesSheetOpened?: () => void;
  hideCloseButton?: boolean;
  openARKPIOnLoad?: boolean;
}

const getCashStatusColor = (status: string) => {
  switch (status) {
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'low':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'negative':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'overdue':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getCashStatusLabel = (status: string) => {
  switch (status) {
    case 'positive':
      return 'Cash Positive';
    case 'low':
      return 'Low Collection';
    case 'negative':
      return 'Cash Negative';
    case 'overdue':
      return 'Overdue AR';
    default:
      return 'Unknown';
  }
};

export function CashFlowTab({ 
  projects, 
  totals, 
  invoicesWithAging,
  bankTransactions,
  payablesWithCashImpact,
  cashFlowTimeline,
  scheduledPayments,
  onProjectClick,
  onSchedulePayment,
  onClearSchedule,
  onMarkAsPaid,
  reopenPayablesSheet,
  onPayablesSheetOpened,
  hideCloseButton,
  openARKPIOnLoad,
}: CashFlowTabProps) {
  // Sheet states
  const [selectedKPI, setSelectedKPI] = useState<CashFlowKPIType | null>(null);
  const [kpiSheetOpen, setKpiSheetOpen] = useState(false);
  const [payablesSheetOpen, setPayablesSheetOpen] = useState(false);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [schedulingPayable, setSchedulingPayable] = useState<PayableWithCashImpact | null>(null);
  const [scheduledDateFilter, setScheduledDateFilter] = useState<Date | undefined>(undefined);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [markingAsPaidPayable, setMarkingAsPaidPayable] = useState<PayableWithCashImpact | null>(null);
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  
  // Reopen payables sheet when flag is set
  useEffect(() => {
    if (reopenPayablesSheet) {
      setPayablesSheetOpen(true);
      onPayablesSheetOpened?.();
    }
  }, [reopenPayablesSheet, onPayablesSheetOpened]);

  // Open AR KPI sheet when openARKPIOnLoad is set
  useEffect(() => {
    if (openARKPIOnLoad) {
      setSelectedKPI('outstandingAR');
      setKpiSheetOpen(true);
    }
  }, [openARKPIOnLoad]);
  
  // Project amount detail states
  const [amountDetailOpen, setAmountDetailOpen] = useState(false);
  const [selectedAmountProject, setSelectedAmountProject] = useState<ProjectWithFinancials | null>(null);
  const [selectedAmountType, setSelectedAmountType] = useState<AmountType | null>(null);

  const handleAmountClick = (e: React.MouseEvent, project: ProjectWithFinancials, amountType: AmountType) => {
    e.stopPropagation();
    setSelectedAmountProject(project);
    setSelectedAmountType(amountType);
    setAmountDetailOpen(true);
  };

  // Summary counts
  const statusCounts = useMemo(() => {
    return projects.reduce((acc, p) => {
      acc[p.cashStatus] = (acc[p.cashStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [projects]);

  // Sort projects by cash status priority (worst first)
  const sortedProjects = useMemo(() => {
    const priority = { negative: 0, overdue: 1, low: 2, positive: 3 };
    return [...projects].sort((a, b) => {
      const priorityDiff = priority[a.cashStatus] - priority[b.cashStatus];
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(b.cashPosition) - Math.abs(a.cashPosition);
    });
  }, [projects]);

  // Projects needing attention
  const problemProjects = sortedProjects.filter(p => 
    p.cashStatus === 'negative' || p.cashStatus === 'overdue' || p.cashStatus === 'low'
  );

  const handleKPIClick = (kpi: CashFlowKPIType) => {
    if (kpi === 'outstandingAP') {
      setPayablesSheetOpen(true);
    } else {
      setSelectedKPI(kpi);
      setKpiSheetOpen(true);
    }
  };

  const handleSchedulePayment = (payable: PayableWithCashImpact, dateFilter?: Date) => {
    setSchedulingPayable(payable);
    setScheduledDateFilter(dateFilter);
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = (billId: string, date: Date, amount: number) => {
    onSchedulePayment?.(billId, date, amount);
    setScheduleDialogOpen(false);
    setSchedulingPayable(null);
  };

  const handleMarkAsPaid = (payable: PayableWithCashImpact) => {
    setMarkingAsPaidPayable(payable);
    setMarkAsPaidDialogOpen(true);
  };

  const handleSaveMarkAsPaid = (billId: string, data: {
    paymentDate: Date;
    amount: number;
    bankName: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
  }) => {
    onMarkAsPaid?.(billId, data);
    setMarkAsPaidDialogOpen(false);
    setMarkingAsPaidPayable(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Payment Schedule button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setScheduleSheetOpen(true)}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Payment Schedule
          {scheduledPayments.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {scheduledPayments.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* KPI Cards - Now Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Cash Position"
          value={formatCurrency(totals.cashPosition)}
          subValue="Collected - Paid"
          icon={Banknote}
          variant={totals.cashPosition >= 0 ? 'success' : 'danger'}
          onClick={() => handleKPIClick('cashPosition')}
        />
        <MetricCard
          title="Total Collected"
          value={formatCurrency(totals.totalCollected)}
          subValue="Payments received"
          icon={ArrowDownToLine}
          variant="success"
          onClick={() => handleKPIClick('totalCollected')}
        />
        <MetricCard
          title="Bills Paid"
          value={formatCurrency(totals.totalBillsPaid)}
          subValue="Vendor payments"
          icon={ArrowUpFromLine}
          onClick={() => handleKPIClick('billsPaid')}
        />
        <MetricCard
          title="Outstanding AR"
          value={formatCurrency(totals.totalReceivables)}
          subValue="To collect"
          icon={Wallet}
          variant={totals.totalReceivables > 0 ? 'warning' : 'default'}
          onClick={() => handleKPIClick('outstandingAR')}
        />
        <MetricCard
          title="Outstanding AP"
          value={formatCurrency(totals.totalPayables)}
          subValue="Bills unpaid"
          icon={AlertTriangle}
          variant={totals.totalPayables > 0 ? 'warning' : 'default'}
          onClick={() => handleKPIClick('outstandingAP')}
        />
        <MetricCard
          title="Projects At Risk"
          value={problemProjects.length.toString()}
          subValue={`of ${projects.length} total`}
          icon={AlertTriangle}
          variant={problemProjects.length > 0 ? 'danger' : 'success'}
          onClick={() => handleKPIClick('projectsAtRisk')}
        />
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cn("border-2", getCashStatusColor('positive'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.positive || 0}</p>
            <p className="text-sm font-medium">Cash Positive</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('low'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.low || 0}</p>
            <p className="text-sm font-medium">Low Collection</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('negative'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.negative || 0}</p>
            <p className="text-sm font-medium">Cash Negative</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('overdue'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.overdue || 0}</p>
            <p className="text-sm font-medium">Overdue AR</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Cash Status Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Project Cash Status</CardTitle>
          <CardDescription>All projects sorted by cash health (worst first)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Bills Paid</TableHead>
                  <TableHead className="text-right">Cash Position</TableHead>
                  <TableHead className="text-right">AR Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.slice(0, 100).map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onProjectClick?.(project.id)}
                  >
                    <TableCell className="font-medium">{project.project_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {project.project_address || project.project_name}
                    </TableCell>
                    <TableCell>{project.primary_salesperson || '-'}</TableCell>
                    <TableCell 
                      className="text-right hover:underline hover:text-primary cursor-pointer"
                      onClick={(e) => handleAmountClick(e, project, 'contract')}
                    >
                      {formatCurrency(project.contractsTotal)}
                    </TableCell>
                    <TableCell 
                      className="text-right hover:underline hover:text-primary cursor-pointer"
                      onClick={(e) => handleAmountClick(e, project, 'collected')}
                    >
                      {formatCurrency(project.invoicesCollected)}
                    </TableCell>
                    <TableCell 
                      className="text-right hover:underline hover:text-primary cursor-pointer"
                      onClick={(e) => handleAmountClick(e, project, 'billsPaid')}
                    >
                      {formatCurrency(project.totalBillsPaid)}
                    </TableCell>
                    <TableCell 
                      className={cn(
                        "text-right font-medium hover:underline cursor-pointer",
                        project.cashPosition >= 0 ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'
                      )}
                      onClick={(e) => handleAmountClick(e, project, 'cashPosition')}
                    >
                      {formatCurrency(project.cashPosition)}
                    </TableCell>
                    <TableCell 
                      className={cn(
                        "text-right hover:underline cursor-pointer",
                        project.invoiceBalanceDue > 0 ? 'text-amber-600 hover:text-amber-700' : ''
                      )}
                      onClick={(e) => handleAmountClick(e, project, 'arBalance')}
                    >
                      {formatCurrency(project.invoiceBalanceDue)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getCashStatusColor(project.cashStatus))}
                      >
                        {getCashStatusLabel(project.cashStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sheets and Dialogs */}
      <CashFlowKPISheet
        open={kpiSheetOpen}
        onOpenChange={setKpiSheetOpen}
        kpiType={selectedKPI}
        projects={projects}
        invoicesWithAging={invoicesWithAging}
        bankTransactions={bankTransactions}
        onProjectClick={onProjectClick}
        hideCloseButton={hideCloseButton}
      />

      <PayablesSheet
        open={payablesSheetOpen}
        onOpenChange={setPayablesSheetOpen}
        payables={payablesWithCashImpact}
        onProjectClick={onProjectClick}
        onBillClick={(projectId, billId) => {
          setPayablesSheetOpen(false);
          onProjectClick?.(projectId, "finance", "payables", "history");
        }}
        onSchedulePayment={handleSchedulePayment}
        onMarkAsPaid={handleMarkAsPaid}
        hideCloseButton={hideCloseButton}
      />

      <PaymentScheduleSheet
        open={scheduleSheetOpen}
        onOpenChange={setScheduleSheetOpen}
        scheduledPayments={scheduledPayments}
        cashFlowTimeline={cashFlowTimeline}
        onClearSchedule={(billId) => onClearSchedule?.(billId)}
        onProjectClick={onProjectClick}
      />

      <SchedulePaymentDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        payable={schedulingPayable}
        allPayables={payablesWithCashImpact}
        scheduledDateFilter={scheduledDateFilter}
        onSave={handleSaveSchedule}
        onDelete={(billId) => onClearSchedule?.(billId)}
      />

      <MarkAsPaidDialog
        open={markAsPaidDialogOpen}
        onOpenChange={setMarkAsPaidDialogOpen}
        payable={markingAsPaidPayable}
        onSave={handleSaveMarkAsPaid}
      />

      <ProjectAmountDetailSheet
        open={amountDetailOpen}
        onOpenChange={setAmountDetailOpen}
        projectId={selectedAmountProject?.id || null}
        projectNumber={selectedAmountProject?.project_number || 0}
        projectName={selectedAmountProject?.project_address || selectedAmountProject?.project_name || ''}
        amountType={selectedAmountType}
      />
    </div>
  );
}
