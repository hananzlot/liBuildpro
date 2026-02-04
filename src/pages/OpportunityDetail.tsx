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
      if (!id || !companyId) return null;
      
      // Try by ghl_id first (most common from search), then by UUID
      // Check if id looks like a UUID (contains dashes and is 36 chars)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let query = supabase
        .from("opportunities")
        .select("*")
        .eq("company_id", companyId);
      
      if (isUUID) {
        // If it's a UUID, try matching both id and ghl_id
        query = query.or(`id.eq.${id},ghl_id.eq.${id}`);
      } else {
        // If it's not a UUID, only match ghl_id
        query = query.eq("ghl_id", id);
      }
      
      const { data, error } = await query.maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!companyId,
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
          onOpenChange={() => {
            // In page mode, don't auto-close on onOpenChange events.
            // The tab should remain open until explicitly closed via the tab bar.
          }}
          onClose={handleClose}
          mode="page"
        />
      </div>
    </AppLayout>
  );
}
