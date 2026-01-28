import { Database, Clock, Download, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSyncTimestamps } from "@/hooks/useGHLContacts";
import { useGHLMode } from "@/hooks/useGHLMode";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="flex items-center gap-2">
      {/* Import from GHL button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" onClick={onSyncGHL} disabled={isSyncingGHL}>
            <Download className={`h-4 w-4 mr-2 ${isSyncingGHL ? "animate-pulse" : ""}`} />
            {isSyncingGHL ? "Importing..." : "Import from GHL"}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Import data from GoHighLevel</p>
            <p className="text-xs text-muted-foreground">
              Pulls contacts, opportunities, and appointments from GHL into your local database.
            </p>
            <div className="flex items-center gap-1 text-xs pt-1 border-t">
              <Clock className="h-3 w-3" />
              Last imported: {formatTimestamp(timestamps?.lastGHLSync || null)}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Export to GHL - Future Feature indicator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" disabled className="opacity-50 cursor-not-allowed">
            <Upload className="h-4 w-4 mr-2" />
            Export to GHL
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                Syncing data back to GHL is a future feature. Currently, all records created in the app are stored locally.
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}