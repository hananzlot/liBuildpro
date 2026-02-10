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
import { FileSpreadsheet, Scale, Building2, Layers, FolderKanban } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  // Filtered projects for per-project view
  const filteredProjects = useMemo(() => {
    if (selectedProjectIds.length === 0) return projects;
    return projects.filter(p => selectedProjectIds.includes(p.id));
  }, [projects, selectedProjectIds]);

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

          {canViewPnL && (
            <TabsContent value="pnl" className="mt-6">
              <PnLStatement
                projects={filteredProjects}
                allProjects={projects}
                viewMode={viewMode}
                onProjectClick={handleProjectClick}
              />
            </TabsContent>
          )}

          {canViewBS && (
            <TabsContent value="balance-sheet" className="mt-6">
              <BalanceSheet
                projects={filteredProjects}
                allProjects={projects}
                viewMode={viewMode}
                onProjectClick={handleProjectClick}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
