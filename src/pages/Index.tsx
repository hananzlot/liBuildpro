import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Calendar, Database, DollarSign, CalendarCheck, Trophy, Settings, ListChecks, Pencil, LogOut, Wrench, Key, User, ChevronDown, BookOpen, Receipt, ExternalLink, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGHLMetrics, useSyncContacts, useSyncGHL2, type DateRange } from "@/hooks/useGHLContacts";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ClickableMetricCard } from "@/components/dashboard/ClickableMetricCard";
import { SourceChart } from "@/components/dashboard/SourceChart";
import { SalesRepLeaderboard } from "@/components/dashboard/SalesRepLeaderboard";
import { RecentWonDeals } from "@/components/dashboard/RecentWonDeals";
import { OpportunitiesTable } from "@/components/dashboard/OpportunitiesTable";
import { AppointmentsTable } from "@/components/dashboard/AppointmentsTable";
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
import { FollowUpManagement } from "@/components/dashboard/FollowUpManagement";
import { MagazineSalesTab } from "@/components/dashboard/MagazineSalesTab";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";
import { NewEntryDialog } from "@/components/dashboard/NewEntryDialog";
import { SyncDropdown } from "@/components/dashboard/SyncDropdown";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { OpportunitySalesSheet } from "@/components/dashboard/OpportunitySalesSheet";
import { AppointmentsAnalysisDialog } from "@/components/dashboard/AppointmentsAnalysisDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
const Index = () => {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isAdmin,
    isMagazineEditor,
    isProduction,
    signOut,
    updatePassword
  } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return {
      from: start,
      to: end
    };
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
  const [activeTab, setActiveTab] = useState("dashboard");

  // Redirect production-only users to the production page
  useEffect(() => {
    if (isProduction && !isAdmin) {
      navigate("/production");
    }
  }, [isProduction, isAdmin, navigate]);

  // Change password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(dateRange);

  // Fetch magazine sales for dashboard KPI (only if user has access)
  const {
    data: magazineSales = []
  } = useQuery({
    queryKey: ["magazine-sales-dashboard"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("magazine_sales").select("price, page_size, sections_sold");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isMagazineEditor
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
  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };
  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const {
        error
      } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setChangePasswordOpen(false);
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };
  const handleSync = async () => {
    toast.info("Syncing all data from GHL...");
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Sync complete! ${result.total} contacts synced`);
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
  if (error) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CA Pro Builders (GHL)</h1>
            <p className="text-sm text-muted-foreground">Executive Dashboard v2.5</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!isLoading && <OpportunitySearch opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} conversations={metrics?.conversations || []} />}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <NotificationBell />
              {isAdmin && <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" title="Admin tools">
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setAdminCleanupOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Data Cleanup
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSourceManagementOpen(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Manage Sources
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setUserManagementOpen(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      User Management
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{profile?.full_name || user?.email}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
              {/* Production-only users should only see Production tab */}
              {(!isProduction || isAdmin) && (
                <>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger 
                    value="palisades" 
                    className="gap-2"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open("https://palisades.ca-probuilders.com", "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Palisades
                  </TabsTrigger>
                  <TabsTrigger value="follow-up" className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    Follow-up
                  </TabsTrigger>
                </>
              )}
              {(isAdmin || isMagazineEditor) && <TabsTrigger value="magazine-sales" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Magazine Sales
                </TabsTrigger>}
              {(isAdmin || isProduction) && <TabsTrigger 
                value="production" 
                className="gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/production");
                }}
              >
                <Briefcase className="h-4 w-4" />
                Production
              </TabsTrigger>}
            </TabsList>
            <div className="flex items-center gap-2">
              {!isLoading && activeTab !== "magazine-sales" && <NewEntryDialog users={metrics?.users || []} onSuccess={refetch} userId={user?.id} />}
              {activeTab !== "magazine-sales" && <SyncDropdown onSyncGHL={handleSync} onSyncGHL2={handleSyncGHL2} isSyncingGHL={syncMutation.isPending} isSyncingGHL2={syncGHL2Mutation.isPending} />}
            </div>
          </div>

          <TabsContent value="dashboard" className="space-y-8">
            {/* Date Range Filter */}
            <section className="flex items-center justify-between flex-wrap gap-4">
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              {dateRange?.from && <p className="text-sm text-muted-foreground">
                  Showing {metrics?.totalLeads || 0} leads in selected range
                </p>}
            </section>

            {/* Metrics Grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {isLoading ? <>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
                </> : <>
                  <ClickableMetricCard title="Opportunities" value={metrics?.totalOpportunities || 0} subtitle={dateRange?.from ? "In selected range" : "All time"} icon={DollarSign} onClick={() => setOpportunitiesSheetOpen(true)} />
                  <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Appointments (in date range)</p>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-colors" onClick={() => {
                        setDateRangeAppointmentsFilter("all");
                        setDateRangeAppointmentsSheetOpen(true);
                      }}>
                            <span className="text-xl font-bold text-blue-500">
                              {(metrics?.totalAppointments || 0) - (metrics?.cancelledAppointments || 0)}
                            </span>
                            <span className="text-blue-500/70 text-xs">created</span>
                          </div>
                          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-500/20 transition-colors" onClick={() => {
                        setDateRangeAppointmentsFilter("showed");
                        setDateRangeAppointmentsSheetOpen(true);
                      }}>
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
                  <ClickableMetricCard title="Appointments (Today's & Future)" value={metrics?.appointmentsToday || 0} secondaryValue={`+ ${metrics?.upcomingAppointments || 0} upcoming`} subtitle="Today & upcoming" icon={Calendar} onClick={() => setUpcomingAppointmentsSheetOpen(true)} warningText={(metrics?.unconfirmedTodayAppointments || 0) > 0 ? `${metrics?.unconfirmedTodayAppointments} not confirmed by rep` : undefined} />
                  <ClickableMetricCard title="Won Opportunities" value={metrics?.wonOpportunitiesCount || 0} secondaryValue={formatCurrency(metrics?.wonOpportunitiesValue || 0)} subtitle="Closed deals" icon={Trophy} onClick={() => setWonOpportunitiesSheetOpen(true)} />
                  <ClickableMetricCard title="Leads Resell" value={metrics?.opportunitySalesCount || 0} secondaryValue={formatCurrency(metrics?.totalOpportunitySalesAmount || 0)} subtitle="In date range" icon={Receipt} onClick={() => setOpportunitySalesSheetOpen(true)} />
                  {(isAdmin || isMagazineEditor) && <ClickableMetricCard title="Magazine Sales" value={formatCurrency(magazineSalesTotal)} subtitle={`${magazineSales.length} entries`} icon={BookOpen} onClick={() => setActiveTab("magazine-sales")} />}
                  <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Activity</p>
                        <div className="flex items-baseline gap-2 cursor-pointer hover:opacity-80" onClick={() => {
                      setActivityDefaultTab("edits");
                      setActivitySheetOpen(true);
                    }}>
                          <p className="text-3xl font-bold tracking-tight text-foreground">
                            {(metrics?.opportunityEdits || 0) + (metrics?.inAppAppointmentActivityCount || 0) + (metrics?.inAppTaskActivityCount || 0) + (metrics?.inAppNoteActivityCount || 0)}
                          </p>
                          <span className="text-sm text-muted-foreground">total</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          <span className="cursor-pointer hover:opacity-80 transition-opacity" onClick={e => {
                        e.stopPropagation();
                        setActivityDefaultTab("edits");
                        setActivitySheetOpen(true);
                      }}>
                            <span className="font-medium text-blue-500">{metrics?.opportunityEdits || 0}</span>
                            <span className="text-blue-500/70"> edits</span>
                          </span>
                          <span className="cursor-pointer hover:opacity-80 transition-opacity" onClick={e => {
                        e.stopPropagation();
                        setActivityDefaultTab("appointments");
                        setActivitySheetOpen(true);
                      }}>
                            <span className="font-medium text-amber-500">{metrics?.inAppAppointmentActivityCount || 0}</span>
                            <span className="text-amber-500/70"> appts</span>
                          </span>
                          <span className="cursor-pointer hover:opacity-80 transition-opacity" onClick={e => {
                        e.stopPropagation();
                        setActivityDefaultTab("tasks");
                        setActivitySheetOpen(true);
                      }}>
                            <span className="font-medium text-emerald-500">{metrics?.inAppTaskActivityCount || 0}</span>
                            <span className="text-emerald-500/70"> tasks</span>
                          </span>
                          <span className="cursor-pointer hover:opacity-80 transition-opacity" onClick={e => {
                        e.stopPropagation();
                        setActivityDefaultTab("notes");
                        setActivitySheetOpen(true);
                      }}>
                            <span className="font-medium text-purple-500">{metrics?.inAppNoteActivityCount || 0}</span>
                            <span className="text-purple-500/70"> notes</span>
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-3 cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => {
                    setActivityDefaultTab("edits");
                    setActivitySheetOpen(true);
                  }}>
                        <Pencil className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/5" />
                  </div>
                </>}
            </section>

            {/* Visual separator */}
            <div className="border-t border-border/50" />

            {/* Charts Row - All 4 in one line */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {isLoading ? <>
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[280px] rounded-2xl" />)}
                </> : <>
                  <SourceChart title="Opportunities by Source" data={metrics?.opportunitiesBySource || []} mode="opportunities" dataKey="count" contacts={metrics?.allContacts || []} filteredContacts={metrics?.contacts || []} opportunities={metrics?.allOpportunities || []} filteredOpportunities={metrics?.filteredOpportunitiesList || []} appointments={metrics?.allAppointments || []} filteredAppointments={metrics?.filteredAppointmentsList || []} users={metrics?.users || []} appointmentsBySource={metrics?.appointmentsBySource || []} oppsWithoutAppointmentsBySource={metrics?.oppsWithoutAppointmentsBySource || []} userId={user?.id} />
                  <SourceChart title="Won By Source" subtitle="Contracts signed in the date range selected" data={metrics?.wonBySource || []} mode="won" dataKey="value" contacts={metrics?.allContacts || []} filteredContacts={metrics?.contacts || []} opportunities={metrics?.allOpportunities || []} filteredOpportunities={metrics?.wonOpportunities || []} appointments={metrics?.allAppointments || []} users={metrics?.users || []} userId={user?.id} />
                  <SalesRepLeaderboard data={metrics?.salesRepPerformance || []} opportunities={metrics?.allOpportunities || []} appointments={metrics?.filteredAppointmentsList || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} />
                  <RecentWonDeals wonOpportunities={metrics?.wonOpportunities || []} contacts={metrics?.allContacts || []} appointments={metrics?.allAppointments || []} dateRange={dateRange} onOpportunityClick={handleOpenOpportunity} />
                </>}
            </section>

            {/* Tables - Tabbed */}
            <section>
              {isLoading ? <Skeleton className="h-[400px] rounded-2xl" /> : <Tabs defaultValue="opportunities" className="w-full">
                  <TabsList>
                    <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                  </TabsList>
                  <TabsContent value="opportunities" className="mt-4">
                    <OpportunitiesTable opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} conversations={metrics?.conversations || []} notes={metrics?.contactNotes || []} tasks={metrics?.tasks || []} />
                  </TabsContent>
                  <TabsContent value="appointments" className="mt-4">
                    <AppointmentsTable appointments={metrics?.allAppointments || []} opportunities={metrics?.allOpportunities || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} />
                  </TabsContent>
                </Tabs>}
            </section>
          </TabsContent>

          <TabsContent value="follow-up" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Follow-up Management</h2>
              <p className="text-sm text-muted-foreground">Track appointments and opportunities that need attention</p>
            </div>
            {isLoading ? <Skeleton className="h-[400px] rounded-2xl" /> : <FollowUpManagement opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} contactNotes={metrics?.contactNotes || []} tasks={metrics?.tasks || []} onOpenOpportunity={handleOpenOpportunity} onDataRefresh={refetch} />}
          </TabsContent>

          {(isAdmin || isMagazineEditor) && <TabsContent value="magazine-sales" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">Magazine Sales</h2>
                <p className="text-sm text-muted-foreground">Track magazine ad sales and revenue</p>
              </div>
              <MagazineSalesTab />
            </TabsContent>}

        </Tabs>

        {/* Admin Cleanup Dialog */}
        {adminCleanupOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
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
                {isLoading ? <Skeleton className="h-[400px] rounded-2xl" /> : <AdminCleanup opportunities={metrics?.allOpportunities || []} contacts={metrics?.allContacts || []} appointments={metrics?.allAppointments || []} users={metrics?.users || []} onDataUpdated={() => refetch()} onOpenOpportunity={handleOpenOpportunity} />}
              </div>
            </div>
          </div>}

        {/* Source Management Dialog */}
        <SourceManagement contacts={metrics?.allContacts || []} open={sourceManagementOpen} onOpenChange={setSourceManagementOpen} />

        {/* User Management Dialog */}
        <UserManagement open={userManagementOpen} onOpenChange={setUserManagementOpen} />
      </main>

      {/* Won Opportunities Sheet */}
      <WonOpportunitiesSheet open={wonOpportunitiesSheetOpen} onOpenChange={setWonOpportunitiesSheetOpen} opportunities={metrics?.wonOpportunities || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} appointments={metrics?.allAppointments || []} dateRange={dateRange} onOpportunityClick={opp => {
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
        ghl_date_updated: opp.ghl_date_updated
      });
      setWonOpportunitiesSheetOpen(false);
      setOppDetailSheetOpen(true);
    }} />

      {/* Upcoming Appointments Sheet */}
      <UpcomingAppointmentsSheet open={upcomingAppointmentsSheetOpen} onOpenChange={setUpcomingAppointmentsSheetOpen} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} opportunities={metrics?.allOpportunities || []} users={metrics?.users || []} />

      {/* Opportunities Sheet (for KPI card click) */}
      <OpportunitiesSheet open={opportunitiesSheetOpen} onOpenChange={setOpportunitiesSheetOpen} opportunities={metrics?.filteredOpportunitiesList || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} onOpportunityClick={opp => {
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
        ghl_date_updated: opp.ghl_date_updated
      });
      setOpportunitiesSheetOpen(false);
      setOppDetailSheetOpen(true);
    }} />

      {/* Date Range Appointments Sheet (for KPI card click) */}
      <DateRangeAppointmentsSheet open={dateRangeAppointmentsSheetOpen} onOpenChange={setDateRangeAppointmentsSheetOpen} appointments={dateRangeAppointmentsFilter === "showed" ? metrics?.appointmentsShowedInDateRangeList || [] : metrics?.appointmentsCreatedInRangeList || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} opportunities={metrics?.allOpportunities || []} onAppointmentClick={appt => {
      setSelectedAppointment(appt);
      setDateRangeAppointmentsSheetOpen(false);
      setAppointmentDetailSheetOpen(true);
    }} defaultStatusFilter={dateRangeAppointmentsFilter === "showed" ? "showed" : "all"} />

      {/* Call Logs Sheet */}
      <CallLogsSheet open={callLogsSheetOpen} onOpenChange={setCallLogsSheetOpen} callLogs={metrics?.callLogs || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} />

      {/* Activity Sheet */}
      <ActivitySheet open={activitySheetOpen} onOpenChange={setActivitySheetOpen} defaultTab={activityDefaultTab} editedOpportunities={metrics?.editedOpportunities || []} allOpportunities={metrics?.allOpportunities || []} filteredAppointments={metrics?.appointmentsCreatedInRangeList || []} filteredTasks={metrics?.filteredTasks || []} filteredNotes={metrics?.filteredNotes || []} filteredOpportunityEdits={metrics?.filteredOpportunityEdits || []} filteredTaskEdits={metrics?.filteredTaskEdits || []} filteredNoteEdits={metrics?.filteredNoteEdits || []} filteredAppointmentEdits={metrics?.filteredAppointmentEdits || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} profiles={metrics?.profiles || []} onOpportunityClick={opp => {
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
        ghl_date_updated: opp.ghl_date_updated
      });
      setInitialTaskGhlId(null);
      setActivitySheetOpen(false);
      setOppDetailSheetOpen(true);
    }} onTaskClick={(opp, task) => {
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
        ghl_date_updated: opp.ghl_date_updated
      });
      setInitialTaskGhlId(task.ghl_id);
      setActivitySheetOpen(false);
      setOppDetailSheetOpen(true);
    }} onAppointmentClick={appt => {
      setSelectedAppointment(appt);
      setActivitySheetOpen(false);
      setAppointmentDetailSheetOpen(true);
    }} />

      {/* Opportunity Detail Sheet (for GHL Tasks tab) */}
      <OpportunityDetailSheet opportunity={selectedOpportunity} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} open={oppDetailSheetOpen} onOpenChange={open => {
      setOppDetailSheetOpen(open);
      if (!open) setInitialTaskGhlId(null);
    }} allOpportunities={metrics?.allOpportunities || []} initialTaskGhlId={initialTaskGhlId} />

      {/* Opportunity Sales Sheet */}
      <OpportunitySalesSheet open={opportunitySalesSheetOpen} onOpenChange={setOpportunitySalesSheetOpen} sales={metrics?.filteredOpportunitySales || []} users={metrics?.users || []} opportunities={metrics?.allOpportunities || []} contacts={metrics?.allContacts || []} onOpportunityClick={opp => {
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
        ghl_date_updated: opp.ghl_date_updated || null
      });
      setOpportunitySalesSheetOpen(false);
      setOppDetailSheetOpen(true);
    }} />

      {/* Appointment Detail Sheet (for Activity tab) */}
      <AppointmentDetailSheet appointment={selectedAppointment} contacts={metrics?.allContacts || []} users={metrics?.users || []} open={appointmentDetailSheetOpen} onOpenChange={setAppointmentDetailSheetOpen} opportunities={metrics?.allOpportunities || []} />

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointments Analysis Dialog */}
      <AppointmentsAnalysisDialog
        open={appointmentsAnalysisOpen}
        onOpenChange={setAppointmentsAnalysisOpen}
        appointments={metrics?.filteredAppointmentsList || []}
        contacts={metrics?.allContacts || []}
        opportunities={metrics?.allOpportunities || []}
        users={metrics?.users || []}
      />
    </div>;
};
export default Index;