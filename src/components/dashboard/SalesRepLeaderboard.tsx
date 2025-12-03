import type { SalesRepPerformance } from "@/types/ghl";

interface SalesRepLeaderboardProps {
  data: SalesRepPerformance[];
}

export function SalesRepLeaderboard({ data }: SalesRepLeaderboardProps) {
  return (
    <div className="rounded-2xl bg-card p-6 border border-border/50">
      <h3 className="text-lg font-semibold text-foreground mb-6">Sales Rep Performance</h3>
      <div className="space-y-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No assigned reps found
          </p>
        ) : (
          data.slice(0, 5).map((rep, index) => (
            <div key={rep.assignedTo} className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {rep.assignedTo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rep.totalLeads} leads
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">
                  {rep.conversionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">conversion</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
