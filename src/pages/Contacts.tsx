import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, HardDrive, Merge, Contact as ContactIcon } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import { ContactDetailSheet } from "@/components/dashboard/ContactDetailSheet";
import { MergeContactsDialog } from "@/components/dashboard/MergeContactsDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const Contacts = () => {
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId?: string }>();
  const { isAdmin } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

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
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="outline" onClick={() => setMergeDialogOpen(true)}>
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

        {/* Contacts Table */}
        <section>
          {isLoading ? (
            <div className="rounded-lg border bg-card p-0 overflow-hidden">
              {/* Table skeleton: header + rows */}
              <div className="border-b px-4 py-3 flex gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-24" />
                ))}
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-4 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : metrics?.allContacts?.length === 0 ? (
            <EmptyState
              icon={ContactIcon}
              title="No contacts yet"
              description="Contacts will appear here once synced from your CRM or added manually."
              action={
                <Button onClick={handleSync} disabled={syncMutation.isPending}>
                  <Database className="h-4 w-4 mr-2" />
                  Sync from GHL
                </Button>
              }
            />
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

      {/* Merge Contacts Dialog */}
      <MergeContactsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        contacts={metrics?.allContacts || []}
        opportunities={metrics?.allOpportunities || []}
        appointments={metrics?.allAppointments || []}
      />
    </AppLayout>
  );
};

export default Contacts;
