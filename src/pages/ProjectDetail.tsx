import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProjectDetailSheet } from "@/components/production/ProjectDetailSheet";

/**
 * Full-page Project Detail that opens in its own tab.
 * Route: /project/:id
 */
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  
  // Read tab/subtab from search params reactively so navigation to the same
  // project with different highlight params updates correctly.
  const initialTab = searchParams.get("tab") || undefined;
  const initialFinanceSubTab = (searchParams.get("financeTab") as 'bills' | 'history') || undefined;
  const initialFinanceSection = searchParams.get("financeSubTab") || undefined;
  const highlightInvoiceId = searchParams.get("highlightInvoiceId") || searchParams.get("highlightInvoice") || undefined;
  const highlightBillId = searchParams.get("highlightBillId") || searchParams.get("highlightBill") || undefined;
  const highlightPaymentId = searchParams.get("highlightPaymentId") || searchParams.get("highlightPayment") || undefined;
  
  // Fetch project data
  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ["project-detail", id, companyId],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  
  const handleClose = () => {
    navigate("/production");
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="outline" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Production
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full project-detail-page">
        <ProjectDetailSheet
          project={project}
          open={true}
          onOpenChange={() => {
            // In page mode, don't auto-close on onOpenChange events.
            // The tab should remain open until explicitly closed via the tab bar.
          }}
          onClose={handleClose}
          onUpdate={() => refetch()}
          initialTab={initialTab}
          initialFinanceSectionTab={initialFinanceSection}
          initialFinanceSubTab={initialFinanceSubTab}
          highlightInvoiceId={highlightInvoiceId}
          highlightBillId={highlightBillId}
          highlightPaymentId={highlightPaymentId}
          mode="page"
        />
      </div>
    </AppLayout>
  );
}
