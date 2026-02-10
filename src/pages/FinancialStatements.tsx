import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigate, useParams } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAnalyticsPermissions } from "@/hooks/useAnalyticsPermissions";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PnLStatement } from "@/components/production/analytics/PnLStatement";
import { BalanceSheet } from "@/components/production/analytics/BalanceSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, Scale, Building2, Layers, FolderKanban, Download, ListFilter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";

export default function FinancialStatements() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const { canViewReport, isLoading: permissionsLoading } = useAnalyticsPermissions();

  const canViewPnL = canViewReport("pnl");
  const canViewBS = canViewReport("balance_sheet");

  const getDefaultTab = useCallback(() => {
    if (routeTab === "pnl" && canViewPnL) return "pnl";
    if (routeTab === "balance-sheet" && canViewBS) return "balance-sheet";
    if (canViewPnL) return "pnl";
    if (canViewBS) return "balance-sheet";
    return "pnl";
  }, [routeTab, canViewPnL, canViewBS]);

  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [viewMode, setViewMode] = useState<"aggregate" | "per-project">("aggregate");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusOptionsInitialized, setStatusOptionsInitialized] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  

  useEffect(() => {
    setActiveTab(getDefaultTab());
  }, [getDefaultTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    navigate(`/analytics/${tab}`, { replace: true });
  }, [navigate]);

  const { isLoading, projects } = useProductionAnalytics({
    dateRange: undefined,
    selectedProjects: [],
    selectedSalespeople: [],
  });

  const handleProjectClick = (projectId: string, initialTab?: string) => {
    let url = `/project/${projectId}`;
    if (initialTab) url += `?tab=${initialTab}`;
    openTab(url, `Project ${projectId.slice(0, 8)}`);
  };

  // Unique project statuses for filter
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    projects.forEach(p => {
      if (p.project_status) statuses.add(p.project_status);
    });
    return Array.from(statuses).sort().map(s => ({ value: s, label: s }));
  }, [projects]);

  // Auto-select all statuses on first load
  useEffect(() => {
    if (!statusOptionsInitialized && statusOptions.length > 0) {
      setSelectedStatuses(statusOptions.map(o => o.value));
      setStatusOptionsInitialized(true);
    }
  }, [statusOptions, statusOptionsInitialized]);

  // Project options for the selector
  const projectOptions = useMemo(() => {
    return projects
      .filter(p => p.contractsTotal > 0 || p.totalBillsReceived > 0 || p.invoicesCollected > 0)
      .sort((a, b) => b.project_number - a.project_number)
      .map(p => ({
        value: p.id,
        label: `#${p.project_number} — ${p.project_address || p.project_name}`,
      }));
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (selectedStatuses.length > 0 && selectedStatuses.length < statusOptions.length) {
      result = result.filter(p => p.project_status && selectedStatuses.includes(p.project_status));
    }
    if (selectedProjectIds.length > 0) {
      result = result.filter(p => selectedProjectIds.includes(p.id));
    }
    return result;
  }, [projects, selectedProjectIds, selectedStatuses, statusOptions.length]);

  // --- Export helpers ---
  const buildPnLCSV = useCallback((projs: ProjectWithFinancials[], all: ProjectWithFinancials[], mode: "aggregate" | "per-project") => {
    const fmt = (n: number) => n.toFixed(2);
    let csv = "";
    if (mode === "aggregate") {
      const rev = all.reduce((s, p) => s + p.contractsTotal, 0);
      const cogs = all.reduce((s, p) => s + p.totalBillsReceived, 0);
      const paid = all.reduce((s, p) => s + p.totalBillsPaid, 0);
      const outstanding = cogs - paid;
      const grossIncome = rev - cogs;
      const comm = all.reduce((s, p) => s + p.totalCommission, 0);
      const giac = grossIncome - comm;
      const lead = all.reduce((s, p) => s + p.leadCostAmount, 0);
      csv = "Line Item,Amount\n";
      csv += `Revenues (Contracts Invoiced),${fmt(rev)}\nBills Paid,${fmt(paid)}\nBills Outstanding,${fmt(outstanding)}\nCost of Sales Total,${fmt(cogs)}\nGross Income,${fmt(grossIncome)}\nCommissions,${fmt(comm)}\nGross Income After Commission,${fmt(giac)}\nLead Cost Income,${fmt(lead)}\nNet Income,${fmt(giac + lead)}\n`;
    } else {
      csv = "Project #,Project Name,Revenue,Bills Paid,Bills Outstanding,COGS,Gross Income,Commissions,Gross Income After Comm,Lead Cost,Net Income\n";
      projs.filter(p => p.contractsTotal > 0 || p.totalBillsReceived > 0).forEach(p => {
        const gi = p.contractsTotal - p.totalBillsReceived;
        const giac = gi - p.totalCommission;
        csv += `${p.project_number},"${p.project_name}",${fmt(p.contractsTotal)},${fmt(p.totalBillsPaid)},${fmt(p.totalBillsReceived - p.totalBillsPaid)},${fmt(p.totalBillsReceived)},${fmt(gi)},${fmt(p.totalCommission)},${fmt(giac)},${fmt(p.leadCostAmount)},${fmt(giac + p.leadCostAmount)}\n`;
      });
    }
    return csv;
  }, []);

  const buildBSCSV = useCallback((projs: ProjectWithFinancials[], all: ProjectWithFinancials[], mode: "aggregate" | "per-project") => {
    const fmt = (n: number) => n.toFixed(2);
    let csv = "";
    if (mode === "aggregate") {
      const cash = all.reduce((s, p) => s + p.invoicesCollected, 0);
      const ar = all.reduce((s, p) => s + p.invoiceBalanceDue, 0);
      const ap = all.reduce((s, p) => s + (p.totalBillsReceived - p.totalBillsPaid), 0);
      csv = "Line Item,Amount\n";
      csv += `Cash Collected,${fmt(cash)}\nAccounts Receivable,${fmt(ar)}\nTotal Assets,${fmt(cash + ar)}\nAccounts Payable,${fmt(ap)}\nTotal Liabilities,${fmt(ap)}\nEquity,${fmt(cash + ar - ap)}\n`;
    } else {
      csv = "Project #,Project Name,Cash Collected,AR,Total Assets,AP,Total Liabilities,Equity\n";
      projs.filter(p => p.invoicesCollected > 0 || p.invoiceBalanceDue > 0 || p.totalBillsReceived > 0).forEach(p => {
        const cash = p.invoicesCollected;
        const ar = p.invoiceBalanceDue;
        const ap = p.totalBillsReceived - p.totalBillsPaid;
        csv += `${p.project_number},"${p.project_name}",${fmt(cash)},${fmt(ar)},${fmt(cash + ar)},${fmt(ap)},${fmt(ap)},${fmt(cash + ar - ap)}\n`;
      });
    }
    return csv;
  }, []);

  const downloadCSV = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, []);

  const handleExportCSV = useCallback(() => {
    const date = new Date().toISOString().split("T")[0];
    // In per-project mode, only export filtered projects (no company totals)
    const exportAll = viewMode === "per-project" ? filteredProjects : projects;
    if (activeTab === "pnl") {
      downloadCSV(buildPnLCSV(filteredProjects, exportAll, viewMode), `pnl-statement-${date}.csv`);
    } else {
      downloadCSV(buildBSCSV(filteredProjects, exportAll, viewMode), `balance-sheet-${date}.csv`);
    }
  }, [activeTab, viewMode, filteredProjects, projects, buildPnLCSV, buildBSCSV, downloadCSV]);

  const handleExportPDF = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const title = activeTab === "pnl" ? "P&L Statement" : "Balance Sheet";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      td, th { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; }
      .text-right, td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 16px 0 8px; }
      .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
      .pnl-indent { padding-left: 32px; }
      .pnl-subtotal { background: #f0f0f0; font-weight: 600; }
      .pnl-grand-total { background: #d9d9d9; font-weight: 700; font-size: 14px; }
      .pnl-negative { color: #dc2626; }
      @media print { body { padding: 0; } }
    </style></head><body>`);
    printWindow.document.write(`<h1>${title}</h1><p class="subtitle">Generated ${new Date().toLocaleDateString()} · ${viewMode === "aggregate" ? "Company View" : "Per-Project View"}</p>`);
    printWindow.document.write(el.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 250);
  }, [activeTab, viewMode]);

  if (permissionsLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 p-4 md:p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!canViewPnL && !canViewBS) {
    return (
      <AppLayout>
        <div className="flex-1 p-4 md:p-6">
          <p className="text-muted-foreground">You don't have access to financial statement reports.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">Financial Statements</h1>
            <p className="text-muted-foreground">
              P&L and Balance Sheet views derived from project financials
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              <Toggle
                pressed={viewMode === "aggregate"}
                onPressedChange={() => setViewMode("aggregate")}
                size="sm"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Building2 className="h-4 w-4 mr-1" />
                Company
              </Toggle>
              <Toggle
                pressed={viewMode === "per-project"}
                onPressedChange={() => setViewMode("per-project")}
                size="sm"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Layers className="h-4 w-4 mr-1" />
                Per Project
              </Toggle>
            </div>
            <MultiSelectFilter
              options={statusOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="All Statuses"
              icon={<ListFilter className="h-3.5 w-3.5" />}
              className="w-[180px]"
            />
            {viewMode === "per-project" && (
              <MultiSelectFilter
                options={projectOptions}
                selected={selectedProjectIds}
                onChange={setSelectedProjectIds}
                placeholder="All Projects"
                icon={<FolderKanban className="h-3.5 w-3.5" />}
                className="w-[220px]"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${[canViewPnL, canViewBS].filter(Boolean).length}, minmax(0, 1fr))` }}>
            {canViewPnL && (
              <TabsTrigger value="pnl" className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                <span>P&L Statement</span>
              </TabsTrigger>
            )}
            {canViewBS && (
              <TabsTrigger value="balance-sheet" className="flex items-center gap-1.5">
                <Scale className="h-4 w-4" />
                <span>Balance Sheet</span>
              </TabsTrigger>
            )}
          </TabsList>

          <div ref={printRef}>
            {canViewPnL && (
              <TabsContent value="pnl" className="mt-6">
                <PnLStatement
                  projects={filteredProjects}
                  allProjects={filteredProjects}
                  viewMode={viewMode}
                  onProjectClick={handleProjectClick}
                />
              </TabsContent>
            )}

            {canViewBS && (
              <TabsContent value="balance-sheet" className="mt-6">
                <BalanceSheet
                  projects={filteredProjects}
                  allProjects={filteredProjects}
                  viewMode={viewMode}
                  onProjectClick={handleProjectClick}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
