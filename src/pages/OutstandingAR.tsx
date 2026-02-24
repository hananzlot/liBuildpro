import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { BadgePill } from "@/components/ui/badge-pill";
import { DataListCard, DataListCardHeader, DataListCardBody } from "@/components/ui/data-list-card";
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
import { formatCurrency } from "@/lib/utils";
import { Printer, Search, AlertTriangle, Link2, DollarSign } from "lucide-react";
import { LinkInvoiceToProjectDialog } from "@/components/production/analytics/LinkInvoiceToProjectDialog";

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
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingInvoice, setLinkingInvoice] = useState<{
    id: string;
    invoice_number: string | null;
    qb_customer_name: string | null;
    amount: number | null;
    open_balance: number | null;
  } | null>(null);

  const { invoicesWithAging, orphanPayments, isLoading } = useProductionAnalytics({
    dateRange: undefined,
    selectedProjects: [],
    selectedSalespeople: [],
  });

  // Force fresh data on mount to avoid stale persistent cache
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["analytics-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["analytics-payments"] });
  }, [queryClient]);

  // Check QB connection status
  const { data: qbConnection } = useQuery({
    queryKey: ["qb-connection-status", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quickbooks_connections")
        .select("is_active")
        .eq("company_id", companyId!)
        .maybeSingle();
      return data;
    },
    enabled: !!companyId,
  });
  const isQBConnected = !!qbConnection?.is_active;

  // Unlinked invoices (no project assigned)
  const unlinkedInvoices = useMemo(() =>
    invoicesWithAging.filter(inv => !inv.project_id),
  [invoicesWithAging]);

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return invoicesWithAging.filter((inv) =>
      !search ||
      inv.project_name.toLowerCase().includes(lower) ||
      inv.phase_description?.toLowerCase().includes(lower) ||
      String(inv.project_number).includes(lower) ||
      inv.qb_customer_name?.toLowerCase().includes(lower)
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

        {/* Unlinked Invoices Banner */}
        {unlinkedInvoices.length > 0 && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {unlinkedInvoices.length} invoice{unlinkedInvoices.length > 1 ? 's' : ''} synced from QuickBooks without a project link
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These invoices need to be assigned to a project for proper tracking and collection management.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unlinkedInvoices.map((inv) => (
                  <Button
                    key={inv.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => {
                      setLinkingInvoice({
                        id: inv.id,
                        invoice_number: inv.invoice_number,
                        qb_customer_name: inv.qb_customer_name,
                        amount: inv.amount,
                        open_balance: inv.open_balance,
                      });
                      setLinkDialogOpen(true);
                    }}
                  >
                    <Link2 className="h-3 w-3 mr-1" />
                    {inv.qb_customer_name || inv.invoice_number || 'Unknown'} — {formatCurrency(inv.open_balance || 0)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orphan Payments Banner — only visible when no unlinked invoices remain */}
        {unlinkedInvoices.length === 0 && orphanPayments.length > 0 && (
          <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {orphanPayments.length} payment{orphanPayments.length > 1 ? 's' : ''} received without a project link
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These payments were synced from QuickBooks but couldn't be matched to a project. Link them to the correct project for accurate tracking.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {orphanPayments.map((pmt) => (
                  <Button
                    key={pmt.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-blue-500/30 hover:bg-blue-500/10"
                    onClick={() => {
                      // Future: Open a LinkPaymentToProjectDialog
                    }}
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    {pmt.check_number ? `#${pmt.check_number}` : 'Payment'} — {formatCurrency(pmt.payment_amount || 0)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

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
          <DataListCardBody className="overflow-auto max-h-[calc(100vh-260px)]">
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
                        className={`cursor-pointer hover:bg-muted/50 ${!inv.project_id ? 'bg-amber-500/5' : ''}`}
                        onClick={() => {
                          if (!inv.project_id) {
                            // Open link dialog for unlinked invoices
                            setLinkingInvoice({
                              id: inv.id,
                              invoice_number: inv.invoice_number,
                              qb_customer_name: inv.qb_customer_name,
                              amount: inv.amount,
                              open_balance: inv.open_balance,
                            });
                            setLinkDialogOpen(true);
                          } else {
                            handleProjectClick(inv.project_id, inv.id);
                          }
                        }}
                      >
                        <TableCell className="font-medium">{inv.primary_salesperson || '-'}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate font-medium">
                            {!inv.project_id ? (
                              <span className="text-amber-600 flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                {inv.qb_customer_name || 'Unlinked'}
                              </span>
                            ) : (
                              inv.project_name
                            )}
                          </div>
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

      {/* Link Invoice to Project Dialog */}
      <LinkInvoiceToProjectDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        invoice={linkingInvoice}
        isQBConnected={isQBConnected}
      />
    </AppLayout>
  );
}
