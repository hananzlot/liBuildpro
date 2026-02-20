import { useEffect, useRef, useState } from "react";
import { X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppTabBar() {
  const { tabs, activeTabId, switchToTab, closeTab, closeAllTabs, reorderTabs } = useAppTabs();
  const { company } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabsCountRef = useRef(tabs.length);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const { data: pendingDepositsCount = 0 } = useQuery({
    queryKey: ["pending-deposits-count-tab", company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      const { count } = await supabase
        .from("project_payments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("payment_status", "Received")
        .or("deposit_verified.is.null,deposit_verified.eq.false");
      return count || 0;
    },
    enabled: !!company?.id,
  });

  // Auto-scroll to the end when new tabs are added
  useEffect(() => {
    if (tabs.length > tabsCountRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
    tabsCountRef.current = tabs.length;
  }, [tabs.length]);

  if (tabs.length === 0) {
    return null;
  }

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (tabId !== draggedTabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== targetTabId) {
      reorderTabs(draggedTabId, targetTabId);
    }
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return (
    <div className="h-8 border-b border-border/40 bg-muted/20 flex items-center px-2 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={closeAllTabs}
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close all tabs</TooltipContent>
      </Tooltip>
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20"
      >
        <div className="flex items-center gap-1 w-max">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, tab.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium cursor-grab transition-all max-w-[200px] relative",
                activeTabId === tab.id
                  ? "bg-background text-foreground shadow-xs after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-primary after:rounded-full"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                draggedTabId === tab.id && "opacity-50 cursor-grabbing",
                dragOverTabId === tab.id && "ring-2 ring-primary ring-offset-1"
              )}
              onClick={() => switchToTab(tab.id)}
            >
              <span className="truncate">{tab.title}</span>
              {tab.path === "/pending-deposits" && pendingDepositsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none">
                  {pendingDepositsCount}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive",
                  activeTabId === tab.id && "opacity-60"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
