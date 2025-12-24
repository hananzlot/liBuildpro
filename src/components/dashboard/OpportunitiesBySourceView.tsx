import { useState, useMemo } from "react";
import { Calendar, CalendarX, ChevronDown, Filter, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { format } from "date-fns";

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

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
}

interface Appointment {
  ghl_id: string;
  contact_id: string | null;
  appointment_status: string | null;
  start_time: string | null;
  title: string | null;
  end_time: string | null;
  notes: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Conversation {
  ghl_id: string;
  contact_id: string | null;
}

interface OpportunitiesBySourceViewProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  appointments: Appointment[];
  users: GHLUser[];
  conversations?: Conversation[];
}

type SortField = 'contact' | 'status' | 'value' | 'date' | 'hasAppointment';
type SortDirection = 'asc' | 'desc';
type AppointmentFilter = 'all' | 'with' | 'without';

export function OpportunitiesBySourceView({
  opportunities,
  contacts,
  appointments,
  users,
  conversations = [],
}: OpportunitiesBySourceViewProps) {
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>('all');
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'date',
    direction: 'desc',
  });
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Build contact lookup
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach(c => map.set(c.ghl_id, c));
    return map;
  }, [contacts]);

  // Build appointment lookup by contact_id
  const appointmentsByContact = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach(a => {
      if (a.contact_id) {
        const existing = map.get(a.contact_id) || [];
        existing.push(a);
        map.set(a.contact_id, existing);
      }
    });
    return map;
  }, [appointments]);

  // Get unique sources
  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    opportunities.forEach(opp => {
      if (opp.contact_id) {
        const contact = contactMap.get(opp.contact_id);
        const source = contact?.source || 'Direct';
        sourceSet.add(source);
      }
    });
    return Array.from(sourceSet).sort();
  }, [opportunities, contactMap]);

  // Get unique statuses
  const statuses = useMemo(() => {
    const statusSet = new Set<string>();
    opportunities.forEach(opp => {
      if (opp.status) statusSet.add(opp.status);
    });
    return Array.from(statusSet).sort();
  }, [opportunities]);

  // Helper functions
  const getContactName = (contactId: string | null): string => {
    if (!contactId) return 'Unknown';
    const contact = contactMap.get(contactId);
    return contact?.contact_name || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Unknown';
  };

  const getContactSource = (contactId: string | null): string => {
    if (!contactId) return 'Direct';
    const contact = contactMap.get(contactId);
    return contact?.source || 'Direct';
  };

  const hasAppointment = (contactId: string | null): boolean => {
    if (!contactId) return false;
    const appts = appointmentsByContact.get(contactId) || [];
    return appts.some(a => a.appointment_status?.toLowerCase() !== 'cancelled');
  };

  const getNextAppointment = (contactId: string | null): Appointment | null => {
    if (!contactId) return null;
    const appts = appointmentsByContact.get(contactId) || [];
    const now = new Date();
    const upcoming = appts
      .filter(a => a.start_time && new Date(a.start_time) > now && a.appointment_status?.toLowerCase() !== 'cancelled')
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
    return upcoming[0] || null;
  };

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'won': return 'default';
      case 'lost': return 'destructive';
      case 'abandoned': return 'secondary';
      default: return 'outline';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Helper to format date/time in PST
  const formatDateTimePST = (dateString: string): string => {
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
  };

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities.filter(opp => opp.stage_name?.toLowerCase() !== 'quickbase');

    // Source filter
    if (selectedSource !== 'all') {
      filtered = filtered.filter(opp => getContactSource(opp.contact_id) === selectedSource);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(opp => opp.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Appointment filter
    if (appointmentFilter === 'with') {
      filtered = filtered.filter(opp => hasAppointment(opp.contact_id));
    } else if (appointmentFilter === 'without') {
      filtered = filtered.filter(opp => !hasAppointment(opp.contact_id));
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      switch (sort.field) {
        case 'contact':
          return direction * getContactName(a.contact_id).localeCompare(getContactName(b.contact_id));
        case 'status':
          return direction * (a.status || '').localeCompare(b.status || '');
        case 'value':
          return direction * ((a.monetary_value || 0) - (b.monetary_value || 0));
        case 'date':
          return direction * (new Date(a.ghl_date_added || 0).getTime() - new Date(b.ghl_date_added || 0).getTime());
        case 'hasAppointment':
          const aHas = hasAppointment(a.contact_id) ? 1 : 0;
          const bHas = hasAppointment(b.contact_id) ? 1 : 0;
          return direction * (aHas - bHas);
        default:
          return 0;
      }
    });

    return filtered;
  }, [opportunities, selectedSource, statusFilter, appointmentFilter, sort, contactMap, appointmentsByContact]);

  const toggleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleRowClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setSheetOpen(true);
  };

  // Stats
  const withAppointments = filteredOpportunities.filter(o => hasAppointment(o.contact_id)).length;
  const withoutAppointments = filteredOpportunities.length - withAppointments;

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Opportunities by Source</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <Calendar className="h-3 w-3" />
                {withAppointments} with appt
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <CalendarX className="h-3 w-3" />
                {withoutAppointments} without
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={appointmentFilter} onValueChange={(v) => setAppointmentFilter(v as AppointmentFilter)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Appointments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="with">With Appt</SelectItem>
                <SelectItem value="without">Without Appt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <ScrollArea className="h-[280px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">
                    <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => toggleSort('contact')}>
                      Contact <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => toggleSort('status')}>
                      Status <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => toggleSort('hasAppointment')}>
                      Appt <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => toggleSort('value')}>
                      Value <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No opportunities found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOpportunities.slice(0, 50).map((opp) => {
                    const hasAppt = hasAppointment(opp.contact_id);
                    const nextAppt = getNextAppointment(opp.contact_id);
                    return (
                      <TableRow
                        key={opp.ghl_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(opp)}
                      >
                        <TableCell className="py-2">
                          <div>
                            <p className="font-medium text-sm truncate max-w-[130px]">
                              {getContactName(opp.contact_id)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[130px]">
                              {getContactSource(opp.contact_id)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="space-y-1">
                            <Badge 
                              variant={getStatusBadgeVariant(opp.status)} 
                              className="text-xs capitalize"
                            >
                              {opp.status || 'Unknown'}
                            </Badge>
                            {opp.stage_name && (
                              <p className="text-xs text-muted-foreground truncate max-w-[80px]">
                                {opp.stage_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          {hasAppt ? (
                            <div className="flex flex-col items-start">
                              <span className="flex items-center gap-1 text-green-600">
                                <Calendar className="h-3 w-3" />
                                <span className="text-xs">Yes</span>
                              </span>
                              {nextAppt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(nextAppt.start_time!), 'M/d')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600">
                              <CalendarX className="h-3 w-3" />
                              <span className="text-xs">No</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2 font-medium text-sm">
                          {formatCurrency(opp.monetary_value)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {filteredOpportunities.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing 50 of {filteredOpportunities.length} opportunities
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allOpportunities={opportunities}
      />
    </>
  );
}
