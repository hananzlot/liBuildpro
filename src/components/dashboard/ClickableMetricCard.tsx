import { cn } from "@/lib/utils";
import { LucideIcon, AlertTriangle, Maximize2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BreakdownItem {
  label: string;
  value: number;
}

interface ClickableMetricCardProps {
  title: string;
  value: string | number;
  secondaryValue?: string;
  subtitle?: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  warningText?: string;
  breakdown?: BreakdownItem[];
}

export function ClickableMetricCard({ 
  title, 
  value, 
  secondaryValue, 
  subtitle, 
  icon: Icon, 
  onClick,
  className,
  warningText,
  breakdown
}: ClickableMetricCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  };

  return (
    <>
        <div 
        className={cn(
          "relative overflow-hidden rounded-xl bg-card p-4 border border-border/50",
          "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <button
              onClick={handleTitleClick}
              className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors text-left"
            >
              <span>{title}</span>
              <Maximize2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
              {secondaryValue && (
                <p className="text-base font-semibold text-primary">{secondaryValue}</p>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {breakdown && breakdown.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {breakdown.map((item, index) => (
                  <span key={index}>
                    <span className="font-medium text-foreground">{item.value}</span> {item.label}
                  </span>
                ))}
              </div>
            )}
            {warningText && (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{warningText}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span>{title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Main value display */}
            <div className="text-center space-y-2">
              <div className="flex items-baseline justify-center gap-3">
                <p className="text-5xl font-bold tracking-tight text-foreground">{value}</p>
                {secondaryValue && (
                  <p className="text-2xl font-semibold text-primary">{secondaryValue}</p>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>

            {/* Breakdown section */}
            {breakdown && breakdown.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  {breakdown.map((item, index) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning */}
            {warningText && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">{warningText}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}