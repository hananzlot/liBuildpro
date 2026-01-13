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
import { Toggle } from "@/components/ui/toggle";
import { cn, formatCurrency } from "@/lib/utils";
import { Printer, Search, Layers } from "lucide-react";
import { ProjectWithFinancials, InvoiceWithAging, BankTransaction } from "@/hooks/useProductionAnalytics";

export type CashFlowKPIType = 'cashPosition' | 'totalCollected' | 'billsPaid' | 'outstandingAR' | 'outstandingAP' | 'projectsAtRisk';

interface CashFlowKPISheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: CashFlowKPIType | null;
  projects: ProjectWithFinancials[];
  invoicesWithAging: InvoiceWithAging[];
  bankTransactions: BankTransaction[];
  onProjectClick?: (projectId: string) => void;
}

const KPI_TITLES: Record<CashFlowKPIType, string> = {
  cashPosition: 'Cash Position by Project',
  totalCollected: 'Payment Transactions Received',
  billsPaid: 'Bill Payments Made',
  outstandingAR: 'Outstanding Receivables (AR)',
  outstandingAP: 'Outstanding Payables (AP)',
  projectsAtRisk: 'Projects At Risk',
};

const KPI_DESCRIPTIONS: Record<CashFlowKPIType, string> = {
  cashPosition: 'All projects sorted by current cash position',
  totalCollected: 'All payment transactions received from customers',
  billsPaid: 'All payments made to vendors and subcontractors',
  outstandingAR: 'Unpaid invoices with aging analysis',
  outstandingAP: 'All unpaid bills with cash impact projections',
  projectsAtRisk: 'Projects with negative cash, low collection, or overdue AR',
};

export function CashFlowKPISheet({
  open,
  onOpenChange,
  kpiType,
  projects,
  invoicesWithAging,
  bankTransactions,
  onProjectClick,
}: CashFlowKPISheetProps) {
  const [search, setSearch] = useState("");

  if (!kpiType) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{KPI_TITLES[kpiType]}</SheetTitle>
              <SheetDescription>{KPI_DESCRIPTIONS[kpiType]}</SheetDescription>
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
          {/* Search */}
          <div className="relative no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Content based on KPI type */}
          {kpiType === 'cashPosition' && (
            <CashPositionContent
              projects={projects}
              search={search}
              onProjectClick={onProjectClick}
            />
          )}
          {kpiType === 'totalCollected' && (
            <TransactionsContent
              transactions={bankTransactions.filter(t => t.type === 'in')}
              search={search}
              onProjectClick={onProjectClick}
              type="in"
            />
          )}
          {kpiType === 'billsPaid' && (
            <TransactionsContent
              transactions={bankTransactions.filter(t => t.type === 'out')}
              search={search}
              onProjectClick={onProjectClick}
              type="out"
            />
          )}
          {kpiType === 'outstandingAR' && (
            <ARContent
              invoices={invoicesWithAging}
              search={search}
              onProjectClick={onProjectClick}
            />
          )}
          {kpiType === 'projectsAtRisk' && (
            <ProjectsAtRiskContent
              projects={projects}
              search={search}
              onProjectClick={onProjectClick}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Cash Position Content
function CashPositionContent({
  projects,
  search,
  onProjectClick,
}: {
  projects: ProjectWithFinancials[];
  search: string;
  onProjectClick?: (projectId: string) => void;
}) {
  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return projects
      .filter(p =>
        !search ||
        p.project_name.toLowerCase().includes(lower) ||
        p.project_address?.toLowerCase().includes(lower) ||
        String(p.project_number).includes(lower) ||
        p.primary_salesperson?.toLowerCase().includes(lower)
      )
      .sort((a, b) => a.cashPosition - b.cashPosition);
  }, [projects, search]);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table className="print-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Salesperson</TableHead>
            <TableHead className="text-right">Contract</TableHead>
            <TableHead className="text-right">Collected</TableHead>
            <TableHead className="text-right">Bills Paid</TableHead>
            <TableHead className="text-right">Cash Position</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onProjectClick?.(p.id)}
            >
              <TableCell className="font-medium">{p.project_number}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {p.project_address || p.project_name}
              </TableCell>
              <TableCell>{p.primary_salesperson || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.contractsTotal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.invoicesCollected)}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.totalBillsPaid)}</TableCell>
              <TableCell className={cn(
                "text-right font-medium",
                p.cashPosition >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {formatCurrency(p.cashPosition)}
              </TableCell>
              <TableCell>
                <CashStatusBadge status={p.cashStatus} />
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No projects found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Transactions Content
function TransactionsContent({
  transactions,
  search,
  onProjectClick,
  type,
}: {
  transactions: BankTransaction[];
  search: string;
  onProjectClick?: (projectId: string) => void;
  type: 'in' | 'out';
}) {
  const [groupByVendor, setGroupByVendor] = useState(false);

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return transactions.filter(t =>
      !search ||
      t.project_name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.bank_or_method?.toLowerCase().includes(lower) ||
      t.vendor_name?.toLowerCase().includes(lower)
    );
  }, [transactions, search]);

  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  // Group by vendor for bill payments
  const groupedByVendor = useMemo(() => {
    if (!groupByVendor || type !== 'out') return null;
    
    const groups: Record<string, { vendor: string; vendorType: string | null; transactions: BankTransaction[]; total: number }> = {};
    
    filtered.forEach(t => {
      const vendor = t.vendor_name || 'Unknown Vendor';
      if (!groups[vendor]) {
        groups[vendor] = {
          vendor,
          vendorType: t.vendor_type || null,
          transactions: [],
          total: 0,
        };
      }
      groups[vendor].transactions.push(t);
      groups[vendor].total += t.amount;
    });
    
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [filtered, groupByVendor, type]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {type === 'out' && (
          <Toggle 
            pressed={groupByVendor} 
            onPressedChange={setGroupByVendor}
            size="sm"
            className="gap-2"
          >
            <Layers className="h-4 w-4" />
            Group by Vendor
          </Toggle>
        )}
        {type === 'in' && <div />}
        <Badge variant="outline" className={type === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}>
          Total: {formatCurrency(total)}
        </Badge>
      </div>

      {groupByVendor && groupedByVendor ? (
        <div className="space-y-4">
          {groupedByVendor.map((group) => (
            <div key={group.vendor} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">{group.vendor}</span>
                  {group.vendorType && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {group.vendorType}
                    </Badge>
                  )}
                </div>
                <span className="font-medium text-red-600">{formatCurrency(group.total)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Bank/Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.transactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => t.project_id && onProjectClick?.(t.project_id)}
                    >
                      <TableCell>
                        {t.date ? new Date(t.date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{t.project_name}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell>{t.bank_or_method || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          {groupedByVendor.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              No transactions found
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="print-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {type === 'out' && <TableHead>Vendor Name</TableHead>}
                <TableHead>Project</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Bank/Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => t.project_id && onProjectClick?.(t.project_id)}
                >
                  <TableCell>
                    {t.date ? new Date(t.date).toLocaleDateString() : '-'}
                  </TableCell>
                  {type === 'out' && (
                    <TableCell>{t.vendor_name || '-'}</TableCell>
                  )}
                  <TableCell className="max-w-[200px] truncate">{t.project_name}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    type === 'in' ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>{t.bank_or_method || '-'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={type === 'out' ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// AR Content
function ARContent({
  invoices,
  search,
  onProjectClick,
}: {
  invoices: InvoiceWithAging[];
  search: string;
  onProjectClick?: (projectId: string) => void;
}) {
  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return invoices.filter(i =>
      !search ||
      i.project_name.toLowerCase().includes(lower) ||
      i.phase_description?.toLowerCase().includes(lower) ||
      String(i.project_number).includes(lower)
    );
  }, [invoices, search]);

  const total = filtered.reduce((sum, i) => sum + (i.open_balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
          Total Outstanding: {formatCurrency(total)}
        </Badge>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table className="print-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Phase Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Aging</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => inv.project_id && onProjectClick?.(inv.project_id)}
              >
                <TableCell className="font-medium">{inv.project_number}</TableCell>
                <TableCell className="max-w-[150px] truncate">{inv.project_name}</TableCell>
                <TableCell>{inv.phase_description || '-'}</TableCell>
                <TableCell>
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(inv.amount || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(inv.payments_received || 0)}</TableCell>
                <TableCell className="text-right font-medium text-amber-600">
                  {formatCurrency(inv.open_balance || 0)}
                </TableCell>
                <TableCell className="text-right">{inv.daysOutstanding}</TableCell>
                <TableCell>
                  <AgingBadge bucket={inv.agingBucket} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No outstanding invoices
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Projects At Risk Content
function ProjectsAtRiskContent({
  projects,
  search,
  onProjectClick,
}: {
  projects: ProjectWithFinancials[];
  search: string;
  onProjectClick?: (projectId: string) => void;
}) {
  const filtered = useMemo(() => {
    const atRisk = projects.filter(p =>
      p.cashStatus === 'negative' || p.cashStatus === 'overdue' || p.cashStatus === 'low'
    );
    const lower = search.toLowerCase();
    return atRisk.filter(p =>
      !search ||
      p.project_name.toLowerCase().includes(lower) ||
      p.project_address?.toLowerCase().includes(lower) ||
      String(p.project_number).includes(lower)
    );
  }, [projects, search]);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table className="print-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Salesperson</TableHead>
            <TableHead className="text-right">Contract</TableHead>
            <TableHead className="text-right">Collected</TableHead>
            <TableHead className="text-right">Cash Position</TableHead>
            <TableHead className="text-right">AR Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onProjectClick?.(p.id)}
            >
              <TableCell className="font-medium">{p.project_number}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {p.project_address || p.project_name}
              </TableCell>
              <TableCell>{p.primary_salesperson || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.contractsTotal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.invoicesCollected)}</TableCell>
              <TableCell className={cn(
                "text-right font-medium",
                p.cashPosition >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {formatCurrency(p.cashPosition)}
              </TableCell>
              <TableCell className="text-right text-amber-600">
                {formatCurrency(p.invoiceBalanceDue)}
              </TableCell>
              <TableCell>
                <CashStatusBadge status={p.cashStatus} />
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No projects at risk
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper components
function CashStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    positive: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    low: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    negative: 'bg-red-500/10 text-red-600 border-red-500/20',
    overdue: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };
  const labels: Record<string, string> = {
    positive: 'Cash Positive',
    low: 'Low Collection',
    negative: 'Cash Negative',
    overdue: 'Overdue AR',
  };
  return (
    <Badge variant="outline" className={cn("text-xs", colors[status] || 'bg-muted')}>
      {labels[status] || status}
    </Badge>
  );
}

function AgingBadge({ bucket }: { bucket: string }) {
  const colors: Record<string, string> = {
    '0-30': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    '31-60': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    '61-90': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    '90+': 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return (
    <Badge variant="outline" className={cn("text-xs", colors[bucket] || 'bg-muted')}>
      {bucket} days
    </Badge>
  );
}
