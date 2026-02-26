import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, HardDrive } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentsTable } from "@/components/dashboard/AppointmentsTable";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

const Appointments = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { user, isAdmin } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  const [filteredCount, setFilteredCount] = useState(0);

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(undefined);

  const syncMutation = useSyncContacts();

  // Derive selected appointment from URL param
  const selectedAppointment = useMemo(() => {
    if (!appointmentId || !metrics?.allAppointments?.length) return null;
    return metrics.allAppointments.find(
      (a: any) => a.id === appointmentId || a.ghl_id === appointmentId
    ) || null;
  }, [appointmentId, metrics?.allAppointments]);

  // Modal open state derived from URL
  const appointmentDetailSheetOpen = !!appointmentId;

  const handleDetailSheetClose = (open: boolean) => {
    if (!open) {
      navigate("/appointments", { replace: true });
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
      <div className="px-4 sm:px-6 py-5 space-y-4">
        {/* Page Header — card-first style */}
        <PageHeader
          title="Appointments"
          subtitle={isLoading ? "Loading..." : `${filteredCount} filtered`}
          actions={
            !isGHLEnabled ? (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/20">
                <HardDrive className="h-3 w-3" />
                Local
              </div>
            ) : undefined
          }
        />

        {/* Appointments Table */}
        <section>
          {isLoading ? (
            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/40">
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="divide-y divide-border/30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4">
                    <Skeleton className="h-4 w-[28%]" />
                    <Skeleton className="h-4 w-[18%]" />
                    <Skeleton className="h-4 w-[10%]" />
                    <Skeleton className="h-4 w-[11%]" />
                    <Skeleton className="h-4 w-[16%]" />
                    <Skeleton className="h-4 w-[10%]" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <AppointmentsTable 
              appointments={metrics?.allAppointments || []} 
              opportunities={metrics?.allOpportunities || []} 
              contacts={metrics?.allContacts || []} 
              users={metrics?.users || []} 
              salespeople={metrics?.salespeople || []}
              onFilteredCountChange={setFilteredCount}
            />
          )}
        </section>
      </div>

      {/* Appointment Detail Sheet - open state derived from URL */}
      <AppointmentDetailSheet
        open={appointmentDetailSheetOpen}
        onOpenChange={handleDetailSheetClose}
        appointment={selectedAppointment}
        contacts={metrics?.allContacts || []}
        users={metrics?.users || []}
        opportunities={metrics?.allOpportunities || []}
        appointments={metrics?.allAppointments || []}
        onRefresh={() => refetch()}
      />
    </AppLayout>
  );
};

export default Appointments;
