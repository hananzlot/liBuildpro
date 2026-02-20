import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { X, ExternalLink } from "lucide-react";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

interface DetailsDrawerProps {
  /** The ID of the selected record — drives open/close state */
  selectedId: string | null;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Title shown in the header */
  title?: React.ReactNode;
  /** Status/stage badges shown beside title */
  badges?: React.ReactNode;
  /** Full-page route for the "Open full page" button */
  fullPageHref?: string;
  /** Called when "Open full page" is clicked */
  onOpenFullPage?: () => void;
  /** Loading state shows skeleton */
  isLoading?: boolean;
  /** Footer actions */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Width class — defaults to w-[480px] */
  width?: string;
}

export function DetailsDrawer({
  selectedId,
  onClose,
  title,
  badges,
  fullPageHref,
  onOpenFullPage,
  isLoading = false,
  footer,
  children,
  className,
  width = "w-[480px]",
}: DetailsDrawerProps) {
  const isOpen = !!selectedId;

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col bg-card border-l border-border shadow-xl transition-transform duration-250 ease-out",
          width,
          "max-w-full",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 shrink-0">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <Skeleton className="h-5 w-40 mb-2" />
            ) : (
              <h2 className="text-base font-semibold text-foreground truncate">
                {title}
              </h2>
            )}
            {badges && <div className="flex items-center gap-1.5 mt-1.5">{badges}</div>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 shrink-0 flex items-center gap-2">
          {(fullPageHref || onOpenFullPage) && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={onOpenFullPage}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open full page
            </Button>
          )}
          {footer}
        </div>
      </aside>
    </>
  );
}

/* ── Hook: manages selectedId via URL search param ── */
export function useDetailsDrawerParam(paramName = "selected") {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get(paramName);

  const open = React.useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(paramName, id);
        return next;
      }, { replace: true });
    },
    [paramName, setSearchParams]
  );

  const close = React.useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(paramName);
      return next;
    }, { replace: true });
  }, [paramName, setSearchParams]);

  return { selectedId, open, close };
}
