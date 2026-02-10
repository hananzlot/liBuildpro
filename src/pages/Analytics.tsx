import { AppLayout } from "@/components/layout/AppLayout";
import { AnalyticsSection } from "@/components/production/AnalyticsSection";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAnalyticsPermissions } from "@/hooks/useAnalyticsPermissions";
import { useEffect, useRef } from "react";

export default function Analytics() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const [searchParams] = useSearchParams();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const filtersRef = useRef<HTMLDivElement>(null);
  
  const { visibleReports, isLoading: permissionsLoading } = useAnalyticsPermissions();
  
  // Use route param as initial tab, fall back to search param, then first visible report
  const initialTab = routeTab || searchParams.get('tab') || undefined;
  const initialKPI = searchParams.get('kpi') || undefined;

  // Redirect to first visible report if on base /analytics route
  useEffect(() => {
    if (!routeTab && !permissionsLoading && visibleReports.length > 0) {
      // Only redirect analytics tabs (not outstanding_ap/ar which have their own routes)
      const analyticsTabs = visibleReports.filter(r => !r.startsWith('outstanding_'));
      if (analyticsTabs.length > 0) {
        navigate(`/analytics/${analyticsTabs[0]}`, { replace: true });
      }
    }
  }, [routeTab, permissionsLoading, visibleReports, navigate]);

  const handleProjectClick = (
    projectId: string, 
    initialTab?: string, 
    returnTo?: 'payables' | 'outstandingAR', 
    financeSubTab?: 'bills' | 'history',
    highlightInvoiceId?: string
  ) => {
    let url = `/project/${projectId}`;
    const params = new URLSearchParams();
    if (initialTab) params.set('tab', initialTab);
    if (financeSubTab) params.set('financeSubTab', financeSubTab);
    if (highlightInvoiceId) params.set('highlightInvoice', highlightInvoiceId);
    if (returnTo) params.set('returnTo', returnTo);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    openTab(url, `Project ${projectId.slice(0, 8)}`);
  };

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Financial analytics, profitability, and cash flow insights
            </p>
          </div>
          <div ref={filtersRef} className="flex-1 flex justify-end" />
        </div>
        
        <AnalyticsSection 
          onProjectClick={handleProjectClick}
          initialTab={initialTab}
          initialKPI={initialKPI}
          visibleReports={visibleReports}
          filtersContainerRef={filtersRef}
        />
      </div>
    </AppLayout>
  );
}
