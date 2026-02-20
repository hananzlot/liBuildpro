import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BadgePill } from "@/components/ui/badge-pill";
import { DataListCard, DataListCardHeader, DataListCardBody } from "@/components/ui/data-list-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { Printer, Search } from "lucide-react";

function AgingBadge({ bucket }: { bucket: string }) {
  const intentMap: Record<string, "success" | "warning" | "danger"> = {
    '0-30': 'success',
    '31-60': 'warning',
    '61-90': 'danger',
    '90+': 'danger',
  };
  return (
    <BadgePill intent={intentMap[bucket] || 'muted'}>
      {bucket} days
    </BadgePill>
  );
}

export default function OutstandingAR() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const [search, setSearch] = useState("");

  const { invoicesWithAging, isLoading } = useProductionAnalytics({
    dateRange: undefined,
    selectedProjects: [],
    selectedSalespeople: [],
  });

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return invoicesWithAging.filter((inv) =>
      !search ||
      inv.project_name.toLowerCase().includes(lower) ||
      inv.phase_description?.toLowerCase().includes(lower) ||
      String(inv.project_number).includes(lower)
    );
  }, [invoicesWithAging, search]);

  const total = filtered.reduce((sum, i) => sum + (i.open_balance || 0), 0);

  const handleProjectClick = (projectId: string, invoiceId?: string) => {
    const project = invoicesWithAging.find(i => i.project_id === projectId);
    const title = project 
      ? `Project ${project.project_number} (${project.project_name})`
      : `Project Detail`;
    const url = invoiceId
      ? `/project/${projectId}?tab=finance&financeTab=invoices&highlightInvoice=${invoiceId}`
      : `/project/${projectId}?tab=finance&financeTab=invoices`;
    openTab(url, title);
  };

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-4">
        <PageHeader
          title="Outstanding Receivables (AR)"
          subtitle="Unpaid invoices with aging analysis"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="no-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </PageHeader>

        <DataListCard>
          <DataListCardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects, phases..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <BadgePill intent="warning">
                Total Outstanding: {formatCurrency(total)}
              </BadgePill>
            </div>
          </DataListCardHeader>
          <DataListCardBody>
            {isLoading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table className="print-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[14%]">Salesperson</TableHead>
                      <TableHead className="w-[18%]">Project</TableHead>
                      <TableHead className="w-[20%]">Phase</TableHead>
                      <TableHead className="w-[10%] whitespace-nowrap">Date</TableHead>
                      <TableHead className="w-[10%] text-right">Amount</TableHead>
                      <TableHead className="w-[10%] text-right">Paid</TableHead>
                      <TableHead className="w-[11%] text-right">Balance</TableHead>
                      <TableHead className="w-[5%] text-right">Days</TableHead>
                      <TableHead className="w-[2%]">Aging</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => inv.project_id && handleProjectClick(inv.project_id, inv.id)}
                      >
                        <TableCell className="font-medium">{inv.primary_salesperson || '-'}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate font-medium">{inv.project_name}</div>
                          {inv.project_address && (
                            <div className="truncate text-xs text-muted-foreground">{inv.project_address}</div>
                          )}
                        </TableCell>
                        <TableCell>{inv.phase_description || '-'}</TableCell>
                         <TableCell className="whitespace-nowrap text-sm">
                           {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: '2-digit'}) : '-'}
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
            )}
          </DataListCardBody>
        </DataListCard>
      </div>
    </AppLayout>
  );
}
