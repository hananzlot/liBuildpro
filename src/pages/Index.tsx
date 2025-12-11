import { useState } from "react";
import { Users, Calendar, RefreshCw, Database, DollarSign, CalendarCheck, Trophy, Settings, ListChecks, Phone, LogOut } from "lucide-react";
import { useGHLMetrics, useSyncContacts, type DateRange } from "@/hooks/useGHLContacts";
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
import { CallLogsSheet } from "@/components/dashboard/CallLogsSheet";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AdminCleanup } from "@/components/dashboard/AdminCleanup";
import { FollowUpManagement } from "@/components/dashboard/FollowUpManagement";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { NewEntryDialog } from "@/components/dashboard/NewEntryDialog";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
const Index = () => {
  const {
    user,
    profile,
    isAdmin,
    signOut
  } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      from: start,
      to: end
    };
  });
  const [wonOpportunitiesSheetOpen, setWonOpportunitiesSheetOpen] = useState(false);
  const [upcomingAppointmentsSheetOpen, setUpcomingAppointmentsSheetOpen] = useState(false);
  const [callLogsSheetOpen, setCallLogsSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [oppDetailSheetOpen, setOppDetailSheetOpen] = useState(false);
  
  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(dateRange);

  const syncMutation = useSyncContacts();
  const handleOpenOpportunity = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setOppDetailSheetOpen(true);
  };
  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
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
            <p className="text-sm text-muted-foreground">Executive Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!isLoading && <NewEntryDialog users={metrics?.users || []} onSuccess={refetch} userId={user?.id} />}
            {!isLoading && <OpportunitySearch opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} conversations={metrics?.conversations || []} />}
            
            <Button size="sm" onClick={handleSync} disabled={syncMutation.isPending}>
              <Database className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-pulse" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync GHL"}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <NotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {profile?.full_name || user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-8 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="follow-up" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Follow-up
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8">
            {/* Date Range Filter */}
            <section className="flex items-center justify-between flex-wrap gap-4">
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              {dateRange?.from && <p className="text-sm text-muted-foreground">
                  Showing {metrics?.totalLeads || 0} leads in selected range
                </p>}
            </section>

            {/* Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {isLoading ? <>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
                </> : <>
                  <MetricCard title="Opportunities" value={metrics?.totalOpportunities || 0} subtitle={dateRange?.from ? "In selected range" : "All time"} icon={DollarSign} />
                  <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Appointments</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold tracking-tight text-foreground">
                            {(metrics?.totalAppointments || 0) - (metrics?.cancelledAppointments || 0)}
                          </p>
                          <span className="text-sm text-muted-foreground">net</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{metrics?.totalAppointments || 0} scheduled</span>
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
                  <ClickableMetricCard title="Appointments" value={metrics?.appointmentsToday || 0} secondaryValue={`+ ${metrics?.upcomingAppointments || 0} upcoming`} subtitle="Today & upcoming" icon={Calendar} onClick={() => setUpcomingAppointmentsSheetOpen(true)} />
                  <ClickableMetricCard title="Won Opportunities" value={metrics?.wonOpportunitiesCount || 0} secondaryValue={formatCurrency(metrics?.wonOpportunitiesValue || 0)} subtitle="Closed deals" icon={Trophy} onClick={() => setWonOpportunitiesSheetOpen(true)} />
                  <div className="relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setCallLogsSheetOpen(true)}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Calls</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold tracking-tight text-foreground">
                            {metrics?.uniqueContactsCalled || 0}
                          </p>
                          <span className="text-sm text-muted-foreground">contacts</span>
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="text-muted-foreground">{metrics?.totalCalls || 0} total</span>
                          <div className="flex items-center gap-3">
                            <span className="text-green-600 font-medium">{metrics?.outboundCalls || 0}↑</span>
                            <span className="text-blue-500 font-medium">{metrics?.inboundCalls || 0}↓</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-3">
                        <Phone className="h-5 w-5 text-primary" />
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
                  <SourceChart title="Opportunities by Source" data={metrics?.opportunitiesBySource || []} mode="opportunities" dataKey="count" contacts={metrics?.allContacts || []} filteredContacts={metrics?.contacts || []} opportunities={metrics?.allOpportunities || []} filteredOpportunities={metrics?.filteredOpportunitiesList || []} appointments={metrics?.allAppointments || []} filteredAppointments={metrics?.filteredAppointmentsList || []} users={metrics?.users || []} appointmentsBySource={metrics?.appointmentsBySource || []} oppsWithoutAppointmentsBySource={metrics?.oppsWithoutAppointmentsBySource || []} />
                  <SourceChart title="Won by Source" data={metrics?.wonBySource || []} mode="won" dataKey="value" contacts={metrics?.allContacts || []} filteredContacts={metrics?.contacts || []} opportunities={metrics?.allOpportunities || []} filteredOpportunities={metrics?.wonOpportunities || []} appointments={metrics?.allAppointments || []} users={metrics?.users || []} />
                  <SalesRepLeaderboard data={metrics?.salesRepPerformance || []} opportunities={metrics?.allOpportunities || []} appointments={metrics?.filteredAppointmentsList || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} />
                  <RecentWonDeals wonOpportunities={metrics?.wonOpportunities || []} contacts={metrics?.allContacts || []} dateRange={dateRange} // 👈 add this
              onOpportunityClick={handleOpenOpportunity} />
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
                    <OpportunitiesTable opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} conversations={metrics?.conversations || []} />
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

          <TabsContent value="admin" className="space-y-6">
            {!isAdmin ? <Card className="max-w-md mx-auto mt-12">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Settings className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle>Admin Access Required</CardTitle>
                  <CardDescription>
                    You need admin privileges to access data cleanup tools. Contact your administrator if you need
                    access.
                  </CardDescription>
                </CardHeader>
              </Card> : <>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Data Cleanup</h2>
                  <p className="text-sm text-muted-foreground">Find and fix inconsistent data in your GHL account</p>
                </div>
                {isLoading ? <Skeleton className="h-[400px] rounded-2xl" /> : <AdminCleanup opportunities={metrics?.allOpportunities || []} contacts={metrics?.allContacts || []} appointments={metrics?.allAppointments || []} users={metrics?.users || []} onDataUpdated={() => refetch()} onOpenOpportunity={handleOpenOpportunity} />}
              </>}
          </TabsContent>
        </Tabs>
      </main>

      {/* Won Opportunities Sheet */}
      <WonOpportunitiesSheet open={wonOpportunitiesSheetOpen} onOpenChange={setWonOpportunitiesSheetOpen} opportunities={metrics?.wonOpportunities || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} dateRange={dateRange} // 👈 add this
    />

      {/* Upcoming Appointments Sheet */}
      <UpcomingAppointmentsSheet open={upcomingAppointmentsSheetOpen} onOpenChange={setUpcomingAppointmentsSheetOpen} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} opportunities={metrics?.allOpportunities || []} users={metrics?.users || []} />

      {/* Call Logs Sheet */}
      <CallLogsSheet open={callLogsSheetOpen} onOpenChange={setCallLogsSheetOpen} callLogs={metrics?.callLogs || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} opportunities={metrics?.allOpportunities || []} appointments={metrics?.allAppointments || []} />

      {/* Opportunity Detail Sheet (for GHL Tasks tab) */}
      <OpportunityDetailSheet opportunity={selectedOpportunity} appointments={metrics?.allAppointments || []} contacts={metrics?.allContacts || []} users={metrics?.users || []} open={oppDetailSheetOpen} onOpenChange={setOppDetailSheetOpen} allOpportunities={metrics?.allOpportunities || []} />
    </div>;
};
export default Index;