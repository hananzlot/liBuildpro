import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CashFlowTimelinePoint } from "@/hooks/useProductionAnalytics";

interface CashFlowTimelineChartProps {
  data: CashFlowTimelinePoint[];
  daysRange?: 30 | 60 | 90;
  onRangeChange?: (range: 30 | 60 | 90) => void;
  className?: string;
}

export function CashFlowTimelineChart({
  data,
  daysRange = 30,
  onRangeChange,
  className,
}: CashFlowTimelineChartProps) {
  const [range, setRange] = useState<30 | 60 | 90>(daysRange);

  const handleRangeChange = (newRange: 30 | 60 | 90) => {
    setRange(newRange);
    onRangeChange?.(newRange);
  };

  const filteredData = useMemo(() => {
    return data.slice(0, range);
  }, [data, range]);

  const minCash = Math.min(...filteredData.map(d => d.cashPosition), 0);
  const maxCash = Math.max(...filteredData.map(d => d.cashPosition), 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload as CashFlowTimelinePoint;
    
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 space-y-2">
        <p className="font-medium text-sm">{new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Cash Position:</span>
            <span className={cn("font-medium", point.cashPosition >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatCurrency(point.cashPosition)}
            </span>
          </div>
          {point.inflows > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Inflows:</span>
              <span className="font-medium text-emerald-600">+{formatCurrency(point.inflows)}</span>
            </div>
          )}
          {point.outflows > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Outflows:</span>
              <span className="font-medium text-red-600">-{formatCurrency(point.outflows)}</span>
            </div>
          )}
          {point.details.length > 0 && (
            <div className="pt-2 border-t mt-2 space-y-1">
              {point.details.slice(0, 3).map((d, i) => (
                <div key={i} className="text-xs flex justify-between gap-2">
                  <span className="truncate max-w-[150px]">
                    #{d.project_number}: {d.description}
                  </span>
                  <span className={d.type === 'inflow' ? 'text-emerald-600' : 'text-red-600'}>
                    {d.type === 'inflow' ? '+' : '-'}{formatCurrency(d.amount)}
                  </span>
                </div>
              ))}
              {point.details.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{point.details.length - 3} more transactions
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cash Flow Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No scheduled payments to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Projected Cash Flow</CardTitle>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleRangeChange(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNegative" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted))' }}
                axisLine={{ stroke: 'hsl(var(--muted))' }}
              />
              <YAxis
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted))' }}
                axisLine={{ stroke: 'hsl(var(--muted))' }}
                domain={[minCash * 1.1, maxCash * 1.1]}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="cashPosition"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#colorPositive)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Inflows (Payments)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Outflows (Scheduled Bills)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
