import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, HardDrive } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import { ContactDetailSheet } from "@/components/dashboard/ContactDetailSheet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Contacts = () => {
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId?: string }>();
  const { isGHLEnabled } = useGHLMode();

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(undefined);

  const syncMutation = useSyncContacts();

  // Derive selected contact from URL param
  const selectedContact = useMemo(() => {
    if (!contactId || !metrics?.allContacts?.length) return null;
    return metrics.allContacts.find(
      (c: any) => c.id === contactId || c.ghl_id === contactId
    ) || null;
  }, [contactId, metrics?.allContacts]);

  // Modal open state derived from URL
  const contactDetailSheetOpen = !!contactId;

  const handleDetailSheetClose = (open: boolean) => {
    if (!open) {
      navigate("/contacts", { replace: true });
    }
  };

  const handleSync = async () => {
    toast.info("Syncing recent data from GHL...");
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
    <AppLayout onAdminAction={handleAdminAction}>
      <div className="px-6 py-6 space-y-6">
        {/* Top Actions Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          {!isGHLEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
              <HardDrive className="h-3 w-3" />
              Local Mode
            </div>
          )}
        </div>

        {/* Contacts Table */}
        <section>
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <ContactsTable 
              contacts={metrics?.allContacts || []} 
              opportunities={metrics?.allOpportunities || []}
              appointments={metrics?.allAppointments || []}
              users={metrics?.users || []}
            />
          )}
        </section>
      </div>

      {/* Contact Detail Sheet - open state derived from URL */}
      <ContactDetailSheet
        open={contactDetailSheetOpen}
        onOpenChange={handleDetailSheetClose}
        contact={selectedContact}
        opportunities={metrics?.allOpportunities || []}
        appointments={metrics?.allAppointments || []}
        users={metrics?.users || []}
        conversations={metrics?.conversations || []}
        onRefresh={() => refetch()}
      />
    </AppLayout>
  );
};

export default Contacts;
