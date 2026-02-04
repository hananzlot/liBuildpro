import { AppLayout } from "@/components/layout/AppLayout";
import { AnalyticsSection } from "@/components/production/AnalyticsSection";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";

export default function Analytics() {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || undefined;
  const initialKPI = searchParams.get('kpi') || undefined;

  const handleProjectClick = (
    projectId: string, 
    initialTab?: string, 
    returnTo?: 'payables' | 'outstandingAR', 
    financeSubTab?: 'bills' | 'history',
    highlightInvoiceId?: string
  ) => {
    // Build URL with query params for state
    let url = `/project/${projectId}`;
    const params = new URLSearchParams();
    if (initialTab) params.set('tab', initialTab);
    if (financeSubTab) params.set('financeSubTab', financeSubTab);
    if (highlightInvoiceId) params.set('highlightInvoice', highlightInvoiceId);
    if (returnTo) params.set('returnTo', returnTo);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    // Open as tab
    openTab(url, `Project ${projectId.slice(0, 8)}`);
  };

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Financial analytics, profitability, and cash flow insights
            </p>
          </div>
        </div>
        
        <AnalyticsSection 
          onProjectClick={handleProjectClick}
          initialTab={initialTab}
          initialKPI={initialKPI}
        />
      </div>
    </AppLayout>
  );
}
