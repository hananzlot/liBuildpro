import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGHLMetrics, type DateRange } from "@/hooks/useGHLContacts";
import { useAuth } from "@/contexts/AuthContext";
import { FollowUpManagement } from "@/components/dashboard/FollowUpManagement";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

const FollowUp = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [dateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { from: start, to: end };
  });
  
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [oppDetailSheetOpen, setOppDetailSheetOpen] = useState(false);
  const [initialTaskGhlId, setInitialTaskGhlId] = useState<string | null>(null);

  const {
    data: metrics,
    isLoading,
    refetch
  } = useGHLMetrics(dateRange);

  const handleOpenOpportunity = (opportunity: any, taskGhlId?: string | null) => {
    setSelectedOpportunity(opportunity);
    setInitialTaskGhlId(taskGhlId || null);
    setOppDetailSheetOpen(true);
  };

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'audit':
        navigate('/audit-log');
        break;
    }
  };

  return (
    <AppLayout onAdminAction={isAdmin ? handleAdminAction : undefined}>
      <div className="px-6 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Follow-up Management</h2>
          <p className="text-sm text-muted-foreground">Track appointments and opportunities that need attention</p>
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

      {/* Opportunity Detail Sheet */}
      <OpportunityDetailSheet 
        opportunity={selectedOpportunity} 
        appointments={metrics?.allAppointments || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        open={oppDetailSheetOpen} 
        onOpenChange={open => {
          setOppDetailSheetOpen(open);
          if (!open) setInitialTaskGhlId(null);
        }} 
        allOpportunities={metrics?.allOpportunities || []} 
        initialTaskGhlId={initialTaskGhlId} 
      />
    </AppLayout>
  );
};

export default FollowUp;
