import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGHLMetrics, type DateRange } from "@/hooks/useGHLContacts";
import { useAuth } from "@/contexts/AuthContext";
import { FollowUpManagement } from "@/components/dashboard/FollowUpManagement";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

const FollowUp = () => {
  const navigate = useNavigate();
  const { opportunityId, taskGhlId } = useParams<{ opportunityId?: string; taskGhlId?: string }>();
  const { isAdmin, isSimulating } = useAuth();

  const {
    data: metrics,
    isLoading,
    refetch
  } = useGHLMetrics(undefined);

  // Derive selected opportunity from URL param
  const selectedOpportunity = useMemo(() => {
    if (!opportunityId || !metrics?.allOpportunities?.length) return null;
    return metrics.allOpportunities.find(
      (o: any) => o.id === opportunityId || o.ghl_id === opportunityId
    ) || null;
  }, [opportunityId, metrics?.allOpportunities]);

  // Modal open state derived from URL
  const oppDetailSheetOpen = !!opportunityId;

  const handleDetailSheetClose = (open: boolean) => {
    if (!open) {
      navigate("/follow-up", { replace: true });
    }
  };

  const handleOpenOpportunity = (opportunity: any, taskGhlIdParam?: string | null) => {
    const oppId = opportunity.ghl_id || opportunity.id;
    if (taskGhlIdParam) {
      navigate(`/follow-up/opportunity/${oppId}/task/${taskGhlIdParam}`);
    } else {
      navigate(`/follow-up/opportunity/${oppId}`);
    }
  };

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'audit':
        navigate('/audit-log');
        break;
    }
  };

  return (
    <AppLayout onAdminAction={(isAdmin || isSimulating) ? handleAdminAction : undefined}>
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Follow-up Management</h2>
            <p className="text-sm text-muted-foreground">Track appointments and opportunities that need attention</p>
          </div>
          <OpportunitySearch
            opportunities={metrics?.allOpportunities || []}
            appointments={metrics?.allAppointments || []}
            contacts={metrics?.allContacts || []}
            users={metrics?.users || []}
          />
        </div>
        
        {isLoading ? (
          <Skeleton className="h-[400px] rounded-2xl" />
        ) : (
          <FollowUpManagement 
            opportunities={metrics?.allOpportunities || []} 
            appointments={metrics?.allAppointments || []} 
            contacts={metrics?.allContacts || []} 
            users={metrics?.users || []} 
            contactNotes={metrics?.contactNotes || []} 
            tasks={metrics?.tasks || []} 
            onOpenOpportunity={handleOpenOpportunity} 
            onDataRefresh={refetch} 
          />
        )}
      </div>

      {/* Opportunity Detail Sheet - open state derived from URL */}
      <OpportunityDetailSheet 
        opportunity={selectedOpportunity} 
        appointments={metrics?.allAppointments || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        open={oppDetailSheetOpen} 
        onOpenChange={handleDetailSheetClose} 
        allOpportunities={metrics?.allOpportunities || []} 
        initialTaskGhlId={taskGhlId || null} 
      />
    </AppLayout>
  );
};

export default FollowUp;
