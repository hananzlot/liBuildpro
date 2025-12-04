import { useState } from "react";
import { Users, TrendingUp, Calendar, Activity, RefreshCw, Database, DollarSign, CalendarCheck, Trophy, Settings, CloudDownload, Lock } from "lucide-react";
import { useGHLMetrics, useSyncContacts, type DateRange } from "@/hooks/useGHLContacts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ClickableMetricCard } from "@/components/dashboard/ClickableMetricCard";
import { SourceChart } from "@/components/dashboard/SourceChart";
import { SalesRepLeaderboard } from "@/components/dashboard/SalesRepLeaderboard";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { OpportunitiesTable } from "@/components/dashboard/OpportunitiesTable";
import { AppointmentsTable } from "@/components/dashboard/AppointmentsTable";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { WonOpportunitiesSheet } from "@/components/dashboard/WonOpportunitiesSheet";
import { UpcomingAppointmentsSheet } from "@/components/dashboard/UpcomingAppointmentsSheet";
import { OpportunitySearch } from "@/components/dashboard/OpportunitySearch";
import { AdminCleanup } from "@/components/dashboard/AdminCleanup";

import { GHLTasksTab } from "@/components/dashboard/GHLTasksTab";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const ADMIN_PASSWORD = "CAPro2025";

const Index = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [wonOpportunitiesSheetOpen, setWonOpportunitiesSheetOpen] = useState(false);
  const [upcomingAppointmentsSheetOpen, setUpcomingAppointmentsSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [oppDetailSheetOpen, setOppDetailSheetOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const { data: metrics, isLoading, error, refetch } = useGHLMetrics(dateRange);
  const syncMutation = useSyncContacts();

  const handleOpenOpportunity = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setOppDetailSheetOpen(true);
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminAuthenticated(true);
      setAdminPassword("");
      toast.success("Admin access granted");
    } else {
      toast.error("Incorrect password");
    }
  };

  const handleSync = async () => {
    toast.info("Syncing all data from GHL...");
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Sync complete! ${result.total} contacts synced`);
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">GHL Analytics</h1>
            <p className="text-sm text-muted-foreground">CA Pro Builders Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!isLoading && (
              <OpportunitySearch
                opportunities={metrics?.allOpportunities || []}
                appointments={metrics?.allAppointments || []}
                contacts={metrics?.allContacts || []}
                users={metrics?.users || []}
                conversations={metrics?.conversations || []}
              />
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              size="sm" 
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <Database className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-pulse' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync GHL'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="ghl-tasks" className="gap-2">
              <CloudDownload className="h-4 w-4" />
              GHL Tasks
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8">
            {/* Date Range Filter */}
            <section className="flex items-center justify-between flex-wrap gap-4">
              <DateRangeFilter 
                dateRange={dateRange} 
                onDateRangeChange={setDateRange} 
              />
              {dateRange?.from && (
                <p className="text-sm text-muted-foreground">
                  Showing {metrics?.totalLeads || 0} leads in selected range
                </p>
              )}
            </section>

            {/* Metrics Grid - Row 1: Leads */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-2xl" />
                  ))}
                </>
              ) : (
                <>
                  <MetricCard
                    title="Total Leads"
                    value={metrics?.totalLeads || 0}
                    subtitle={dateRange?.from ? "In selected range" : "All time"}
                    icon={Users}
                  />
                  <MetricCard
                    title="This Month"
                    value={metrics?.leadsThisMonth || 0}
                    subtitle="New leads"
                    icon={Calendar}
                    trend={{ value: 12, isPositive: true }}
                  />
                  <MetricCard
                    title="Lead Sources"
                    value={metrics?.leadsBySource?.length || 0}
                    subtitle="Active channels"
                    icon={TrendingUp}
                  />
                  <MetricCard
                    title="Active Reps"
                    value={metrics?.salesRepPerformance?.length || 0}
                    subtitle="Assigned team members"
                    icon={Activity}
                  />
                </>
              )}
            </section>

            {/* Metrics Grid - Row 2: Opportunities & Appointments */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-2xl" />
                  ))}
                </>
              ) : (
                <>
                  <MetricCard
                    title="Opportunities"
                    value={metrics?.totalOpportunities || 0}
                    subtitle={dateRange?.from ? "In selected range" : "All time"}
                    icon={DollarSign}
                  />
                  <ClickableMetricCard
                    title="Won Opportunities"
                    value={metrics?.wonOpportunitiesCount || 0}
                    secondaryValue={formatCurrency(metrics?.wonOpportunitiesValue || 0)}
                    subtitle="Closed deals"
                    icon={Trophy}
                    onClick={() => setWonOpportunitiesSheetOpen(true)}
                  />
                  <MetricCard
                    title="Appointments"
                    value={metrics?.totalAppointments || 0}
                    subtitle="Total scheduled"
                    icon={CalendarCheck}
                  />
                  <ClickableMetricCard
                    title="Upcoming"
                    value={metrics?.upcomingNextWeek || 0}
                    secondaryValue={`/ ${metrics?.upcomingAppointments || 0} total`}
                    subtitle="Next 7 days"
                    icon={Calendar}
                    onClick={() => setUpcomingAppointmentsSheetOpen(true)}
                  />
                </>
              )}
            </section>

            {/* Charts Row - Source Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-[380px] rounded-2xl" />
                  <Skeleton className="h-[380px] rounded-2xl" />
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
                  />
                  <SourceChart
                    title="Won by Source"
                    data={metrics?.wonBySource || []}
                    mode="won"
                    dataKey="value"
                    contacts={metrics?.allContacts || []}
                    filteredContacts={metrics?.contacts || []}
                    opportunities={metrics?.allOpportunities || []}
                    filteredOpportunities={metrics?.wonOpportunities || []}
                    appointments={metrics?.allAppointments || []}
                    users={metrics?.users || []}
                  />
                </>
              )}
            </section>

            {/* Sales Rep Leaderboard */}
            <section>
              {isLoading ? (
                <Skeleton className="h-[380px] rounded-2xl" />
              ) : (
                <SalesRepLeaderboard 
                  data={metrics?.salesRepPerformance || []}
                  opportunities={metrics?.allOpportunities || []}
                  appointments={metrics?.allAppointments || []}
                  contacts={metrics?.allContacts || []}
                  users={metrics?.users || []}
                />
              )}
            </section>

            {/* Tables Row - Opportunities & Appointments */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-[400px] rounded-2xl" />
                  <Skeleton className="h-[400px] rounded-2xl" />
                </>
              ) : (
                <>
                  <OpportunitiesTable 
                    opportunities={metrics?.opportunities || []} 
                    appointments={metrics?.allAppointments || []}
                    contacts={metrics?.allContacts || []}
                    users={metrics?.users || []}
                    conversations={metrics?.conversations || []}
                  />
                  <AppointmentsTable 
                    appointments={metrics?.appointments || []} 
                    opportunities={metrics?.allOpportunities || []}
                    contacts={metrics?.allContacts || []}
                    users={metrics?.users || []}
                  />
                </>
              )}
            </section>

            {/* Recent Leads Table */}
            <section>
              {isLoading ? (
                <Skeleton className="h-[400px] rounded-2xl" />
              ) : (
                <RecentLeadsTable 
                  leads={metrics?.contacts || []} 
                  opportunities={metrics?.allOpportunities || []}
                  appointments={metrics?.allAppointments || []}
                  users={metrics?.users || []}
                  conversations={metrics?.conversations || []}
                />
              )}
            </section>
          </TabsContent>


          <TabsContent value="ghl-tasks" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">GHL Tasks (Live)</h2>
              <p className="text-sm text-muted-foreground">Uncompleted tasks fetched directly from GoHighLevel</p>
            </div>
            <GHLTasksTab 
              opportunities={metrics?.allOpportunities || []}
              contacts={metrics?.allContacts || []}
              users={metrics?.users || []}
              onOpenOpportunity={handleOpenOpportunity}
            />
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            {!adminAuthenticated ? (
              <Card className="max-w-md mx-auto mt-12">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle>Admin Access Required</CardTitle>
                  <CardDescription>Enter the admin password to access data cleanup tools</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Enter password..."
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                  <Button className="w-full" onClick={handleAdminLogin}>
                    Unlock Admin
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Data Cleanup</h2>
                  <p className="text-sm text-muted-foreground">Find and fix inconsistent data in your GHL account</p>
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Won Opportunities Sheet */}
      <WonOpportunitiesSheet
        open={wonOpportunitiesSheetOpen}
        onOpenChange={setWonOpportunitiesSheetOpen}
        opportunities={metrics?.wonOpportunities || []}
        contacts={metrics?.allContacts || []}
        users={metrics?.users || []}
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

      {/* Opportunity Detail Sheet (for GHL Tasks tab) */}
      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={metrics?.allAppointments || []}
        contacts={metrics?.allContacts || []}
        users={metrics?.users || []}
        open={oppDetailSheetOpen}
        onOpenChange={setOppDetailSheetOpen}
        allOpportunities={metrics?.allOpportunities || []}
      />
    </div>
  );
};

export default Index;
