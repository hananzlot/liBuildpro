import { Users, TrendingUp, Calendar, Activity, RefreshCw, Database } from "lucide-react";
import { useGHLMetrics, useSyncContacts } from "@/hooks/useGHLContacts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LeadsBySourceChart } from "@/components/dashboard/LeadsBySourceChart";
import { SalesRepLeaderboard } from "@/components/dashboard/SalesRepLeaderboard";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
  const { data: metrics, isLoading, error, refetch } = useGHLMetrics();
  const syncMutation = useSyncContacts();

  const handleSync = async () => {
    toast.info("Syncing contacts from GHL...");
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Synced ${result.total} contacts from GHL`);
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">GHL Analytics</h1>
            <p className="text-sm text-muted-foreground">CA Pro Builders Dashboard</p>
          </div>
          <div className="flex gap-2">
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

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Metrics Grid */}
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
                subtitle="Cached in database"
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

        {/* Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            <>
              <Skeleton className="h-[380px] rounded-2xl" />
              <Skeleton className="h-[380px] rounded-2xl" />
            </>
          ) : (
            <>
              <LeadsBySourceChart data={metrics?.leadsBySource || []} />
              <SalesRepLeaderboard data={metrics?.salesRepPerformance || []} />
            </>
          )}
        </section>

        {/* Recent Leads Table */}
        <section>
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <RecentLeadsTable leads={metrics?.recentLeads || []} />
          )}
        </section>
      </main>
    </div>
  );
};

export default Index;
