import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigate, useParams } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAnalyticsPermissions } from "@/hooks/useAnalyticsPermissions";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PnLStatement } from "@/components/production/analytics/PnLStatement";
import { BalanceSheet } from "@/components/production/analytics/BalanceSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Scale } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function FinancialStatements() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const { visibleReports, canViewReport, isLoading: permissionsLoading } = useAnalyticsPermissions();

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Statements</h1>
          <p className="text-muted-foreground">
            P&L and Balance Sheet views derived from project financials
          </p>
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
              <PnLStatement projects={projects} onProjectClick={handleProjectClick} />
            </TabsContent>
          )}

          {canViewBS && (
            <TabsContent value="balance-sheet" className="mt-6">
              <BalanceSheet projects={projects} onProjectClick={handleProjectClick} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
