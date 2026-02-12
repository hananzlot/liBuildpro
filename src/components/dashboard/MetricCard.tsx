import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  secondaryValue?: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricCard({ title, value, secondaryValue, subtitle, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-card p-4 border border-border/50",
      "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {secondaryValue && (
              <span className="text-sm text-muted-foreground">/ {secondaryValue}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              trend.isPositive ? "text-emerald-500" : "text-red-500"
            )}>
              <span>{trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );
}
