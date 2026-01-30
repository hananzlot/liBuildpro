import { useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, HardDrive, Merge, Download } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { OpportunitiesTable } from "@/components/dashboard/OpportunitiesTable";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { MergeOpportunitiesDialog } from "@/components/dashboard/MergeOpportunitiesDialog";
import { DuplicateOpportunitiesAlert } from "@/components/dashboard/DuplicateOpportunitiesAlert";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Opportunities = () => {
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId?: string }>();
  const { user, isAdmin } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [preselectedOpportunities, setPreselectedOpportunities] = useState<{ oppA: any; oppB: any } | null>(null);
  const [showAlternatingColors, setShowAlternatingColors] = useState(true);
  const [downloadCSVFn, setDownloadCSVFn] = useState<(() => void) | null>(null);

  const handleDownloadCSVCallback = useCallback((fn: () => void) => {
    setDownloadCSVFn(() => fn);
  }, []);

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(undefined);

  const syncMutation = useSyncContacts();

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
      navigate("/opportunities", { replace: true });
    }
  };

  const handleSync = async () => {
    toast.info("Syncing recent data from GHL...");
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Sync complete! ${result.opportunities} opportunities, ${result.total} contacts, ${result.appointments} appointments synced`);
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'audit':
        navigate('/audit-log');
        break;
    }
  };

  if (error) {
    return (
      <AppLayout onAdminAction={handleAdminAction}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Failed to load data</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
              <Button onClick={handleSync} disabled={syncMutation.isPending}>
                <Database className="h-4 w-4 mr-2" />
                Sync from GHL
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      onAdminAction={handleAdminAction}
      headerContent={
        !isAdmin && !isLoading ? (
          <OpportunitySearch 
            opportunities={metrics?.allOpportunities || []} 
            appointments={metrics?.allAppointments || []} 
            contacts={metrics?.allContacts || []} 
            users={metrics?.users || []} 
            conversations={metrics?.conversations || []} 
          />
        ) : undefined
      }
    >
      <div className="px-6 py-6 space-y-6">
        {/* Duplicate Opportunities Alert */}
        {isAdmin && !isLoading && (
          <DuplicateOpportunitiesAlert
            opportunities={metrics?.allOpportunities || []}
            contacts={metrics?.allContacts || []}
            onSelectDuplicate={(oppA, oppB) => {
              setPreselectedOpportunities({ oppA, oppB });
              setMergeDialogOpen(true);
            }}
          />
        )}

        {/* Top Actions Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={showAlternatingColors ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowAlternatingColors(!showAlternatingColors)}
              title={showAlternatingColors ? "Disable alternating row colors" : "Enable alternating row colors"}
            >
              {showAlternatingColors ? "Stripes: On" : "Stripes: Off"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCSVFn?.()} className="gap-1.5">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => {
                setPreselectedOpportunities(null);
                setMergeDialogOpen(true);
              }}>
                <Merge className="h-4 w-4 mr-2" />
                Merge Duplicates
              </Button>
            )}
            {!isGHLEnabled && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 text-warning-foreground text-xs font-medium rounded-full border border-warning/20">
                <HardDrive className="h-3 w-3" />
                Local Mode
              </div>
            )}
          </div>
        </div>

        {/* Opportunities Table */}
        <section>
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <OpportunitiesTable 
              opportunities={metrics?.allOpportunities || []} 
              appointments={metrics?.allAppointments || []} 
              contacts={metrics?.allContacts || []} 
              users={metrics?.users || []} 
              conversations={metrics?.conversations || []} 
              notes={metrics?.contactNotes || []} 
              tasks={metrics?.tasks || []} 
              showAlternatingColors={showAlternatingColors}
              onAlternatingColorsChange={setShowAlternatingColors}
              onDownloadCSV={handleDownloadCSVCallback}
            />
          )}
        </section>
      </div>

      {/* Opportunity Detail Sheet - open state derived from URL */}
      <OpportunityDetailSheet
        open={oppDetailSheetOpen}
        onOpenChange={handleDetailSheetClose}
        opportunity={selectedOpportunity}
        contacts={metrics?.allContacts || []}
        appointments={metrics?.allAppointments || []}
        users={metrics?.users || []}
        conversations={metrics?.conversations || []}
        allOpportunities={metrics?.allOpportunities || []}
        initialTaskGhlId={null}
      />

      {/* Merge Opportunities Dialog */}
      <MergeOpportunitiesDialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) setPreselectedOpportunities(null);
        }}
        opportunities={metrics?.allOpportunities || []}
        contacts={metrics?.allContacts || []}
        users={metrics?.users || []}
        appointments={metrics?.allAppointments || []}
        preselectedOpportunities={preselectedOpportunities || undefined}
      />
    </AppLayout>
  );
};

export default Opportunities;
