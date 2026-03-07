import { useMemo, useState, useCallback, Fragment, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgePill } from "@/components/ui/badge-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import {
  DollarSign,
  FileText,
  Wallet,
  AlertCircle,
  Receipt,
  
  ArrowUpDown,
  Filter,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectSummaryTabProps {
  onProjectClick?: (projectId: string, initialTab?: string) => void;
}

type SortKey =
  | "project_number"
  | "customer"
  | "projectName"
  | "initialContract"
  | "changeOrderTotal"
  | "totalInvoiced"
  | "totalCollected"
  | "outstandingAR"
  | "unpaidProgress"
  | "totalBills"
  | "billsPaid"
  | "outstandingAP"
  | "netCash";

interface ChangeOrderDetail {
  id: string;
  agreement_number: string | null;
  agreement_signed_date: string | null;
  description_of_work: string | null;
  total_price: number;
}

interface ProjectSummaryRow {
  id: string;
  project_number: number;
  customer: string;
  projectName: string;
  projectStatus: string;
  address: string;
  salesperson: string;
  startDate: string;
  initialContract: number;
  changeOrderTotal: number;
  changeOrders: ChangeOrderDetail[];
  totalInvoiced: number;
  totalCollected: number;
  totalRefunded: number;
  outstandingAR: number;
  unpaidProgress: number;
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

function projectStatusIntent(status: string): "success" | "primary" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "Completed": return "success";
    case "In-Progress": return "primary";
    case "New Job": return "info";
    case "Awaiting Finance": return "warning";
    case "Cancelled": return "danger";
    default: return "muted";
  }
}

export function ProjectSummaryTab({ onProjectClick }: ProjectSummaryTabProps) {
  const { companyId } = useCompanyContext();
  const [sortKey, setSortKey] = useState<SortKey>("project_number");
  const [sortAsc, setSortAsc] = useState(true);
  
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["In-Progress", "Awaiting Finance"]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [coDrillRow, setCODrillRow] = useState<ProjectSummaryRow | null>(null);

  // Fetch ALL non-deleted projects (filter client-side by status)
  const { data: allProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["project-summary-projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, customer_first_name, customer_last_name, project_status, project_address, primary_salesperson, install_start_date")
        .eq("company_id", companyId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  // Derive unique statuses for the filter
  const statusOptions = useMemo(() => {
    if (!allProjects) return [];
    const unique = [...new Set(allProjects.map(p => p.project_status).filter(Boolean))] as string[];
    return unique.sort().map(s => ({ value: s, label: s }));
  }, [allProjects]);

  // Filter projects by selected statuses, then by selected projects
  const projects = useMemo(() => {
    if (!allProjects) return [];
    let filtered = allProjects;
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => selectedStatuses.includes(p.project_status || ""));
    }
    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(p => selectedProjectIds.includes(p.id));
    }
    return filtered;
  }, [allProjects, selectedStatuses, selectedProjectIds]);

  // Project filter options (based on status-filtered list)
  const projectFilterOptions = useMemo(() => {
    if (!allProjects) return [];
    let filtered = allProjects;
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => selectedStatuses.includes(p.project_status || ""));
    }
    return filtered
      .sort((a, b) => (a.project_number ?? 0) - (b.project_number ?? 0))
      .map(p => {
        const name = [p.customer_first_name, p.customer_last_name].filter(Boolean).join(" ").trim();
        return { value: p.id, label: `#${p.project_number} ${name}` };
      });
  }, [allProjects, selectedStatuses]);

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  const { data: agreements, isLoading: agreementsLoading } = useQuery({
    queryKey: ["project-summary-agreements", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, project_id, total_price, agreement_type, agreement_signed_date, description_of_work, agreement_number")
        .eq("company_id", companyId!)
        .in("project_id", projectIds)
        .order("agreement_signed_date", { ascending: true });
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
        .not("agreement_id", "is", null)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  // Fetch refunds
  const { data: refunds, isLoading: refundsLoading } = useQuery({
    queryKey: ["project-summary-refunds", companyId, projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("project_refunds")
        .select("project_id, refund_amount, refund_status, is_voided")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && projectIds.length > 0,
  });

  const isLoading =
    projectsLoading || agreementsLoading || invoicesLoading || paymentsLoading || billsLoading || phasesLoading || refundsLoading;

  // Build summary rows
  const rows = useMemo<ProjectSummaryRow[]>(() => {
    if (!projects) return [];

    return projects.map((p) => {
      const customer = [p.customer_first_name, p.customer_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "—";

      const projectAgreements = (agreements || []).filter((a) => a.project_id === p.id);
      const initialContract = projectAgreements
        .filter((a) => a.agreement_type === "Contract")
        .reduce((s, a) => s + (a.total_price || 0), 0);
      const changeOrders: ChangeOrderDetail[] = projectAgreements
        .filter((a) => a.agreement_type !== "Contract")
        .map((a) => ({
          id: a.id,
          agreement_number: a.agreement_number,
          agreement_signed_date: a.agreement_signed_date,
          description_of_work: a.description_of_work,
          total_price: a.total_price || 0,
        }));
      const changeOrderTotal = changeOrders.reduce((s, co) => s + co.total_price, 0);

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

      // Refunds
      const projectRefunds = (refunds || []).filter(
        (r) => r.project_id === p.id && r.refund_status === "Issued" && !r.is_voided
      );
      const totalRefunded = projectRefunds.reduce((s, r) => s + (r.refund_amount || 0), 0);

      const outstandingAR = totalInvoiced - totalCollected;

      const activeBills = (bills || []).filter(
        (b) => b.project_id === p.id && !b.is_voided
      );
      const totalBills = activeBills.reduce((s, b) => s + (b.bill_amount || 0), 0);
      const billsPaid = activeBills.reduce((s, b) => s + (b.amount_paid || 0), 0);
      const outstandingAP = totalBills - billsPaid;
      const netCash = totalCollected - totalRefunded - billsPaid;

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

      const unpaidProgress = phaseRows
        .filter(ph => ph.status !== "Paid")
        .reduce((s, ph) => s + (ph.amount - ph.collected), 0);

      return {
        id: p.id,
        project_number: p.project_number ?? 0,
        customer,
        projectName: p.project_name || "",
        projectStatus: p.project_status || "",
        address: p.project_address || "",
        salesperson: p.primary_salesperson || "",
        startDate: p.install_start_date || "",
        initialContract,
        changeOrderTotal,
        changeOrders,
        totalInvoiced,
        totalCollected,
        totalRefunded,
        outstandingAR,
        unpaidProgress,
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
        initialContract: acc.initialContract + r.initialContract,
        changeOrderTotal: acc.changeOrderTotal + r.changeOrderTotal,
        totalInvoiced: acc.totalInvoiced + r.totalInvoiced,
        totalCollected: acc.totalCollected + r.totalCollected,
        totalRefunded: acc.totalRefunded + r.totalRefunded,
        outstandingAR: acc.outstandingAR + r.outstandingAR,
        unpaidProgress: acc.unpaidProgress + r.unpaidProgress,
        totalBills: acc.totalBills + r.totalBills,
        billsPaid: acc.billsPaid + r.billsPaid,
        outstandingAP: acc.outstandingAP + r.outstandingAP,
        netCash: acc.netCash + r.netCash,
      }),
      {
        initialContract: 0,
        changeOrderTotal: 0,
        totalInvoiced: 0,
        totalCollected: 0,
        totalRefunded: 0,
        outstandingAR: 0,
        unpaidProgress: 0,
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


  const reportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const buildReportHtml = useCallback((unpaidOnly: boolean) => {
    const title = unpaidOnly ? "Unpaid Progress Payments Report" : "Projects Summary";
    const dateStr = new Date().toLocaleDateString();
    
    let html = `<h2 style="margin:0 0 4px;font-size:18px">${title}</h2>`;
    html += `<p style="margin:0 0 16px;font-size:12px;color:#666">Generated ${dateStr}</p>`;
    
    if (unpaidOnly) {
      let grandTotalAmount = 0, grandTotalInvoiced = 0, grandTotalCollected = 0;
      
      const projectsWithUnpaid = sortedRows.filter(r => r.phases.some(p => p.status !== "Paid"));
      
      projectsWithUnpaid.forEach((row, idx) => {
        const unpaidPhases = row.phases.filter(p => p.status !== "Paid");
        const phaseAmount = unpaidPhases.reduce((s, p) => s + p.amount, 0);
        const phaseInvoiced = unpaidPhases.reduce((s, p) => s + p.invoiced, 0);
        const phaseCollected = unpaidPhases.reduce((s, p) => s + p.collected, 0);
        grandTotalAmount += phaseAmount;
        grandTotalInvoiced += phaseInvoiced;
        grandTotalCollected += phaseCollected;

        if (idx > 0) html += `<div style="height:16px"></div>`;
        
        html += `<div style="background:#f0f4f8;border:1px solid #ddd;border-radius:4px;padding:10px 12px;margin-bottom:2px">`;
        html += `<div style="font-weight:700;font-size:13px">Project #${row.project_number} — ${row.customer}</div>`;
        if (row.address) html += `<div style="font-size:11px;color:#555;margin-top:2px">${row.address}</div>`;
        if (row.salesperson) html += `<div style="font-size:11px;color:#555;margin-top:1px"><b>Sales Rep:</b> ${row.salesperson}</div>`;
        if (row.startDate) html += `<div style="font-size:11px;color:#555;margin-top:1px"><b>Start Date:</b> ${new Date(row.startDate).toLocaleDateString()}</div>`;
        html += `<div style="display:flex;gap:24px;margin-top:6px;font-size:11px;flex-wrap:wrap">`;
        html += `<span><b>Contract:</b> ${formatCurrency(row.initialContract + row.changeOrderTotal)}</span>`;
        html += `<span><b>Invoiced:</b> ${formatCurrency(row.totalInvoiced)}</span>`;
        html += `<span><b>Collected:</b> ${formatCurrency(row.totalCollected)}</span>`;
        html += `<span><b>AR:</b> ${formatCurrency(row.outstandingAR)}</span>`;
        html += `<span><b>Bills:</b> ${formatCurrency(row.totalBills)}</span>`;
        html += `<span><b>Paid:</b> ${formatCurrency(row.billsPaid)}</span>`;
        html += `<span><b>AP:</b> ${formatCurrency(row.outstandingAP)}</span>`;
        html += `<span><b>Net Cash:</b> ${formatCurrency(row.netCash)}</span>`;
        html += `</div></div>`;

        html += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;
        html += `<thead><tr style="background:#f9f9f9;border-bottom:1px solid #ddd">`;
        html += `<th style="padding:5px;text-align:left">Progress Payment</th>`;
        html += `<th style="padding:5px;text-align:left">Amount</th>`;
        html += `<th style="padding:5px;text-align:left">Invoiced</th>`;
        html += `<th style="padding:5px;text-align:left">Collected</th>`;
        html += `<th style="padding:5px;text-align:left">Balance</th>`;
        html += `<th style="padding:5px;text-align:left">Status</th>`;
        html += `</tr></thead><tbody>`;
        
        unpaidPhases.forEach(phase => {
          const balance = phase.amount - phase.collected;
          html += `<tr style="border-bottom:1px solid #eee">`;
          html += `<td style="padding:4px 5px">${phase.phase_name}</td>`;
          html += `<td style="padding:4px 5px">${formatCurrency(phase.amount)}</td>`;
          html += `<td style="padding:4px 5px">${formatCurrency(phase.invoiced)}</td>`;
          html += `<td style="padding:4px 5px">${formatCurrency(phase.collected)}</td>`;
          html += `<td style="padding:4px 5px;font-weight:600">${formatCurrency(balance)}</td>`;
          html += `<td style="padding:4px 5px">${phase.status}</td>`;
          html += `</tr>`;
        });
        
        html += `<tr style="border-top:1px solid #999;font-weight:600;background:#fafafa">`;
        html += `<td style="padding:4px 5px">Subtotal (${unpaidPhases.length} progress payments)</td>`;
        html += `<td style="padding:4px 5px">${formatCurrency(phaseAmount)}</td>`;
        html += `<td style="padding:4px 5px">${formatCurrency(phaseInvoiced)}</td>`;
        html += `<td style="padding:4px 5px">${formatCurrency(phaseCollected)}</td>`;
        html += `<td style="padding:4px 5px">${formatCurrency(phaseAmount - phaseCollected)}</td>`;
        html += `<td style="padding:4px 5px"></td>`;
        html += `</tr></tbody></table>`;
      });

      html += `<div style="height:12px"></div>`;
      html += `<div style="background:#1a1a2e;color:#fff;border-radius:4px;padding:12px;font-size:12px">`;
      html += `<div style="font-weight:700;font-size:14px;margin-bottom:6px">Report Summary — ${projectsWithUnpaid.length} Projects</div>`;
      html += `<div style="display:flex;gap:32px;flex-wrap:wrap">`;
      html += `<span><b>Total Progress Payment Amount:</b> ${formatCurrency(grandTotalAmount)}</span>`;
      html += `<span><b>Total Invoiced:</b> ${formatCurrency(grandTotalInvoiced)}</span>`;
      html += `<span><b>Total Collected:</b> ${formatCurrency(grandTotalCollected)}</span>`;
      html += `<span><b>Total Balance:</b> ${formatCurrency(grandTotalAmount - grandTotalCollected)}</span>`;
      html += `</div></div>`;
    } else {
      html += `<table style="width:100%;border-collapse:collapse;font-size:11px">`;
      html += `<thead><tr style="background:#f5f5f5;border-bottom:2px solid #ddd">`;
      const cols = ["Pro#","Customer","Contract","CO","Invoiced","Collected","AR","Bills","Paid","AP","Net Cash"];
      cols.forEach(c => { html += `<th style="padding:6px;text-align:left">${c}</th>`; });
      html += `</tr></thead><tbody>`;
      
      sortedRows.forEach(row => {
        html += `<tr style="border-bottom:1px solid #eee">`;
        html += `<td style="padding:5px">${row.project_number}</td>`;
        html += `<td style="padding:5px">${row.customer}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.initialContract)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.changeOrderTotal)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.totalInvoiced)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.totalCollected)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.outstandingAR)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.totalBills)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.billsPaid)}</td>`;
        html += `<td style="padding:5px">${formatCurrency(row.outstandingAP)}</td>`;
        html += `<td style="padding:5px;font-weight:600">${formatCurrency(row.netCash)}</td>`;
        html += `</tr>`;
      });
      
      html += `<tr style="border-top:2px solid #333;font-weight:700">`;
      html += `<td style="padding:5px">${rows.length}</td>`;
      html += `<td style="padding:5px"></td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.initialContract)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.changeOrderTotal)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.totalInvoiced)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.totalCollected)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.outstandingAR)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.totalBills)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.billsPaid)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.outstandingAP)}</td>`;
      html += `<td style="padding:5px">${formatCurrency(totals.netCash)}</td>`;
      html += `</tr>`;
      html += `</tbody></table>`;
    }
    return { html, title, dateStr };
  }, [sortedRows, rows, totals]);

  const handlePreview = useCallback((unpaidOnly: boolean) => {
    const { html, title } = buildReportHtml(unpaidOnly);
    setPreviewTitle(title);
    setPreviewHtml(html);
  }, [buildReportHtml]);

  const handleSingleProjectUnpaidReport = useCallback((row: ProjectSummaryRow) => {
    const dateStr = new Date().toLocaleDateString();
    const unpaidPhases = row.phases.filter(p => p.status !== "Paid");
    const phaseAmount = unpaidPhases.reduce((s, p) => s + p.amount, 0);
    const phaseInvoiced = unpaidPhases.reduce((s, p) => s + p.invoiced, 0);
    const phaseCollected = unpaidPhases.reduce((s, p) => s + p.collected, 0);

    let html = `<h2 style="margin:0 0 4px;font-size:18px">Unpaid Progress Payments — Project #${row.project_number}</h2>`;
    html += `<p style="margin:0 0 16px;font-size:12px;color:#666">Generated ${dateStr}</p>`;

    html += `<div style="background:#f0f4f8;border:1px solid #ddd;border-radius:4px;padding:10px 12px;margin-bottom:8px">`;
    html += `<div style="font-weight:700;font-size:13px">${row.customer}</div>`;
    if (row.address) html += `<div style="font-size:11px;color:#555;margin-top:2px">${row.address}</div>`;
    if (row.salesperson) html += `<div style="font-size:11px;color:#555;margin-top:1px"><b>Sales Rep:</b> ${row.salesperson}</div>`;
    if (row.startDate) html += `<div style="font-size:11px;color:#555;margin-top:1px"><b>Start Date:</b> ${new Date(row.startDate).toLocaleDateString()}</div>`;
    html += `<div style="display:flex;gap:24px;margin-top:6px;font-size:11px;flex-wrap:wrap">`;
    html += `<span><b>Contract:</b> ${formatCurrency(row.initialContract + row.changeOrderTotal)}</span>`;
    html += `<span><b>Invoiced:</b> ${formatCurrency(row.totalInvoiced)}</span>`;
    html += `<span><b>Collected:</b> ${formatCurrency(row.totalCollected)}</span>`;
    html += `<span><b>AR:</b> ${formatCurrency(row.outstandingAR)}</span>`;
    html += `</div></div>`;

    html += `<table style="width:100%;border-collapse:collapse;font-size:11px">`;
    html += `<thead><tr style="background:#f9f9f9;border-bottom:1px solid #ddd">`;
    html += `<th style="padding:5px;text-align:left">Progress Payment</th>`;
    html += `<th style="padding:5px;text-align:left">Amount</th>`;
    html += `<th style="padding:5px;text-align:left">Invoiced</th>`;
    html += `<th style="padding:5px;text-align:left">Collected</th>`;
    html += `<th style="padding:5px;text-align:left">Balance</th>`;
    html += `<th style="padding:5px;text-align:left">Status</th>`;
    html += `</tr></thead><tbody>`;

    unpaidPhases.forEach(phase => {
      const balance = phase.amount - phase.collected;
      html += `<tr style="border-bottom:1px solid #eee">`;
      html += `<td style="padding:4px 5px">${phase.phase_name}</td>`;
      html += `<td style="padding:4px 5px">${formatCurrency(phase.amount)}</td>`;
      html += `<td style="padding:4px 5px">${formatCurrency(phase.invoiced)}</td>`;
      html += `<td style="padding:4px 5px">${formatCurrency(phase.collected)}</td>`;
      html += `<td style="padding:4px 5px;font-weight:600">${formatCurrency(balance)}</td>`;
      html += `<td style="padding:4px 5px">${phase.status}</td>`;
      html += `</tr>`;
    });

    html += `<tr style="border-top:1px solid #999;font-weight:600;background:#fafafa">`;
    html += `<td style="padding:4px 5px">Total (${unpaidPhases.length} progress payments)</td>`;
    html += `<td style="padding:4px 5px">${formatCurrency(phaseAmount)}</td>`;
    html += `<td style="padding:4px 5px">${formatCurrency(phaseInvoiced)}</td>`;
    html += `<td style="padding:4px 5px">${formatCurrency(phaseCollected)}</td>`;
    html += `<td style="padding:4px 5px">${formatCurrency(phaseAmount - phaseCollected)}</td>`;
    html += `<td style="padding:4px 5px"></td>`;
    html += `</tr></tbody></table>`;

    setPreviewTitle(`Unpaid Progress Payments — Project #${row.project_number}`);
    setPreviewHtml(html);
  }, []);

  const handleDownloadFromPreview = useCallback(async () => {
    if (!previewRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true });
    const link = document.createElement("a");
    const dateStr = new Date().toLocaleDateString();
    link.download = `${previewTitle.replace(/\s+/g, "_")}_${dateStr}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [previewTitle]);

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
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap", className)}
      onClick={() => toggleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <MultiSelectFilter
          options={statusOptions}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
          placeholder="All Statuses"
          icon={<Filter className="h-3.5 w-3.5" />}
        />
        <MultiSelectFilter
          options={projectFilterOptions}
          selected={selectedProjectIds}
          onChange={setSelectedProjectIds}
          placeholder="All Projects"
          icon={<Filter className="h-3.5 w-3.5" />}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showUnpaidOnly}
            onChange={(e) => setShowUnpaidOnly(e.target.checked)}
            className="rounded border-border"
          />
          Unpaid progress payments only
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePreview(false)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Summary Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreview(true)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Unpaid Progress Payments Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Total Contract Value"
          value={formatCompactCurrency(totals.initialContract + totals.changeOrderTotal)}
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
          <div className="max-h-[calc(100vh-340px)] overflow-auto">
            <Table className="min-w-[1100px] w-max">
              <TableHeader>
                <TableRow>
                  
                  <SortableHeader label="Pro#" sortKeyName="project_number" className="w-16" />
                   <SortableHeader label="Customer" sortKeyName="customer" />
                   <SortableHeader label="Project Name" sortKeyName="projectName" />
                   <SortableHeader label="Contract" sortKeyName="initialContract" />
                   <SortableHeader label="CO" sortKeyName="changeOrderTotal" />
                  <SortableHeader label="Invoiced" sortKeyName="totalInvoiced" />
                  <SortableHeader label="Collected" sortKeyName="totalCollected" />
                  <SortableHeader label="AR" sortKeyName="outstandingAR" />
                  <SortableHeader label="Unpaid PP" sortKeyName="unpaidProgress" />
                  <SortableHeader label="Bills" sortKeyName="totalBills" />
                  <SortableHeader label="Paid" sortKeyName="billsPaid" />
                  <SortableHeader label="AP" sortKeyName="outstandingAP" />
                  <SortableHeader label="Net Cash" sortKeyName="netCash" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                      No in-progress projects found
                    </TableCell>
                  </TableRow>
                ) : (
                   sortedRows.map((row) => {
                     return (
                       <Fragment key={row.id}>
                         <TableRow
                           className="cursor-pointer"
                         >
                          <TableCell
                            className="w-16 font-medium text-primary cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onProjectClick?.(row.id, "finance");
                            }}
                          >
                            {row.project_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span>{row.customer}</span>
                              {row.projectStatus && (
                                <BadgePill intent={projectStatusIntent(row.projectStatus)}>
                                  {row.projectStatus}
                                </BadgePill>
                              )}
                            </div>
                            {row.address && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.address}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {row.projectName || "—"}
                          </TableCell>
                           <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(row.initialContract)}</TableCell>
                           <TableCell className="tabular-nums whitespace-nowrap">
                             {row.changeOrderTotal > 0 ? (
                               <span
                                 className="cursor-pointer text-primary hover:underline"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setCODrillRow(row);
                                 }}
                               >
                                 {formatCurrency(row.changeOrderTotal)}
                               </span>
                             ) : (
                               <span className="text-muted-foreground">{formatCurrency(0)}</span>
                             )}
                           </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(row.totalInvoiced)}</TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            <div>{formatCurrency(row.totalCollected)}</div>
                            {row.totalRefunded > 0 && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mt-0.5 font-medium">
                                -{formatCurrency(row.totalRefunded)} refunded
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            <span className={row.outstandingAR > 0 ? "text-amber-500" : ""}>
                              {formatCurrency(row.outstandingAR)}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            {row.unpaidProgress > 0 ? (
                              <Badge
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary/20 bg-primary/10 text-primary border border-primary/30 font-semibold text-[11px] px-2 py-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSingleProjectUnpaidReport(row);
                                }}
                              >
                                {formatCurrency(row.unpaidProgress)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{formatCurrency(0)}</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(row.totalBills)}</TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(row.billsPaid)}</TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            <span className={row.outstandingAP > 0 ? "text-destructive" : ""}>
                              {formatCurrency(row.outstandingAP)}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums font-semibold whitespace-nowrap">
                            <span className={row.netCash < 0 ? "text-destructive" : "text-emerald-500"}>
                              {formatCurrency(row.netCash)}
                            </span>
                          </TableCell>
                        </TableRow>
                       </Fragment>
                    );
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell className="w-16">{rows.length} Pro</TableCell>
                   <TableCell />
                   <TableCell />
                   <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.initialContract)}</TableCell>
                   <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.changeOrderTotal)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.totalInvoiced)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    <div>{formatCurrency(totals.totalCollected)}</div>
                    {totals.totalRefunded > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mt-0.5 font-medium">
                        -{formatCurrency(totals.totalRefunded)} refunded
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.outstandingAR)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.unpaidProgress)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.totalBills)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.billsPaid)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatCurrency(totals.outstandingAP)}</TableCell>
                  <TableCell className="tabular-nums font-bold whitespace-nowrap">
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

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md bg-white p-6">
            <div
              ref={previewRef}
              style={{ fontFamily: "system-ui, sans-serif", color: "#111", background: "white" }}
              dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewHtml(null)}>Close</Button>
            <Button onClick={handleDownloadFromPreview}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Order Drilldown Dialog */}
      <Dialog open={!!coDrillRow} onOpenChange={(open) => { if (!open) setCODrillRow(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Change Orders — #{coDrillRow?.project_number} {coDrillRow?.customer}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">CO #</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(coDrillRow?.changeOrders || [])
                  .sort((a, b) => (a.agreement_signed_date || "").localeCompare(b.agreement_signed_date || ""))
                  .map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="text-xs font-medium">{co.agreement_number || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {co.agreement_signed_date
                        ? new Date(co.agreement_signed_date + "T00:00:00").toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{co.description_of_work || "—"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-medium">{formatCurrency(co.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={3} className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {formatCurrency(coDrillRow?.changeOrderTotal || 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
