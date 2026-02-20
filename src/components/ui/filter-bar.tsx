import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";

/* ── FilterBar: wraps filters inside a card surface ── */
interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function FilterBar({ className, children, ...props }: FilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-xs p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

/* ── FilterChips: shows active filter chips with remove capability ── */
interface FilterChip {
  label: string;
  value: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll?: () => void;
}

export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {chips.map((chip) => (
        <Badge
          key={`${chip.label}-${chip.value}`}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-0.5 text-xs font-medium bg-accent text-accent-foreground"
        >
          <span className="text-muted-foreground mr-0.5">{chip.label}:</span>
          {chip.value}
          <button
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {onClearAll && chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
