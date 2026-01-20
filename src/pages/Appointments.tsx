import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, HardDrive } from "lucide-react";
import { useGHLMetrics, useSyncContacts, type DateRange } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentsTable } from "@/components/dashboard/AppointmentsTable";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Appointments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { from: start, to: end };
  });
  
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [appointmentDetailSheetOpen, setAppointmentDetailSheetOpen] = useState(false);

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(dateRange);

  const syncMutation = useSyncContacts();

  const handleSync = async () => {
    toast.info("Syncing all data from GHL...");
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Sync complete! ${result.total} contacts synced`);
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
        <div className="flex items-center gap-4">
          {!isLoading && (
            <OpportunitySearch 
              opportunities={metrics?.allOpportunities || []} 
              appointments={metrics?.allAppointments || []} 
              contacts={metrics?.allContacts || []} 
              users={metrics?.users || []} 
              conversations={metrics?.conversations || []} 
            />
          )}
        </div>
      }
    >
      <div className="px-6 py-6 space-y-6">
        {/* Top Actions Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>
          <div className="flex items-center gap-2">
            {!isGHLEnabled && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
                <HardDrive className="h-3 w-3" />
                Local Mode
              </div>
            )}
          </div>
        </div>

        {/* Appointments Table */}
        <section>
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <AppointmentsTable 
              appointments={metrics?.allAppointments || []} 
              opportunities={metrics?.allOpportunities || []} 
              contacts={metrics?.allContacts || []} 
              users={metrics?.users || []} 
            />
          )}
        </section>
      </div>

      {/* Appointment Detail Sheet */}
      <AppointmentDetailSheet
        open={appointmentDetailSheetOpen}
        onOpenChange={setAppointmentDetailSheetOpen}
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
