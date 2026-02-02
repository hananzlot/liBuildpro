import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";

/**
 * Full-page Appointment Detail that opens in its own tab.
 * Route: /appointment/:id
 */
export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  
  // Fetch appointment data
  const { data: appointment, isLoading, refetch } = useQuery({
    queryKey: ["appointment-detail", id, companyId],
    queryFn: async () => {
      if (!id) return null;
      
      // Try by UUID first, then by ghl_id
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`id.eq.${id},ghl_id.eq.${id}`)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch related data
  const { data: relatedData } = useQuery({
    queryKey: ["appointment-related", companyId],
    queryFn: async () => {
      const [contactsRes, usersRes, opportunitiesRes, appointmentsRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("company_id", companyId),
        supabase.from("ghl_users").select("*"),
        supabase.from("opportunities").select("*").eq("company_id", companyId),
        supabase.from("appointments").select("*").eq("company_id", companyId),
      ]);
      
      return {
        contacts: contactsRes.data || [],
        users: usersRes.data || [],
        opportunities: opportunitiesRes.data || [],
        appointments: appointmentsRes.data || [],
      };
    },
    enabled: !!companyId,
  });
  
  const handleClose = () => {
    navigate("/appointments");
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

  if (!appointment) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">Appointment not found</p>
          <Button variant="outline" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Appointments
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full appointment-detail-page">
        <AppointmentDetailSheet
          appointment={appointment}
          contacts={relatedData?.contacts || []}
          users={relatedData?.users || []}
          opportunities={relatedData?.opportunities || []}
          appointments={relatedData?.appointments || []}
          open={true}
          onOpenChange={(open) => {
            if (!open) handleClose();
          }}
          onRefresh={() => refetch()}
          mode="page"
        />
      </div>
    </AppLayout>
  );
}
