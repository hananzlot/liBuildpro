import { useMemo, useRef, useEffect, useState, useCallback } from "react";
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
  const [refreshSignal, setRefreshSignal] = useState(0);

  const {
    data: metrics,
    isLoading,
    refetch
  } = useGHLMetrics(undefined);

  // Cache the last valid opportunity to prevent sheet from closing during refetches
  const lastValidOpportunityRef = useRef<any>(null);

  // Derive selected opportunity from URL param
  const selectedOpportunity = useMemo(() => {
    if (!opportunityId) return null;
    if (!metrics?.allOpportunities?.length) {
      // Return cached opportunity during loading/refetch
      return lastValidOpportunityRef.current;
    }
    const found = metrics.allOpportunities.find(
      (o: any) => o.id === opportunityId || o.ghl_id === opportunityId
    ) || null;
    return found;
  }, [opportunityId, metrics?.allOpportunities]);

  // Update the cache when we have a valid opportunity
  useEffect(() => {
    if (selectedOpportunity && opportunityId) {
      lastValidOpportunityRef.current = selectedOpportunity;
    }
    // Clear cache when sheet is closed
    if (!opportunityId) {
      lastValidOpportunityRef.current = null;
    }
  }, [selectedOpportunity, opportunityId]);

  // Modal open state derived from URL - stays open as long as URL has opportunityId
  const oppDetailSheetOpen = !!opportunityId;

  const handleDetailSheetClose = (open: boolean) => {
    if (!open) {
      navigate("/follow-up", { replace: true });
      // Refetch data so follow-up lists clear resolved records
      refetch();
      setRefreshSignal(s => s + 1);
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
          {!isAdmin && (
            <OpportunitySearch
              opportunities={metrics?.allOpportunities || []}
              appointments={metrics?.allAppointments || []}
              contacts={metrics?.allContacts || []}
              users={metrics?.users || []}
            />
          )}
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
            refreshSignal={refreshSignal}
          />
        )}
      </div>

      {/* Opportunity Detail Sheet - open state derived from URL, uses cached opportunity during refetches */}
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
