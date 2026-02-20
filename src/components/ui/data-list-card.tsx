import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DataListCard: a card wrapper for tables/lists with sticky header support.
 * Use inside page layouts to give tables the "card-first" treatment.
 */
interface DataListCardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DataListCard({ className, children, ...props }: DataListCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DataListCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DataListCardHeader({ className, children, ...props }: DataListCardHeaderProps) {
  return (
    <div
      className={cn("px-4 py-3 border-b border-border/40", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface DataListCardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DataListCardBody({ className, children, ...props }: DataListCardBodyProps) {
  return (
    <div className={cn("overflow-x-auto", className)} {...props}>
      {children}
    </div>
  );
}

interface DataListCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DataListCardFooter({ className, children, ...props }: DataListCardFooterProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-border/40 flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
