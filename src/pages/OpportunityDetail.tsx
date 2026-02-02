import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";

/**
 * Full-page Opportunity Detail that opens in its own tab.
 * Route: /opportunity/:id
 */
export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  
  // Fetch opportunity data
  const { data: opportunity, isLoading, refetch } = useQuery({
    queryKey: ["opportunity-detail", id, companyId],
    queryFn: async () => {
      if (!id) return null;
      
      // Try by UUID first, then by ghl_id
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .or(`id.eq.${id},ghl_id.eq.${id}`)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch related data (contacts, users, appointments)
  const { data: relatedData } = useQuery({
    queryKey: ["opportunity-related", companyId],
    queryFn: async () => {
      const [contactsRes, usersRes, appointmentsRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("company_id", companyId),
        supabase.from("ghl_users").select("*"),
        supabase.from("appointments").select("*").eq("company_id", companyId),
      ]);
      
      return {
        contacts: contactsRes.data || [],
        users: usersRes.data || [],
        appointments: appointmentsRes.data || [],
      };
    },
    enabled: !!companyId,
  });
  
  const handleClose = () => {
    navigate("/opportunities");
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

  if (!opportunity) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">Opportunity not found</p>
          <Button variant="outline" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Opportunities
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full opportunity-detail-page">
        <OpportunityDetailSheet
          opportunity={opportunity}
          contacts={relatedData?.contacts || []}
          users={relatedData?.users || []}
          appointments={relatedData?.appointments || []}
          open={true}
          onOpenChange={(open) => {
            if (!open) handleClose();
          }}
          mode="page"
        />
      </div>
    </AppLayout>
  );
}
