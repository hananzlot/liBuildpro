import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
import { User, Megaphone, Calendar, DollarSign, Clock, GitBranch, ChevronRight, Search, MapPin } from "lucide-react";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { getAddressFromContact } from "@/lib/utils";

interface Opportunity {
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
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  address?: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  assigned_to: string | null;
  custom_fields?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface SalesRepDetailSheetProps {
  repName: string;
  repGhlId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: Opportunity[];
  appointments: Appointment[];
  contacts: Contact[];
  users: GHLUser[];
}

const STATUS_ORDER: Record<string, number> = {
  won: 0,
  open: 1,
  lost: 2,
  abandoned: 3,
};

export function SalesRepDetailSheet({
  repName,
  repGhlId,
  open,
  onOpenChange,
  opportunities,
  appointments,
  contacts,
  users,
}: SalesRepDetailSheetProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [oppSheetOpen, setOppSheetOpen] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const capitalizeWords = (str: string | null) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  // Create lookup maps for hybrid opportunity attribution (same logic as leaderboard)
  const contactAssignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach(c => {
      if (c.ghl_id && c.assigned_to) {
        map.set(c.ghl_id, c.assigned_to);
      }
    });
    return map;
  }, [contacts]);

  const appointmentAssignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach(a => {
      if (a.contact_id && a.assigned_user_id && !map.has(a.contact_id)) {
        map.set(a.contact_id, a.assigned_user_id);
      }
    });
    return map;
  }, [appointments]);

  // Helper: Get effective assignment for an opportunity using fallback chain
  const getEffectiveAssignment = (opportunity: Opportunity): string | null => {
    if (opportunity.assigned_to) return opportunity.assigned_to;
    if (opportunity.contact_id) {
      const contactAssignment = contactAssignmentMap.get(opportunity.contact_id);
      if (contactAssignment) return contactAssignment;
      const appointmentAssignment = appointmentAssignmentMap.get(opportunity.contact_id);
      if (appointmentAssignment) return appointmentAssignment;
    }
    return null;
  };

  // Get opportunities using hybrid attribution (matches leaderboard logic)
  const repOpportunities = useMemo(() => {
    return opportunities.filter(o => getEffectiveAssignment(o) === repGhlId);
  }, [opportunities, repGhlId, contactAssignmentMap, appointmentAssignmentMap]);

  // Get contacts directly assigned to this rep
  const repContacts = useMemo(() => {
    return contacts.filter(c => c.assigned_to === repGhlId);
  }, [contacts, repGhlId]);

  // Get appointments assigned to this rep
  const repAppointments = useMemo(() => {
    return appointments.filter(a => a.assigned_user_id === repGhlId);
  }, [appointments, repGhlId]);

  // Calculate unique contacts across all activities (opportunities + appointments)
  const uniqueContactsCount = useMemo(() => {
    const contactIds = new Set<string>();
    // Add contacts from opportunities
    repOpportunities.forEach(o => {
      if (o.contact_id) contactIds.add(o.contact_id);
    });
    // Add contacts from appointments
    repAppointments.forEach(a => {
      if (a.contact_id) contactIds.add(a.contact_id);
    });
    return contactIds.size;
  }, [repOpportunities, repAppointments]);

  // Count unique contacts with appointments
  const uniqueAppointmentContacts = useMemo(() => {
    const contactIds = new Set<string>();
    repAppointments.forEach(a => {
      if (a.contact_id) contactIds.add(a.contact_id);
    });
    return contactIds.size;
  }, [repAppointments]);

  // Sort opportunities by status (won, open, lost)
  const sortedOpportunities = useMemo(() => {
    return [...repOpportunities].sort((a, b) => {
      const statusA = STATUS_ORDER[a.status?.toLowerCase() || ''] ?? 99;
      const statusB = STATUS_ORDER[b.status?.toLowerCase() || ''] ?? 99;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime();
    });
  }, [repOpportunities]);

  // Helper to get source for an opportunity
  const getOpportunitySource = (opp: Opportunity): string => {
    const contact = contacts.find(c => c.ghl_id === opp.contact_id);
    return contact?.source || 'No Source';
  };

  // Filter opportunities by status and source (beginning of word match)
  const filteredOpportunities = useMemo(() => {
    return sortedOpportunities.filter(o => {
      const matchesStatus = statusFilter === "all" || o.status?.toLowerCase() === statusFilter;
      
      // Source filter: beginning of word match
      let matchesSource = true;
      if (sourceFilter.trim()) {
        const searchTerm = sourceFilter.toLowerCase().trim();
        const source = getOpportunitySource(o).toLowerCase();
        const words = source.split(/\s+/);
        matchesSource = words.some(word => word.startsWith(searchTerm)) || source.startsWith(searchTerm);
      }
      
      return matchesStatus && matchesSource;
    });
  }, [sortedOpportunities, statusFilter, sourceFilter, contacts]);

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set(repOpportunities.map(o => o.status?.toLowerCase() || 'unknown'));
    return Array.from(statuses).sort((a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99));
  }, [repOpportunities]);

  // Group contacts by source (sorted by count)
  const leadsBySource = useMemo(() => {
    const sourceMap = new Map<string, Contact[]>();
    repContacts.forEach(c => {
      const source = c.source || 'No Source';
      if (!sourceMap.has(source)) sourceMap.set(source, []);
      sourceMap.get(source)!.push(c);
    });
    return Array.from(sourceMap.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [repContacts]);

  // Calculate totals
  const totalValue = repOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const wonOpps = repOpportunities.filter(o => o.status?.toLowerCase() === 'won');
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  const handleOpportunityClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setOppSheetOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl overflow-hidden p-0">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-semibold">{repName}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {uniqueContactsCount} contacts ({repContacts.length} directly assigned)
                  </p>
                </div>
              </div>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[calc(100vh-100px)]">
            <div className="p-4 space-y-4">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Total Opportunities</div>
                  <div className="font-medium">{repOpportunities.length}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Pipeline Value</div>
                  <div className="font-medium text-emerald-400">{formatCurrency(totalValue)}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Won Deals</div>
                  <div className="font-medium">{wonOpps.length}</div>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-muted-foreground text-xs mb-0.5">Won Value</div>
                  <div className="font-medium text-emerald-400">{formatCurrency(wonValue)}</div>
                </div>
              </div>

              {/* Leads by Source */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                  <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Leads by Source ({leadsBySource.length})
                  </span>
                </div>
                <div className="divide-y max-h-48 overflow-y-auto">
                  {leadsBySource.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No leads</div>
                  ) : (
                    leadsBySource.map(([source, sourceContacts]) => (
                      <div key={source} className="p-3 flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{source}</span>
                        <Badge variant="secondary" className="text-xs">{sourceContacts.length}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Appointments */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Appointments ({repAppointments.length} across {uniqueAppointmentContacts} contacts)
                  </span>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {repAppointments.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No appointments</div>
                  ) : (
                    repAppointments
                      .sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime())
                      .slice(0, 10)
                      .map((appt) => {
                        const contact = contacts.find(c => c.ghl_id === appt.contact_id);
                        const opportunity = opportunities.find(o => o.contact_id === appt.contact_id);
                        
                        // Extract address from contact with appointment fallback
                        const address = getAddressFromContact(contact, appointments, appt.contact_id);
                        
                        const contactName = capitalizeWords(
                          contact?.contact_name || 
                          [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 
                          'Unknown Contact'
                        );
                        
                        return (
                          <div 
                            key={appt.ghl_id} 
                            className={`p-3 space-y-1.5 ${opportunity ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                            onClick={() => opportunity && handleOpportunityClick(opportunity)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{contactName}</div>
                                <div className="text-xs text-muted-foreground">{appt.title || 'Untitled'}</div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    appt.appointment_status?.toLowerCase() === 'confirmed' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                      : appt.appointment_status?.toLowerCase() === 'cancelled'
                                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  }`}
                                >
                                  {appt.appointment_status || 'Unknown'}
                                </Badge>
                                {opportunity && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </div>
                            {address && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(appt.start_time)}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Opportunities */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex flex-col gap-2 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Opportunities ({filteredOpportunities.length})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {availableStatuses.map(status => (
                          <SelectItem key={status} value={status} className="capitalize">
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filter source..."
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {filteredOpportunities.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No opportunities</div>
                  ) : (
                    filteredOpportunities.map((opp) => {
                      const contact = contacts.find(c => c.ghl_id === opp.contact_id);
                      return (
                        <div 
                          key={opp.ghl_id} 
                          className="p-3 space-y-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleOpportunityClick(opp)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{opp.name || 'Unnamed'}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                                {opp.status || 'Unknown'}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          {opp.stage_name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <GitBranch className="h-3 w-3" />
                              <span className="truncate">{opp.pipeline_name ? `${opp.pipeline_name} → ` : ''}{opp.stage_name}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(opp.ghl_date_added)}
                            </div>
                            <span className="font-mono text-emerald-400">{formatCurrency(opp.monetary_value)}</span>
                          </div>
                          {contact?.source && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Megaphone className="h-3 w-3" />
                              {contact.source}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        open={oppSheetOpen}
        onOpenChange={setOppSheetOpen}
        allOpportunities={opportunities}
      />
    </>
  );
}
