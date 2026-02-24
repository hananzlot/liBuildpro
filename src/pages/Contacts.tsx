import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, HardDrive, Merge, Search, Contact as ContactIcon } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import { ContactDetailSheet } from "@/components/dashboard/ContactDetailSheet";
import { MergeContactsDialog } from "@/components/dashboard/MergeContactsDialog";
import { DuplicateContactsDialog } from "@/components/dashboard/DuplicateContactsDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

const Contacts = () => {
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId?: string }>();
  const { isAdmin } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [mergePreselected, setMergePreselected] = useState<{ contactA: any; contactB: any } | undefined>();

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

  const handleMergeFromDuplicates = (pair: { contactA: any; contactB: any }) => {
    setDuplicateDialogOpen(false);
    setMergePreselected(pair);
    setMergeDialogOpen(true);
  };

  const handleMergeDialogClose = (open: boolean) => {
    setMergeDialogOpen(open);
    if (!open) {
      setMergePreselected(undefined);
    }
  };

  const totalCount = metrics?.allContacts?.length ?? 0;

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
      <div className="px-4 sm:px-6 py-5 space-y-4">
        {/* Page Header — card-first style */}
        <PageHeader
          title="Contacts"
          subtitle={isLoading ? "Loading..." : `${totalCount} total`}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setDuplicateDialogOpen(true)}
              >
                <Search className="h-3.5 w-3.5 mr-1" />
                Find Duplicates
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMergeDialogOpen(true)}>
                  <Merge className="h-3.5 w-3.5 mr-1" />
                  Merge Duplicates
                </Button>
              )}
              {!isGHLEnabled && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/20">
                  <HardDrive className="h-3 w-3" />
                  Local
                </div>
              )}
            </>
          }
        />

        {/* Contacts Table */}
        <section>
          {isLoading ? (
            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
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

      {/* Duplicate Detection Dialog */}
      <DuplicateContactsDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        contacts={metrics?.allContacts || []}
        opportunities={metrics?.allOpportunities || []}
        appointments={metrics?.allAppointments || []}
        onMerge={handleMergeFromDuplicates}
      />

      {/* Merge Contacts Dialog */}
      <MergeContactsDialog
        open={mergeDialogOpen}
        onOpenChange={handleMergeDialogClose}
        contacts={metrics?.allContacts || []}
        opportunities={metrics?.allOpportunities || []}
        appointments={metrics?.allAppointments || []}
        preselectedContacts={mergePreselected}
      />
    </AppLayout>
  );
};

export default Contacts;
