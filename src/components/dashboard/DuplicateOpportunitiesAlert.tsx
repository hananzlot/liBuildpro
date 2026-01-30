import { useState, useMemo } from "react";
import { AlertTriangle, ChevronRight, Merge, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Opportunity {
  id: string;
  ghl_id?: string | null;
  name?: string | null;
  contact_id?: string | null;
  contact_uuid?: string | null;
  stage_name?: string | null;
  pipeline_id?: string | null;
  pipeline_name?: string | null;
  monetary_value?: number | null;
  address?: string | null;
  ghl_date_added?: string | null;
}

interface Contact {
  id: string;
  ghl_id?: string | null;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface DuplicateGroup {
  key: string;
  contactName: string;
  pipelineName: string;
  opportunities: Opportunity[];
}

interface DuplicateOpportunitiesAlertProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  onSelectDuplicate: (oppA: Opportunity, oppB: Opportunity) => void;
}

export function DuplicateOpportunitiesAlert({
  opportunities,
  contacts,
  onSelectDuplicate,
}: DuplicateOpportunitiesAlertProps) {
  const [open, setOpen] = useState(false);

  // Find duplicate opportunities (same contact + same pipeline)
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, Opportunity[]>();

    opportunities.forEach((opp) => {
      if (!opp.contact_id || !opp.pipeline_id) return;
      const key = `${opp.contact_id}|${opp.pipeline_id}`;
      const existing = groupMap.get(key) || [];
      existing.push(opp);
      groupMap.set(key, existing);
    });

    const groups: DuplicateGroup[] = [];
    groupMap.forEach((opps, key) => {
      if (opps.length > 1) {
        const [contactId] = key.split("|");
        const contact = contacts.find(
          (c) => c.ghl_id === contactId || c.id === contactId
        );
        const contactName =
          contact?.contact_name ||
          `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
          "Unknown";

        // Sort by date (newest first)
        const sortedOpps = [...opps].sort((a, b) => {
          return (
            new Date(b.ghl_date_added || 0).getTime() -
            new Date(a.ghl_date_added || 0).getTime()
          );
        });

        groups.push({
          key,
          contactName,
          pipelineName: opps[0].pipeline_name || "Unknown Pipeline",
          opportunities: sortedOpps,
        });
      }
    });

    // Sort groups by contact name
    return groups.sort((a, b) => a.contactName.localeCompare(b.contactName));
  }, [opportunities, contacts]);

  const duplicateCount = duplicateGroups.length;

  if (duplicateCount === 0) {
    return null;
  }

  const handleSelectGroup = (group: DuplicateGroup) => {
    // Select first two opportunities from the group for merging
    if (group.opportunities.length >= 2) {
      onSelectDuplicate(group.opportunities[0], group.opportunities[1]);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Alert className="cursor-pointer hover:bg-muted/50 transition-colors border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          <AlertDescription className="flex items-center justify-between gap-4 w-full">
            <span className="text-sm font-medium">
              Possible Duplicates Detected
            </span>
            <Badge variant="secondary" className="shrink-0">
              {duplicateCount} group{duplicateCount !== 1 ? "s" : ""}
            </Badge>
          </AlertDescription>
        </Alert>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Merge className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Potential Duplicates</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {duplicateCount} contact{duplicateCount !== 1 ? "s" : ""} with
            multiple opportunities in the same pipeline
          </p>
        </div>
        <ScrollArea className="max-h-80">
          <div className="divide-y">
            {duplicateGroups.map((group) => (
              <button
                key={group.key}
                onClick={() => handleSelectGroup(group)}
                className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {group.contactName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {group.pipelineName} •{" "}
                    {group.opportunities.length} opportunities
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {group.opportunities.length}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
