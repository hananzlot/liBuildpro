import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Database, DollarSign, CalendarCheck, Trophy, Pencil, BookOpen, Receipt, HardDrive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGHLMetrics, useSyncContacts, useSyncGHL2, type DateRange } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useKPIVisibility } from "@/hooks/useKPIVisibility";
import { ClickableMetricCard } from "@/components/dashboard/ClickableMetricCard";
import { SourceChart } from "@/components/dashboard/SourceChart";
import { SalesRepLeaderboard } from "@/components/dashboard/SalesRepLeaderboard";
import { RecentWonDeals } from "@/components/dashboard/RecentWonDeals";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { WonOpportunitiesSheet } from "@/components/dashboard/WonOpportunitiesSheet";
import { UpcomingAppointmentsSheet } from "@/components/dashboard/UpcomingAppointmentsSheet";
import { OpportunitiesSheet } from "@/components/dashboard/OpportunitiesSheet";
import { DateRangeAppointmentsSheet } from "@/components/dashboard/DateRangeAppointmentsSheet";
import { CallLogsSheet } from "@/components/dashboard/CallLogsSheet";
import { ActivitySheet } from "@/components/dashboard/ActivitySheet";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AdminCleanup } from "@/components/dashboard/AdminCleanup";
import { SourceManagement } from "@/components/dashboard/SourceManagement";
import { UserManagement } from "@/components/dashboard/UserManagement";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";
import { NewEntryDialog } from "@/components/dashboard/NewEntryDialog";
import { SyncDropdown } from "@/components/dashboard/SyncDropdown";
import { OpportunitySalesSheet } from "@/components/dashboard/OpportunitySalesSheet";
import { AppointmentsAnalysisDialog } from "@/components/dashboard/AppointmentsAnalysisDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    isMagazine,
    isProduction,
    isSimulating,
  } = useAuth();
  const { companyId } = useCompanyContext();
  const { isGHLEnabled } = useGHLMode();
  const { visibility: kpiVisibility } = useKPIVisibility();
  
  // Show welcome screen state - persisted in sessionStorage
  const [showWelcome, setShowWelcome] = useState(() => {
    const dismissed = sessionStorage.getItem('crm-welcome-dismissed');
    return !dismissed;
  });

  // Fetch company name from app_settings
  const { data: companyName } = useQuery({
    queryKey: ["company-name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "company_name")
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || "Your Company";
    },
  });

  const handleEnterDashboard = () => {
    sessionStorage.setItem('crm-welcome-dismissed', 'true');
    setShowWelcome(false);
  };
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { from: start, to: end };
  });
  
  const [wonOpportunitiesSheetOpen, setWonOpportunitiesSheetOpen] = useState(false);
  const [upcomingAppointmentsSheetOpen, setUpcomingAppointmentsSheetOpen] = useState(false);
  const [opportunitiesSheetOpen, setOpportunitiesSheetOpen] = useState(false);
  const [dateRangeAppointmentsSheetOpen, setDateRangeAppointmentsSheetOpen] = useState(false);
  const [dateRangeAppointmentsFilter, setDateRangeAppointmentsFilter] = useState<string>("all");
  const [callLogsSheetOpen, setCallLogsSheetOpen] = useState(false);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [activityDefaultTab, setActivityDefaultTab] = useState<"edits" | "appointments" | "tasks" | "notes">("edits");
  const [opportunitySalesSheetOpen, setOpportunitySalesSheetOpen] = useState(false);
  const [appointmentsAnalysisOpen, setAppointmentsAnalysisOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [oppDetailSheetOpen, setOppDetailSheetOpen] = useState(false);
  const [initialTaskGhlId, setInitialTaskGhlId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [appointmentDetailSheetOpen, setAppointmentDetailSheetOpen] = useState(false);
  const [sourceManagementOpen, setSourceManagementOpen] = useState(false);
  const [adminCleanupOpen, setAdminCleanupOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);

  // Redirect production-only users to the production page
  // Don't redirect when an admin is simulating a role
  useEffect(() => {
    if (isProduction && !isAdmin && !isSimulating) {
      navigate("/production");
    }
  }, [isProduction, isAdmin, isSimulating, navigate]);

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(dateRange);

  // Fetch magazine sales for dashboard KPI (only if user has access)
  const { data: magazineSales = [] } = useQuery({
    queryKey: ["magazine-sales-dashboard", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("magazine_sales").select("price, page_size, sections_sold");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && (isAdmin || isMagazine)
  });

  // Calculate magazine sales total
  const magazineSalesTotal = useMemo(() => {
    return magazineSales.reduce((sum, sale) => sum + Number(sale.price || 0), 0);
  }, [magazineSales]);

  const syncMutation = useSyncContacts();
  const syncGHL2Mutation = useSyncGHL2();

  const handleOpenOpportunity = (opportunity: any, taskGhlId?: string | null) => {
    setSelectedOpportunity(opportunity);
    setInitialTaskGhlId(taskGhlId || null);
    setOppDetailSheetOpen(true);
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

  const handleSyncGHL2 = async () => {
    toast.info("Importing from GHL Location 2...");
    try {
      const result = await syncGHL2Mutation.mutateAsync();
      toast.success(`GHL2 sync complete! ${result.contactsImported} contacts and ${result.opportunitiesImported} opportunities imported`);
    } catch (err) {
      toast.error(`GHL2 sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'cleanup':
        setAdminCleanupOpen(true);
        break;
      case 'sources':
        setSourceManagementOpen(true);
        break;
      case 'users':
        setUserManagementOpen(true);
        break;
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

  // Welcome screen for admins
  if (showWelcome && isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              {companyName || "Your Company"}
            </h1>
            <p className="text-2xl md:text-3xl font-light text-muted-foreground">
              CRM App
            </p>
          </div>
          <Button 
            size="lg" 
            onClick={handleEnterDashboard}
            className="px-8 py-6 text-lg"
          >
            Enter Dashboard
          </Button>
        </div>
      </div>
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
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          <div className="flex items-center gap-2">
            {dateRange?.from && (
              <p className="text-sm text-muted-foreground">
                Showing {metrics?.totalLeads || 0} leads in selected range
              </p>
            )}
            {!isLoading && <NewEntryDialog users={metrics?.users || []} onSuccess={refetch} userId={user?.id} />}
            <SyncDropdown 
              onSyncGHL={handleSync} 
              isSyncingGHL={syncMutation.isPending} 
            />
            {!isGHLEnabled && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
                <HardDrive className="h-3 w-3" />
                Local Mode
              </div>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {isLoading ? (
            <>
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </>
          ) : (
            <>
              <ClickableMetricCard 
                title="Opportunities" 
                value={metrics?.totalOpportunities || 0} 
                subtitle={dateRange?.from ? "In selected range" : "All time"} 
                icon={DollarSign} 
                onClick={() => setOpportunitiesSheetOpen(true)} 
              />
              <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Appointments (in date range)</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div 
                        className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-colors" 
                        onClick={() => {
                          setDateRangeAppointmentsFilter("all");
                          setDateRangeAppointmentsSheetOpen(true);
                        }}
                      >
                        <span className="text-xl font-bold text-blue-500">
                          {(metrics?.totalAppointments || 0) - (metrics?.cancelledAppointments || 0)}
                        </span>
                        <span className="text-blue-500/70 text-xs">created</span>
                      </div>
                      <div 
                        className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-500/20 transition-colors" 
                        onClick={() => {
                          setDateRangeAppointmentsFilter("showed");
                          setDateRangeAppointmentsSheetOpen(true);
                        }}
                      >
                        <span className="text-xl font-bold text-emerald-500">
                          {metrics?.appointmentsShowedInDateRange || 0}
                        </span>
                        <span className="text-emerald-500/70 text-xs">showed</span>
                      </div>
                      <div 
                        className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-purple-500/20 transition-colors"
                        onClick={() => setAppointmentsAnalysisOpen(true)}
                      >
                        <span className="text-purple-500 text-xs font-medium">Analysis</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{metrics?.totalAppointments || 0} booked</span>
                      <span className="text-red-500 font-medium">
                        -{metrics?.cancelledAppointments || 0} cancelled
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-3">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/5" />
              </div>
              <ClickableMetricCard 
                title="Appointments (Today's & Future)" 
                value={metrics?.appointmentsToday || 0} 
                secondaryValue={`+ ${metrics?.upcomingAppointments || 0} upcoming`} 
                subtitle="Today & upcoming" 
                icon={Calendar} 
                onClick={() => setUpcomingAppointmentsSheetOpen(true)} 
                warningText={(metrics?.unconfirmedTodayAppointments || 0) > 0 ? `${metrics?.unconfirmedTodayAppointments} not confirmed by rep` : undefined} 
              />
              <ClickableMetricCard 
                title="Won Opportunities" 
                value={metrics?.wonOpportunitiesCount || 0} 
                secondaryValue={formatCurrency(metrics?.wonOpportunitiesValue || 0)} 
                subtitle="Closed deals" 
                icon={Trophy} 
                onClick={() => setWonOpportunitiesSheetOpen(true)} 
              />
              {kpiVisibility.leads_resell_visible && (
                <ClickableMetricCard 
                  title="Leads Resell" 
                  value={metrics?.opportunitySalesCount || 0} 
                  secondaryValue={formatCurrency(metrics?.totalOpportunitySalesAmount || 0)} 
                  subtitle="In date range" 
                  icon={Receipt} 
                  onClick={() => setOpportunitySalesSheetOpen(true)} 
                />
              )}
              {kpiVisibility.magazine_sales_visible && (isAdmin || isMagazine) && (
                <ClickableMetricCard 
                  title="Magazine Sales" 
                  value={formatCurrency(magazineSalesTotal)} 
                  subtitle={`${magazineSales.length} entries`} 
                  icon={BookOpen} 
                  onClick={() => navigate("/magazine-sales")} 
                />
              )}
              <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Activity</p>
                    <div 
                      className="flex items-baseline gap-2 cursor-pointer hover:opacity-80" 
                      onClick={() => {
                        setActivityDefaultTab("edits");
                        setActivitySheetOpen(true);
                      }}
                    >
                      <p className="text-3xl font-bold tracking-tight text-foreground">
                        {(metrics?.opportunityEdits || 0) + (metrics?.inAppAppointmentActivityCount || 0) + (metrics?.inAppTaskActivityCount || 0) + (metrics?.inAppNoteActivityCount || 0)}
                      </p>
                      <span className="text-sm text-muted-foreground">total</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span 
                        className="cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={e => {
                          e.stopPropagation();
                          setActivityDefaultTab("edits");
                          setActivitySheetOpen(true);
                        }}
                      >
                        <span className="font-medium text-blue-500">{metrics?.opportunityEdits || 0}</span>
                        <span className="text-blue-500/70"> edits</span>
                      </span>
                      <span 
                        className="cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={e => {
                          e.stopPropagation();
                          setActivityDefaultTab("appointments");
                          setActivitySheetOpen(true);
                        }}
                      >
                        <span className="font-medium text-amber-500">{metrics?.inAppAppointmentActivityCount || 0}</span>
                        <span className="text-amber-500/70"> appts</span>
                      </span>
                      <span 
                        className="cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={e => {
                          e.stopPropagation();
                          setActivityDefaultTab("tasks");
                          setActivitySheetOpen(true);
                        }}
                      >
                        <span className="font-medium text-emerald-500">{metrics?.inAppTaskActivityCount || 0}</span>
                        <span className="text-emerald-500/70"> tasks</span>
                      </span>
                      <span 
                        className="cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={e => {
                          e.stopPropagation();
                          setActivityDefaultTab("notes");
                          setActivitySheetOpen(true);
                        }}
                      >
                        <span className="font-medium text-purple-500">{metrics?.inAppNoteActivityCount || 0}</span>
                        <span className="text-purple-500/70"> notes</span>
                      </span>
                    </div>
                  </div>
                  <div 
                    className="rounded-xl bg-primary/10 p-3 cursor-pointer hover:bg-primary/20 transition-colors" 
                    onClick={() => {
                      setActivityDefaultTab("edits");
                      setActivitySheetOpen(true);
                    }}
                  >
                    <Pencil className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/5" />
              </div>
            </>
          )}
        </section>

        {/* Visual separator */}
        <div className="border-t border-border/50" />

        {/* Charts Row - All 4 in one line */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[280px] rounded-2xl" />)}
            </>
          ) : (
            <>
              <SourceChart 
                title="Opportunities by Source" 
                data={metrics?.opportunitiesBySource || []} 
                mode="opportunities" 
                dataKey="count" 
                contacts={metrics?.allContacts || []} 
                filteredContacts={metrics?.contacts || []} 
                opportunities={metrics?.allOpportunities || []} 
                filteredOpportunities={metrics?.filteredOpportunitiesList || []} 
                appointments={metrics?.allAppointments || []} 
                filteredAppointments={metrics?.filteredAppointmentsList || []} 
                users={metrics?.users || []} 
                appointmentsBySource={metrics?.appointmentsBySource || []} 
                oppsWithoutAppointmentsBySource={metrics?.oppsWithoutAppointmentsBySource || []} 
                userId={user?.id} 
              />
              <SourceChart 
                title="Won By Source" 
                subtitle="Contracts signed in the date range selected" 
                data={metrics?.wonBySource || []} 
                mode="won" 
                dataKey="value" 
                contacts={metrics?.allContacts || []} 
                filteredContacts={metrics?.contacts || []} 
                opportunities={metrics?.allOpportunities || []} 
                filteredOpportunities={metrics?.wonOpportunities || []} 
                appointments={metrics?.allAppointments || []} 
                users={metrics?.users || []} 
                userId={user?.id} 
              />
              <SalesRepLeaderboard 
                data={metrics?.salesRepPerformance || []} 
                opportunities={metrics?.allOpportunities || []} 
                appointments={metrics?.filteredAppointmentsList || []} 
                contacts={metrics?.allContacts || []} 
                users={metrics?.users || []} 
              />
              <RecentWonDeals 
                wonOpportunities={metrics?.wonOpportunities || []} 
                contacts={metrics?.allContacts || []} 
                appointments={metrics?.allAppointments || []} 
                dateRange={dateRange} 
                onOpportunityClick={handleOpenOpportunity} 
              />
            </>
          )}
        </section>

        {/* Admin Cleanup Dialog */}
        {adminCleanupOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
            <div className="min-h-screen px-4 py-8">
              <div className="max-w-6xl mx-auto bg-card rounded-2xl border border-border shadow-lg p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Data Cleanup</h2>
                    <p className="text-sm text-muted-foreground">Find and fix inconsistent data in your GHL account</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAdminCleanupOpen(false)}>
                    Close
                  </Button>
                </div>
                {isLoading ? (
                  <Skeleton className="h-[400px] rounded-2xl" />
                ) : (
                  <AdminCleanup 
                    opportunities={metrics?.allOpportunities || []} 
                    contacts={metrics?.allContacts || []} 
                    appointments={metrics?.allAppointments || []} 
                    users={metrics?.users || []} 
                    onDataUpdated={() => refetch()} 
                    onOpenOpportunity={handleOpenOpportunity} 
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Source Management Dialog */}
        <SourceManagement 
          contacts={metrics?.allContacts || []} 
          open={sourceManagementOpen} 
          onOpenChange={setSourceManagementOpen} 
        />

        {/* User Management Dialog */}
        <UserManagement open={userManagementOpen} onOpenChange={setUserManagementOpen} />
      </div>

      {/* Won Opportunities Sheet */}
      <WonOpportunitiesSheet 
        open={wonOpportunitiesSheetOpen} 
        onOpenChange={setWonOpportunitiesSheetOpen} 
        opportunities={metrics?.wonOpportunities || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        appointments={metrics?.allAppointments || []} 
        dateRange={dateRange} 
        onOpportunityClick={opp => {
          setSelectedOpportunity({
            ghl_id: opp.ghl_id,
            name: opp.name,
            status: opp.status,
            monetary_value: opp.monetary_value,
            pipeline_id: opp.pipeline_id,
            pipeline_name: opp.pipeline_name,
            pipeline_stage_id: opp.pipeline_stage_id,
            stage_name: opp.stage_name,
            contact_id: opp.contact_id,
            assigned_to: opp.assigned_to,
            ghl_date_added: opp.ghl_date_added,
            ghl_date_updated: opp.ghl_date_updated,
            won_at: opp.won_at
          });
          setWonOpportunitiesSheetOpen(false);
          setOppDetailSheetOpen(true);
        }} 
      />

      {/* Upcoming Appointments Sheet */}
      <UpcomingAppointmentsSheet 
        open={upcomingAppointmentsSheetOpen} 
        onOpenChange={setUpcomingAppointmentsSheetOpen} 
        appointments={metrics?.allAppointments || []} 
        contacts={metrics?.allContacts || []} 
        opportunities={metrics?.allOpportunities || []} 
        users={metrics?.users || []} 
      />

      {/* Opportunities Sheet (for KPI card click) */}
      <OpportunitiesSheet 
        open={opportunitiesSheetOpen} 
        onOpenChange={setOpportunitiesSheetOpen} 
        opportunities={metrics?.filteredOpportunitiesList || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        onOpportunityClick={opp => {
          setSelectedOpportunity({
            ghl_id: opp.ghl_id,
            name: opp.name,
            status: opp.status,
            monetary_value: opp.monetary_value,
            pipeline_id: opp.pipeline_id,
            pipeline_name: opp.pipeline_name,
            pipeline_stage_id: opp.pipeline_stage_id,
            stage_name: opp.stage_name,
            contact_id: opp.contact_id,
            assigned_to: opp.assigned_to,
            ghl_date_added: opp.ghl_date_added,
            ghl_date_updated: opp.ghl_date_updated,
            won_at: opp.won_at
          });
          setOpportunitiesSheetOpen(false);
          setOppDetailSheetOpen(true);
        }} 
      />

      {/* Date Range Appointments Sheet (for KPI card click) */}
      <DateRangeAppointmentsSheet 
        open={dateRangeAppointmentsSheetOpen} 
        onOpenChange={setDateRangeAppointmentsSheetOpen} 
        appointments={dateRangeAppointmentsFilter === "showed" ? metrics?.appointmentsShowedInDateRangeList || [] : metrics?.appointmentsCreatedInRangeList || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        opportunities={metrics?.allOpportunities || []} 
        profiles={metrics?.profiles || []}
        onAppointmentClick={appt => {
          setSelectedAppointment(appt);
          setDateRangeAppointmentsSheetOpen(false);
          setAppointmentDetailSheetOpen(true);
        }} 
        defaultStatusFilter={dateRangeAppointmentsFilter === "showed" ? "showed" : "all"} 
      />

      {/* Call Logs Sheet */}
      <CallLogsSheet 
        open={callLogsSheetOpen} 
        onOpenChange={setCallLogsSheetOpen} 
        callLogs={metrics?.callLogs || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        opportunities={metrics?.allOpportunities || []} 
        appointments={metrics?.allAppointments || []} 
      />

      {/* Activity Sheet */}
      <ActivitySheet 
        open={activitySheetOpen} 
        onOpenChange={setActivitySheetOpen} 
        defaultTab={activityDefaultTab} 
        editedOpportunities={metrics?.editedOpportunities || []} 
        allOpportunities={metrics?.allOpportunities || []} 
        filteredAppointments={metrics?.appointmentsCreatedInRangeList || []} 
        filteredTasks={metrics?.filteredTasks || []} 
        filteredNotes={metrics?.filteredNotes || []} 
        filteredOpportunityEdits={metrics?.filteredOpportunityEdits || []} 
        filteredTaskEdits={metrics?.filteredTaskEdits || []} 
        filteredNoteEdits={metrics?.filteredNoteEdits || []} 
        filteredAppointmentEdits={metrics?.filteredAppointmentEdits || []} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        profiles={metrics?.profiles || []} 
        onOpportunityClick={opp => {
          setSelectedOpportunity({
            ghl_id: opp.ghl_id,
            name: opp.name,
            status: opp.status,
            monetary_value: opp.monetary_value,
            pipeline_id: null,
            pipeline_name: null,
            pipeline_stage_id: null,
            stage_name: opp.stage_name,
            contact_id: opp.contact_id,
            assigned_to: opp.assigned_to,
            ghl_date_added: null,
            ghl_date_updated: opp.ghl_date_updated,
            won_at: opp.won_at
          });
          setInitialTaskGhlId(null);
          setActivitySheetOpen(false);
          setOppDetailSheetOpen(true);
        }} 
        onTaskClick={(opp, task) => {
          setSelectedOpportunity({
            ghl_id: opp.ghl_id,
            name: opp.name,
            status: opp.status,
            monetary_value: opp.monetary_value,
            pipeline_id: null,
            pipeline_name: null,
            pipeline_stage_id: null,
            stage_name: opp.stage_name,
            contact_id: opp.contact_id,
            assigned_to: opp.assigned_to,
            ghl_date_added: null,
            ghl_date_updated: opp.ghl_date_updated,
            won_at: opp.won_at
          });
          setInitialTaskGhlId(task.ghl_id);
          setActivitySheetOpen(false);
          setOppDetailSheetOpen(true);
        }} 
        onAppointmentClick={appt => {
          setSelectedAppointment(appt);
          setActivitySheetOpen(false);
          setAppointmentDetailSheetOpen(true);
        }} 
      />

      {/* Opportunity Detail Sheet (for GHL Tasks tab) */}
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

      {/* Opportunity Sales Sheet */}
      <OpportunitySalesSheet 
        open={opportunitySalesSheetOpen} 
        onOpenChange={setOpportunitySalesSheetOpen} 
        sales={metrics?.filteredOpportunitySales || []} 
        users={metrics?.users || []} 
        opportunities={metrics?.allOpportunities || []} 
        contacts={metrics?.allContacts || []} 
        onOpportunityClick={opp => {
          setSelectedOpportunity({
            ghl_id: opp.ghl_id,
            name: opp.name,
            status: opp.status || null,
            monetary_value: opp.monetary_value || null,
            pipeline_id: opp.pipeline_id || null,
            pipeline_name: opp.pipeline_name || null,
            pipeline_stage_id: opp.pipeline_stage_id || null,
            stage_name: opp.stage_name || null,
            contact_id: opp.contact_id || null,
            assigned_to: opp.assigned_to || null,
            ghl_date_added: opp.ghl_date_added || null,
            ghl_date_updated: opp.ghl_date_updated || null,
            won_at: opp.won_at || null
          });
          setOpportunitySalesSheetOpen(false);
          setOppDetailSheetOpen(true);
        }} 
      />

      {/* Appointment Detail Sheet (for Activity tab) */}
      <AppointmentDetailSheet 
        appointment={selectedAppointment} 
        contacts={metrics?.allContacts || []} 
        users={metrics?.users || []} 
        open={appointmentDetailSheetOpen} 
        onOpenChange={setAppointmentDetailSheetOpen} 
        opportunities={metrics?.allOpportunities || []} 
      />

      {/* Appointments Analysis Dialog */}
      <AppointmentsAnalysisDialog
        open={appointmentsAnalysisOpen}
        onOpenChange={setAppointmentsAnalysisOpen}
        appointments={metrics?.filteredAppointmentsList || []}
        contacts={metrics?.allContacts || []}
        opportunities={metrics?.allOpportunities || []}
        users={metrics?.users || []}
        notes={metrics?.contactNotes || []}
        conversations={metrics?.conversations || []}
      />
    </AppLayout>
  );
};

export default Index;
