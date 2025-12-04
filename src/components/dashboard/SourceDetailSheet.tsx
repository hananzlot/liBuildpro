import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, User, Calendar, Search, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";

interface Contact {
  id?: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  ghl_date_added: string | null;
  custom_fields?: unknown;
  assigned_to?: string | null;
  attributions?: unknown;
  tags?: string[] | null;
}

interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
}

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

type ViewMode = "opportunities" | "won";

interface SourceDetailSheetProps {
  source: string | null;
  mode: ViewMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  filteredContacts: Contact[];
  opportunities: Opportunity[];
  filteredOpportunities: Opportunity[];
  appointments: Appointment[];
  filteredAppointments: Appointment[];
  users: GHLUser[];
  showAppointments?: boolean;
}

export function SourceDetailSheet({
  source,
  mode,
  open,
  onOpenChange,
  contacts,
  filteredContacts,
  opportunities,
  filteredOpportunities,
  appointments,
  filteredAppointments,
  users,
  showAppointments = false,
}: SourceDetailSheetProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [oppSheetOpen, setOppSheetOpen] = useState(false);

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won": return "bg-emerald-500/20 text-emerald-400";
      case "lost":
      case "abandoned": return "bg-red-500/20 text-red-400";
      case "open": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Get ALL contacts for this source (to build proper contact ID lookup)
  const allSourceContacts = useMemo(() => {
    return contacts.filter(c => (c.source || "Direct") === source);
  }, [contacts, source]);

  const allSourceContactIds = useMemo(() => {
    return new Set(allSourceContacts.map(c => c.ghl_id));
  }, [allSourceContacts]);

  // Get opportunities for this source (use filtered opportunities, exclude quickbase)
  const sourceOpportunities = useMemo(() => {
    return filteredOpportunities
      .filter(o => o.contact_id && allSourceContactIds.has(o.contact_id))
      .filter(o => o.stage_name?.toLowerCase() !== 'quickbase');
  }, [filteredOpportunities, allSourceContactIds]);

  // Get appointments for this source (use filtered appointments)
  const sourceAppointments = useMemo(() => {
    return filteredAppointments.filter(a => a.contact_id && allSourceContactIds.has(a.contact_id));
  }, [filteredAppointments, allSourceContactIds]);

  // Unique appointments count (unique by appointment ghl_id)
  const uniqueAppointmentsCount = useMemo(() => {
    const uniqueIds = new Set(sourceAppointments.map(a => a.ghl_id));
    return uniqueIds.size;
  }, [sourceAppointments]);

  // Filter based on mode and search
  const displayOpportunities = useMemo(() => {
    let opps = sourceOpportunities;
    
    if (mode === "won") {
      opps = opps.filter(o => o.status?.toLowerCase() === "won");
    }
    
    if (statusFilter !== "all") {
      opps = opps.filter(o => o.status?.toLowerCase() === statusFilter);
    }

    if (stageFilter !== "all") {
      opps = opps.filter(o => o.stage_name === stageFilter);
    }
    
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      opps = opps.filter(o => {
        const contact = contacts.find(c => c.ghl_id === o.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return o.name?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }
    
    // Sort based on selected option
    return opps.sort((a, b) => {
      switch (sortBy) {
        case "stage":
          return (a.stage_name || "").localeCompare(b.stage_name || "");
        case "value":
          return (b.monetary_value || 0) - (a.monetary_value || 0);
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "date":
        default:
          return new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime();
      }
    });
  }, [sourceOpportunities, mode, statusFilter, stageFilter, sortBy, searchFilter, contacts]);

  // Available statuses
  const availableStatuses = useMemo(() => {
    const statuses = new Set(sourceOpportunities.map(o => o.status?.toLowerCase() || "unknown"));
    return Array.from(statuses).sort();
  }, [sourceOpportunities]);

  // Available stages
  const availableStages = useMemo(() => {
    const stages = new Set(sourceOpportunities.map(o => o.stage_name).filter(Boolean) as string[]);
    return Array.from(stages).sort();
  }, [sourceOpportunities]);

  // Totals
  const totalValue = displayOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const wonValue = sourceOpportunities
    .filter(o => o.status?.toLowerCase() === "won")
    .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  const handleOpportunityClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setOppSheetOpen(true);
  };

  if (!source) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg">{source}</SheetTitle>
                  <SheetDescription>
                    {showAppointments 
                      ? `${uniqueAppointmentsCount} unique appointments scheduled`
                      : mode === "opportunities" 
                        ? `${sourceOpportunities.length} opportunities • ${sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length} won`
                        : `${displayOpportunities.length} won • ${formatCurrency(wonValue)}`
                    }
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-4 space-y-4">
            {/* Summary */}
            {showAppointments ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Unique Appointments</div>
                  <div className="font-medium">{uniqueAppointmentsCount}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Unique Contacts</div>
                  <div className="font-medium">{new Set(sourceAppointments.map(a => a.contact_id)).size}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Total Opportunities</div>
                  <div className="font-medium">{sourceOpportunities.length}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Open</div>
                  <div className="font-medium">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "open").length}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Won Deals</div>
                  <div className="font-medium">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Won Value</div>
                  <div className="font-medium text-emerald-400">{formatCurrency(wonValue)}</div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {mode === "opportunities" && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {availableStatuses.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {availableStages.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="stage">By Stage</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="value">By Value</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Opportunities List */}
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-2">
                {displayOpportunities.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No {mode === "won" ? "won opportunities" : "opportunities"} found
                  </p>
                ) : (
                  displayOpportunities.map((opp) => {
                    const contact = contacts.find(c => c.ghl_id === opp.contact_id);
                    const contactName = contact?.contact_name || 
                      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "Unknown";
                    
                    return (
                      <div
                        key={opp.ghl_id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleOpportunityClick(opp)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{opp.name || "Unnamed"}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                              {opp.status || "Unknown"}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        {/* Pipeline Stage */}
                        {opp.stage_name && (
                          <div className="mb-1.5">
                            <Badge variant="secondary" className="text-xs font-normal">
                              {opp.stage_name}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate">{contactName}</span>
                          </div>
                          <span className="font-mono text-emerald-400">{formatCurrency(opp.monetary_value)}</span>
                        </div>
                        {opp.ghl_date_added && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(opp.ghl_date_added), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity as any}
        appointments={appointments as any}
        contacts={contacts as any}
        users={users as any}
        open={oppSheetOpen}
        onOpenChange={setOppSheetOpen}
        allOpportunities={opportunities as any}
      />
    </>
  );
}
