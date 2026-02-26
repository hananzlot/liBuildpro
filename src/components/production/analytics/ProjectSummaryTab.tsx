import { useMemo, useState, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "./MetricCard";
import {
  DollarSign,
  FileText,
  Wallet,
  AlertCircle,
  Receipt,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectSummaryTabProps {
  onProjectClick?: (projectId: string, initialTab?: string) => void;
}

type SortKey =
  | "project_number"
  | "customer"
  | "contractAmount"
  | "totalInvoiced"
  | "totalCollected"
  | "outstandingAR"
  | "totalBills"
  | "billsPaid"
  | "outstandingAP"
  | "netCash";

interface ProjectSummaryRow {
  id: string;
  project_number: number;
  customer: string;
  contractAmount: number;
  totalInvoiced: number;
  totalCollected: number;
  outstandingAR: number;
  totalBills: number;
  billsPaid: number;
  outstandingAP: number;
  netCash: number;
  phases: PhaseRow[];
}

interface PhaseRow {
  id: string;
  phase_name: string;
  amount: number;
  invoiced: number;
  collected: number;
  status: "Paid" | "Partial" | "Pending";
}

export function ProjectSummaryTab({ onProjectClick }: ProjectSummaryTabProps) {
  const { companyId } = useCompanyContext();
  const [sortKey, setSortKey] = useState<SortKey>("project_number");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch all data in parallel
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["project-summary-projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, customer_first_name, customer_last_name, project_status")
        .eq("company_id", companyId!)
        .eq("project_status", "In-Progress")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  const projectIds = useMemo(() => projects?.map((p) => p.id) || [], [projects]);

  const { data: agreements, isLoading: agreementsLoading } = useQuery({
    queryKey: ["project-summary-agreements", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_agreements")
        .select("project_id, total_price")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["project-summary-invoices", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_invoices")
        .select("project_id, amount, payment_phase_id, payments_received")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["project-summary-payments", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_payments")
        .select("project_id, payment_amount, payment_status, is_voided, payment_phase_id")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["project-summary-bills", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_bills")
        .select("id, project_id, bill_amount, amount_paid, is_voided")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const { data: phases, isLoading: phasesLoading } = useQuery({
    queryKey: ["project-summary-phases", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_payment_phases")
        .select("id, project_id, phase_name, amount, display_order")
        .eq("company_id", companyId!)
        .in("project_id", projectIds)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const isLoading =
    projectsLoading || agreementsLoading || invoicesLoading || paymentsLoading || billsLoading || phasesLoading;

  // Build summary rows
  const rows = useMemo<ProjectSummaryRow[]>(() => {
    if (!projects) return [];

    return projects.map((p) => {
      const customer = [p.customer_first_name, p.customer_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "—";

      const contractAmount = (agreements || [])
        .filter((a) => a.project_id === p.id)
        .reduce((s, a) => s + (a.total_price || 0), 0);

      const projectInvoices = (invoices || []).filter((i) => i.project_id === p.id);
      const totalInvoiced = projectInvoices.reduce((s, i) => s + (i.amount || 0), 0);

      const receivedPayments = (payments || []).filter(
        (pay) =>
          pay.project_id === p.id &&
          pay.payment_status === "Received" &&
          !pay.is_voided
      );
      const totalCollected = receivedPayments.reduce(
        (s, pay) => s + (pay.payment_amount || 0),
        0
      );

      const outstandingAR = totalInvoiced - totalCollected;

      const activeBills = (bills || []).filter(
        (b) => b.project_id === p.id && !b.is_voided
      );
      const totalBills = activeBills.reduce((s, b) => s + (b.bill_amount || 0), 0);
      const billsPaid = activeBills.reduce((s, b) => s + (b.amount_paid || 0), 0);
      const outstandingAP = totalBills - billsPaid;
      const netCash = totalCollected - billsPaid;

      // Build phase rows
      const projectPhases = (phases || []).filter((ph) => ph.project_id === p.id);
      const phaseRows: PhaseRow[] = projectPhases.map((ph) => {
        const phaseInvoiced = projectInvoices
          .filter((i) => i.payment_phase_id === ph.id)
          .reduce((s, i) => s + (i.amount || 0), 0);

        const phaseCollected = receivedPayments
          .filter((pay) => pay.payment_phase_id === ph.id)
          .reduce((s, pay) => s + (pay.payment_amount || 0), 0);

        const phaseAmount = ph.amount || 0;
        let status: PhaseRow["status"] = "Pending";
        if (phaseAmount > 0 && phaseCollected >= phaseAmount) {
          status = "Paid";
        } else if (phaseCollected > 0 || phaseInvoiced > 0) {
          status = "Partial";
        }

        return {
          id: ph.id,
          phase_name: ph.phase_name,
          amount: phaseAmount,
          invoiced: phaseInvoiced,
          collected: phaseCollected,
          status,
        };
      });

      return {
        id: p.id,
        project_number: p.project_number ?? 0,
        customer,
        contractAmount,
        totalInvoiced,
        totalCollected,
        outstandingAR,
        totalBills,
        billsPaid,
        outstandingAP,
        netCash,
        phases: phaseRows,
      };
    });
  }, [projects, agreements, invoices, payments, bills, phases]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "customer") {
        cmp = a.customer.localeCompare(b.customer);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortKey, sortAsc]);

  // Totals
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        contractAmount: acc.contractAmount + r.contractAmount,
        totalInvoiced: acc.totalInvoiced + r.totalInvoiced,
        totalCollected: acc.totalCollected + r.totalCollected,
        outstandingAR: acc.outstandingAR + r.outstandingAR,
        totalBills: acc.totalBills + r.totalBills,
        billsPaid: acc.billsPaid + r.billsPaid,
        outstandingAP: acc.outstandingAP + r.outstandingAP,
        netCash: acc.netCash + r.netCash,
      }),
      {
        contractAmount: 0,
        totalInvoiced: 0,
        totalCollected: 0,
        outstandingAR: 0,
        totalBills: 0,
        billsPaid: 0,
        outstandingAP: 0,
        netCash: 0,
      }
    );
  }, [rows]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((prev) => !prev);
      } else {
        setSortKey(key);
        setSortAsc(true);
      }
    },
    [sortKey]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const SortableHeader = ({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => toggleSort(sortKeyName)}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Total Contract Value"
          value={formatCompactCurrency(totals.contractAmount)}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Invoiced"
          value={formatCompactCurrency(totals.totalInvoiced)}
          icon={FileText}
        />
        <MetricCard
          title="Total Collected"
          value={formatCompactCurrency(totals.totalCollected)}
          icon={Wallet}
        />
        <MetricCard
          title="Outstanding AR"
          value={formatCompactCurrency(totals.outstandingAR)}
          icon={AlertCircle}
        />
        <MetricCard
          title="Outstanding AP"
          value={formatCompactCurrency(totals.outstandingAP)}
          icon={Receipt}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <SortableHeader label="Project #" sortKeyName="project_number" />
                  <SortableHeader label="Customer" sortKeyName="customer" className="text-left" />
                  <SortableHeader label="Contract" sortKeyName="contractAmount" />
                  <SortableHeader label="Invoiced" sortKeyName="totalInvoiced" />
                  <SortableHeader label="Collected" sortKeyName="totalCollected" />
                  <SortableHeader label="AR" sortKeyName="outstandingAR" />
                  <SortableHeader label="Bills" sortKeyName="totalBills" />
                  <SortableHeader label="Paid" sortKeyName="billsPaid" />
                  <SortableHeader label="AP" sortKeyName="outstandingAP" />
                  <SortableHeader label="Net Cash" sortKeyName="netCash" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                      No in-progress projects found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => {
                    const isExpanded = expandedRows.has(row.id);
                    const hasPhases = row.phases.length > 0;
                    return (
                      <Fragment key={row.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer",
                            isExpanded && "bg-muted/30"
                          )}
                          onClick={() => hasPhases && toggleExpand(row.id)}
                        >
                          <TableCell className="w-8 px-2">
                            {hasPhases && (
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform text-muted-foreground",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            )}
                          </TableCell>
                          <TableCell
                            className="text-center font-medium text-primary cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onProjectClick?.(row.id, "finance");
                            }}
                          >
                            {row.project_number}
                          </TableCell>
                          <TableCell className="text-left">{row.customer}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.contractAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.totalInvoiced)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.totalCollected)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={row.outstandingAR > 0 ? "text-amber-500" : ""}>
                              {formatCurrency(row.outstandingAR)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.totalBills)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.billsPaid)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={row.outstandingAP > 0 ? "text-destructive" : ""}>
                              {formatCurrency(row.outstandingAP)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            <span className={row.netCash < 0 ? "text-destructive" : "text-emerald-500"}>
                              {formatCurrency(row.netCash)}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && row.phases.map((phase) => (
                          <TableRow key={phase.id} className="bg-muted/20 hover:bg-muted/30">
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-left pl-8 text-sm text-muted-foreground">
                              {phase.phase_name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatCurrency(phase.amount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatCurrency(phase.invoiced)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatCurrency(phase.collected)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  phase.status === "Paid" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                                  phase.status === "Partial" && "bg-amber-500/15 text-amber-600 border-amber-500/30",
                                  phase.status === "Pending" && "bg-muted text-muted-foreground"
                                )}
                              >
                                {phase.status}
                              </Badge>
                            </TableCell>
                            <TableCell colSpan={4} />
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell />
                  <TableCell className="text-center">{rows.length} Projects</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.contractAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.totalInvoiced)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.totalCollected)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.outstandingAR)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.totalBills)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.billsPaid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.outstandingAP)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    <span className={totals.netCash < 0 ? "text-destructive" : "text-emerald-500"}>
                      {formatCurrency(totals.netCash)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
