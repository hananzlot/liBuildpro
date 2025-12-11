import { cn } from "@/lib/utils";
import { LucideIcon, AlertTriangle } from "lucide-react";

interface ClickableMetricCardProps {
  title: string;
  value: string | number;
  secondaryValue?: string;
  subtitle?: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  warningText?: string;
}

export function ClickableMetricCard({ 
  title, 
  value, 
  secondaryValue, 
  subtitle, 
  icon: Icon, 
  onClick,
  className,
  warningText 
}: ClickableMetricCardProps) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card p-6 border border-border/50",
        "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {secondaryValue && (
              <p className="text-lg font-semibold text-primary">{secondaryValue}</p>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {warningText && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{warningText}</span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/5" />
    </div>
  );
}
