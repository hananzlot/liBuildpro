import { Database, RefreshCw, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSyncTimestamps } from "@/hooks/useGHLContacts";
import { formatDistanceToNow } from "date-fns";

interface SyncDropdownProps {
  onSyncGHL: () => void;
  onSyncGHL2: () => void;
  isSyncingGHL: boolean;
  isSyncingGHL2: boolean;
}

export function SyncDropdown({ onSyncGHL, onSyncGHL2, isSyncingGHL, isSyncingGHL2 }: SyncDropdownProps) {
  const { data: timestamps } = useSyncTimestamps();
  
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const isSyncing = isSyncingGHL || isSyncingGHL2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={isSyncing}>
          <Database className={`h-4 w-4 mr-2 ${isSyncing ? "animate-pulse" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync"}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onSyncGHL} disabled={isSyncingGHL}>
          <Database className={`h-4 w-4 mr-2 ${isSyncingGHL ? "animate-pulse" : ""}`} />
          <div className="flex flex-col">
            <span>{isSyncingGHL ? "Syncing GHL..." : "Sync GHL (Main)"}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(timestamps?.lastGHLSync || null)}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSyncGHL2} disabled={isSyncingGHL2}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingGHL2 ? "animate-spin" : ""}`} />
          <div className="flex flex-col">
            <span>{isSyncingGHL2 ? "Syncing GHL2..." : "Sync GHL2 (Location 2)"}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(timestamps?.lastGHL2Import || null)}
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
