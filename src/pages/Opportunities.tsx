import { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Database, HardDrive, Merge, Download } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { OpportunitiesTable } from "@/components/dashboard/OpportunitiesTable";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { MergeOpportunitiesDialog } from "@/components/dashboard/MergeOpportunitiesDialog";
import { DuplicateOpportunitiesAlert } from "@/components/dashboard/DuplicateOpportunitiesAlert";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { parseISO } from "date-fns";

// Helper to parse date range from URL params
function parseDateRangeFromParams(searchParams: URLSearchParams): DateRange | undefined {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from) {
    try {
      return {
        from: parseISO(from),
        to: to ? parseISO(to) : undefined,
      };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const Opportunities = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { opportunityId } = useParams<{ opportunityId?: string }>();
  const { user, isAdmin } = useAuth();
  const { isGHLEnabled } = useGHLMode();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [preselectedOpportunities, setPreselectedOpportunities] = useState<{ oppA: any; oppB: any } | null>(null);
  const [showAlternatingColors, setShowAlternatingColors] = useState(true);
  const [downloadCSVFn, setDownloadCSVFn] = useState<(() => void) | null>(null);
  
  // Derive filter state directly from URL params (single source of truth)
  const tableDateField = useMemo<"updatedDate" | "createdDate">(() => {
    return searchParams.get("dateField") === "createdDate" ? "createdDate" : "updatedDate";
  }, [searchParams]);
  
  const tableDateRange = useMemo<DateRange | undefined>(() => {
    return parseDateRangeFromParams(searchParams);
  }, [searchParams]);

  // Handler to update URL params (which will automatically update derived state)
  const handleDateFieldChange = useCallback((value: "updatedDate" | "createdDate") => {
    const params = new URLSearchParams(searchParams);
    if (value === "createdDate") {
      params.set("dateField", "createdDate");
    } else {
      params.delete("dateField");
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (range?.from) {
      params.set("from", range.from.toISOString().split("T")[0]);
      if (range.to) {
        params.set("to", range.to.toISOString().split("T")[0]);
      } else {
        params.delete("to");
      }
    } else {
      params.delete("from");
      params.delete("to");
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">Opportunities</h1>
            <div className="flex items-center gap-1.5">
              <Select value={tableDateField} onValueChange={(v) => handleDateFieldChange(v as "updatedDate" | "createdDate")}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="updatedDate">Last Edited</SelectItem>
                  <SelectItem value="createdDate">Created</SelectItem>
                </SelectContent>
              </Select>
              <DateRangeFilter 
                dateRange={tableDateRange} 
                onDateRangeChange={handleDateRangeChange} 
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={showAlternatingColors ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setShowAlternatingColors(!showAlternatingColors)}
              title={showAlternatingColors ? "Disable alternating row colors" : "Enable alternating row colors"}
            >
              Stripes
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => downloadCSVFn?.()}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => {
                setPreselectedOpportunities(null);
                setMergeDialogOpen(true);
              }}>
                <Merge className="h-3.5 w-3.5 mr-1" />
                Merge
              </Button>
            )}
            {!isGHLEnabled && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning-foreground text-xs font-medium rounded-full border border-warning/20">
                <HardDrive className="h-3 w-3" />
                Local
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
              tableDateField={tableDateField}
              tableDateRange={tableDateRange}
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
