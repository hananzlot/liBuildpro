import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DollarSign,
  MapPin,
  FileText,
  User,
  Phone,
  Mail,
  Calendar,
  Search,
  Megaphone,
} from "lucide-react";
import { format } from "date-fns";

interface DBOpportunity {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  won_at?: string | null;
  scope_of_work?: string | null;
}

interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields: unknown;
}

interface DBUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface OpportunitiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: DBOpportunity[];
  contacts: DBContact[];
  users: DBUser[];
  onOpportunityClick?: (opportunity: DBOpportunity) => void;
}

const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
  SCOPE_OF_WORK: "KwQRtJT0aMSHnq3mwR68",
};

function extractCustomField(customFields: unknown, fieldId: string): string | null {
  if (!Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper to format date/time in PST
function formatDateTimePST(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function OpportunitiesSheet({
  open,
  onOpenChange,
  opportunities,
  contacts,
  users,
  onOpportunityClick,
}: OpportunitiesSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => contactMap.set(c.ghl_id, c));

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    all: opportunities.length,
    open: opportunities.filter(o => o.status?.toLowerCase() === "open").length,
    won: opportunities.filter(o => o.status?.toLowerCase() === "won").length,
    lost: opportunities.filter(o => o.status?.toLowerCase() === "lost").length,
  }), [opportunities]);

  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(o => o.status?.toLowerCase() === statusFilter);
    }
    
    // Apply search filter
    if (searchFilter.trim()) {
      const searchTerm = searchFilter.toLowerCase().trim();
      filtered = filtered.filter((opp) => {
        const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        const source = contact?.source || "";
        const oppName = opp.name || "";
        
        return (
          contactName.toLowerCase().includes(searchTerm) ||
          source.toLowerCase().includes(searchTerm) ||
          oppName.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    return filtered;
  }, [opportunities, searchFilter, statusFilter, contactMap]);

  const totalValue = filteredOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Opportunities
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-1 text-sm mt-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              All: <span className="font-medium">{statusCounts.all}</span>
            </button>
            <button
              onClick={() => setStatusFilter("open")}
              className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "open" ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground hover:bg-muted"}`}
            >
              Open: <span className="font-medium">{statusCounts.open}</span>
            </button>
            <button
              onClick={() => setStatusFilter("won")}
              className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "won" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-muted"}`}
            >
              Won: <span className="font-medium">{statusCounts.won}</span>
            </button>
            <button
              onClick={() => setStatusFilter("lost")}
              className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "lost" ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:bg-muted"}`}
            >
              Lost: <span className="font-medium">{statusCounts.lost}</span>
            </button>
            <span className="text-muted-foreground ml-2">• {formatCurrency(totalValue)} value</span>
          </div>
        </SheetHeader>

        <div className="mt-4 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, source..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          <div className="space-y-4">
            {filteredOpportunities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchFilter ? "No opportunities match the search" : "No opportunities found"}
              </p>
            ) : (
              filteredOpportunities.map((opp) => {
                const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
                const salesPerson = opp.assigned_to ? userMap.get(opp.assigned_to) : null;
                const address = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
                const scopeOfWork = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK) : null;
                const contactName =
                  contact?.contact_name ||
                  `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
                  "Unknown Contact";

                return (
                  <Card 
                    key={opp.id} 
                    className={`border-border/50 ${onOpportunityClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => onOpportunityClick?.(opp)}
                  >
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {contactName}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {opp.name || "Unnamed Opportunity"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            {formatCurrency(opp.monetary_value || 0)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {opp.status || "Unknown"}
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-2 text-sm">
                        {address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-foreground">{address}</span>
                          </div>
                        )}

                        {scopeOfWork && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-foreground line-clamp-2">{scopeOfWork}</span>
                          </div>
                        )}

                        {salesPerson && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{salesPerson}</span>
                          </div>
                        )}

                        {contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{contact.phone}</span>
                          </div>
                        )}

                        {(opp.pipeline_name || opp.stage_name) && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              {opp.pipeline_name}
                              {opp.stage_name && ` • ${opp.stage_name}`}
                            </span>
                          </div>
                        )}

                        {contact?.source && (
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{contact.source}</span>
                          </div>
                        )}

                        {opp.ghl_date_added && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">
                              Created: {formatDateTimePST(opp.ghl_date_added)} PST
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
