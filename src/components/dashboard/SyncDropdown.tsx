import { Database, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSyncTimestamps } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { formatDistanceToNow } from "date-fns";

interface SyncDropdownProps {
  onSyncGHL: () => void;
  isSyncingGHL: boolean;
}

export function SyncDropdown({ onSyncGHL, isSyncingGHL }: SyncDropdownProps) {
  const { isGHLEnabled } = useGHLMode();
  const { data: timestamps } = useSyncTimestamps();
  
  // Hide sync button when GHL integration is disabled
  if (!isGHLEnabled) {
    return null;
  }
  
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="outline" onClick={onSyncGHL} disabled={isSyncingGHL}>
          <Database className={`h-4 w-4 mr-2 ${isSyncingGHL ? "animate-pulse" : ""}`} />
          {isSyncingGHL ? "Syncing..." : "Sync GHL"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Last synced: {formatTimestamp(timestamps?.lastGHLSync || null)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
