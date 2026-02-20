import * as React from "react";
import { cn } from "@/lib/utils";

type BadgePillIntent =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

interface BadgePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  intent?: BadgePillIntent;
}

const intentStyles: Record<BadgePillIntent, string> = {
  default:
    "bg-muted text-muted-foreground",
  primary:
    "bg-primary/10 text-primary border-primary/20",
  success:
    "bg-success/10 text-success border-success/20",
  warning:
    "bg-warning/10 text-warning border-warning/20",
  danger:
    "bg-destructive/10 text-destructive border-destructive/20",
  info:
    "bg-accent text-accent-foreground border-accent-foreground/10",
  muted:
    "bg-muted/60 text-muted-foreground border-border/40",
};

export function BadgePill({
  intent = "default",
  className,
  children,
  ...props
}: BadgePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap transition-colors",
        intentStyles[intent],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* Helper: map common CRM statuses to intents */
export function statusToIntent(status: string | null | undefined): BadgePillIntent {
  switch (status?.toLowerCase()) {
    case "won":
      return "success";
    case "lost":
    case "abandoned":
      return "danger";
    case "open":
      return "primary";
    default:
      return "muted";
  }
}
