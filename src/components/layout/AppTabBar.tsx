import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function AppTabBar() {
  const { tabs, activeTabId, switchToTab, closeTab } = useAppTabs();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 border-b border-border/50 bg-muted/30 flex items-center px-2 shrink-0">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors max-w-[200px]",
                activeTabId === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              onClick={() => switchToTab(tab.id)}
            >
              <span className="truncate">{tab.title}</span>
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
