import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, User, ArrowUpDown, ArrowUp, ArrowDown, PhoneCall, DollarSign, Megaphone, ChevronDown } from "lucide-react";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { DateRange } from "react-day-picker";
import { getAddressFromContact, findContactByIdOrGhlId, findUserByIdOrGhlId } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
  address?: string | null;
  salesperson_confirmed?: boolean;
  salesperson_confirmed_at?: string | null;
}

interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
}

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
}

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

type SortColumn = 'contact' | 'start' | 'status' | 'rep' | 'address' | 'source' | 'oppStatus' | 'oppValue' | 'stage';
type SortDirection = 'asc' | 'desc';

interface AppointmentsTableProps {
  appointments: Appointment[];
  opportunities?: Opportunity[];
  contacts?: Contact[];
  users?: GHLUser[];
}

const ITEMS_PER_PAGE = 10;

export function AppointmentsTable({ 
  appointments, 
  opportunities = [], 
  contacts = [], 
  users = [] 
}: AppointmentsTableProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [repFilter, setRepFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [oppStatusFilter, setOppStatusFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { from: start, to: end };
  });
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('start');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleOpenOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySheetOpen(true);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
      case 'no_show':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'showed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const isUpcoming = (startTime: string | null) => {
    if (!startTime) return false;
    return new Date(startTime) > new Date();
  };

  const getUserName = (userId: string | null): string => {
    if (!userId) return 'Unassigned';
    const user = findUserByIdOrGhlId(users, undefined, userId);
    return user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unknown';
  };

  const formatName = (name: string): string => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getContactName = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return 'Unknown';
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    const name = contact?.contact_name || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Unknown';
    return formatName(name);
  };

  const getContactPhone = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return '-';
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    return contact?.phone || '-';
  };

  const getContactSource = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return '-';
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    return contact?.source || '-';
  };

  const getOpportunityStatus = (contactId: string | null): string => {
    if (!contactId) return '-';
    const opp = opportunities.find(o => o.contact_id === contactId);
    return opp?.status || '-';
  };

  const getOpportunityValue = (contactId: string | null): number | null => {
    if (!contactId) return null;
    const opp = opportunities.find(o => o.contact_id === contactId);
    return opp?.monetary_value || null;
  };

  const getOpportunityStage = (contactId: string | null): string => {
    if (!contactId) return '-';
    const opp = opportunities.find(o => o.contact_id === contactId);
    return opp?.stage_name || '-';
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getOpportunityStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getAddress = (appointment: Appointment): string => {
    const contact = findContactByIdOrGhlId(contacts, appointment.contact_uuid, appointment.contact_id);
    return getAddressFromContact(contact, appointments, appointment.contact_id) || '-';
  };

  // Get unique statuses and reps for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(appointments.map(a => a.appointment_status?.toLowerCase()).filter(Boolean));
    return Array.from(statuses).sort();
  }, [appointments]);

  // Format statuses for multi-select
  const statusOptions = useMemo(() => {
    return uniqueStatuses.map(status => ({
      value: status!,
      label: status!.charAt(0).toUpperCase() + status!.slice(1)
    }));
  }, [uniqueStatuses]);

  const uniqueReps = useMemo(() => {
    const reps = new Set(appointments.map(a => a.assigned_user_id).filter(Boolean));
    return Array.from(reps).map(id => ({
      id: id!,
      name: getUserName(id!)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, users]);

  // Format reps for multi-select
  const repOptions = useMemo(() => {
    return uniqueReps.map(rep => ({ value: rep.id, label: rep.name }));
  }, [uniqueReps]);

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    appointments.forEach(a => {
      const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
      if (contact?.source) sources.add(contact.source);
    });
    return Array.from(sources).sort();
  }, [appointments, contacts]);

  // Format sources for multi-select
  const sourceOptions = useMemo(() => {
    return uniqueSources.map(source => ({ value: source, label: source }));
  }, [uniqueSources]);

  // Get unique opportunity statuses for filter (normalized to lowercase)
  const uniqueOppStatuses = useMemo(() => {
    const statuses = new Set<string>();
    appointments.forEach(a => {
      const opp = opportunities.find(o => o.contact_id === a.contact_id);
      if (opp?.status) statuses.add(opp.status.toLowerCase());
    });
    return Array.from(statuses).sort();
  }, [appointments, opportunities]);

  // Format opportunity statuses for multi-select
  const oppStatusOptions = useMemo(() => {
    return uniqueOppStatuses.map(status => ({ 
      value: status, 
      label: status.charAt(0).toUpperCase() + status.slice(1) 
    }));
  }, [uniqueOppStatuses]);

  // Filter and paginate appointments
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Status filter (multi-select)
    if (statusFilter.length > 0) {
      filtered = filtered.filter(a => a.appointment_status && statusFilter.includes(a.appointment_status.toLowerCase()));
    }

    // Rep filter (multi-select)
    if (repFilter.length > 0) {
      filtered = filtered.filter(a => a.assigned_user_id && repFilter.includes(a.assigned_user_id));
    }

    // Source filter (multi-select)
    if (sourceFilter.length > 0) {
      filtered = filtered.filter(a => {
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        return contact?.source && sourceFilter.includes(contact.source);
      });
    }

    // Opportunity status filter (multi-select)
    if (oppStatusFilter.length > 0) {
      filtered = filtered.filter(a => {
        const opp = opportunities.find(o => o.contact_id === a.contact_id);
        return opp?.status && oppStatusFilter.includes(opp.status.toLowerCase());
      });
    }

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(a => {
        if (!a.start_time) return false;
        const apptDate = new Date(a.start_time);
        const from = dateRange.from!;
        const to = dateRange.to || dateRange.from!;
        const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
        return apptDate >= fromStart && apptDate <= toEnd;
      });
    }

    return filtered;
  }, [appointments, statusFilter, repFilter, sourceFilter, oppStatusFilter, dateRange, contacts, opportunities]);

  // Summary stats based on filtered appointments
  const summaryStats = useMemo(() => {
    const bySource: Record<string, { count: number; value: number }> = {};
    const byStatus: Record<string, { total: number; uniqueContacts: Set<string> }> = {};
    const byOppStatus: Record<string, { count: number; value: number }> = {};
    const byRep: Record<string, { id: string; name: string; count: number; value: number; countedContacts: Set<string> }> = {};
    const wonBySource: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;
    const countedContactIds = new Set<string>(); // Track unique contacts to avoid double-counting opportunities
    
    filteredAppointments.forEach(a => {
      // Count by appointment status (all appointments + unique contacts)
      const status = a.appointment_status || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = { total: 0, uniqueContacts: new Set() };
      }
      byStatus[status].total += 1;
      if (a.contact_id) {
        byStatus[status].uniqueContacts.add(a.contact_id);
      }

      // Count by rep (appointments count, but only unique contact values)
      const repId = a.assigned_user_id || 'unassigned';
      const repName = getUserName(a.assigned_user_id);
      if (!byRep[repId]) {
        byRep[repId] = { id: repId, name: repName, count: 0, value: 0, countedContacts: new Set() };
      }
      byRep[repId].count += 1;
      
      // Only add value once per unique contact per rep
      if (a.contact_id && !byRep[repId].countedContacts.has(a.contact_id)) {
        byRep[repId].countedContacts.add(a.contact_id);
        const oppValueForRep = getOpportunityValue(a.contact_id) || 0;
        byRep[repId].value += oppValueForRep;
      }
      
      // Only count opportunity value once per contact
      if (a.contact_id && !countedContactIds.has(a.contact_id)) {
        countedContactIds.add(a.contact_id);
        
        const source = getContactSource(a.contact_id);
        const oppValue = getOpportunityValue(a.contact_id) || 0;
        const oppStatus = getOpportunityStatus(a.contact_id);
        
        if (!bySource[source]) {
          bySource[source] = { count: 0, value: 0 };
        }
        bySource[source].count += 1;
        bySource[source].value += oppValue;
        
        if (!byOppStatus[oppStatus]) {
          byOppStatus[oppStatus] = { count: 0, value: 0 };
        }
        byOppStatus[oppStatus].count += 1;
        byOppStatus[oppStatus].value += oppValue;
        
        // Track Won By Source
        if (oppStatus.toLowerCase() === 'won') {
          if (!wonBySource[source]) {
            wonBySource[source] = { count: 0, value: 0 };
          }
          wonBySource[source].count += 1;
          wonBySource[source].value += oppValue;
        }
        
        totalValue += oppValue;
      }
    });

    return {
      total: filteredAppointments.length,
      uniqueContacts: countedContactIds.size,
      totalValue,
      bySource: Object.entries(bySource).sort((a, b) => b[1].value - a[1].value),
      byStatus: Object.entries(byStatus)
        .map(([status, data]) => [status, { total: data.total, unique: data.uniqueContacts.size }] as [string, { total: number; unique: number }])
        .sort((a, b) => b[1].total - a[1].total),
      byOppStatus: Object.entries(byOppStatus).sort((a, b) => b[1].value - a[1].value),
      wonBySource: Object.entries(wonBySource).sort((a, b) => b[1].value - a[1].value),
      byRep: Object.values(byRep)
        .map(data => ({ id: data.id, name: data.name, count: data.count, value: data.value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [filteredAppointments, contacts, opportunities, users]);

  // Sort appointments based on selected column and direction
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'contact':
          comparison = getContactName(a.contact_id).localeCompare(getContactName(b.contact_id));
          break;
        case 'start':
          const dateA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const dateB = b.start_time ? new Date(b.start_time).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'status':
          comparison = (a.appointment_status || '').localeCompare(b.appointment_status || '');
          break;
        case 'rep':
          comparison = getUserName(a.assigned_user_id).localeCompare(getUserName(b.assigned_user_id));
          break;
        case 'address':
          comparison = getAddress(a).localeCompare(getAddress(b));
          break;
        case 'source':
          comparison = getContactSource(a.contact_id).localeCompare(getContactSource(b.contact_id));
          break;
        case 'oppStatus':
          comparison = getOpportunityStatus(a.contact_id).localeCompare(getOpportunityStatus(b.contact_id));
          break;
        case 'stage':
          comparison = getOpportunityStage(a.contact_id).localeCompare(getOpportunityStage(b.contact_id));
          break;
        case 'oppValue':
          const valA = getOpportunityValue(a.contact_id) || 0;
          const valB = getOpportunityValue(b.contact_id) || 0;
          comparison = valA - valB;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredAppointments, sortColumn, sortDirection, contacts, users, opportunities]);

  const totalPages = Math.ceil(sortedAppointments.length / ITEMS_PER_PAGE);
  const paginatedAppointments = sortedAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  const handleStatusChange = (selected: string[]) => {
    setStatusFilter(selected);
    setCurrentPage(1);
  };

  const handleRepChange = (selected: string[]) => {
    setRepFilter(selected);
    setCurrentPage(1);
  };

  const handleSourceChange = (selected: string[]) => {
    setSourceFilter(selected);
    setCurrentPage(1);
  };

  const handleOppStatusChange = (selected: string[]) => {
    setOppStatusFilter(selected);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  const handleRowClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSheetOpen(true);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Appointments</CardTitle>
            <Badge variant="secondary" className="ml-auto">{filteredAppointments.length}</Badge>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Date Range</span>
              <DateRangeFilter
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <MultiSelectFilter
                options={statusOptions}
                selected={statusFilter}
                onChange={handleStatusChange}
                placeholder="All Status"
                className="w-[130px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Rep</span>
              <MultiSelectFilter
                options={repOptions}
                selected={repFilter}
                onChange={handleRepChange}
                placeholder="All Reps"
                icon={<User className="h-3 w-3" />}
                className="w-[150px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <MultiSelectFilter
                options={sourceOptions}
                selected={sourceFilter}
                onChange={handleSourceChange}
                placeholder="All Sources"
                icon={<Megaphone className="h-3 w-3" />}
                className="w-[150px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Opp. Status</span>
              <MultiSelectFilter
                options={oppStatusOptions}
                selected={oppStatusFilter}
                onChange={handleOppStatusChange}
                placeholder="All Opp. Status"
                icon={<DollarSign className="h-3 w-3" />}
                className="w-[150px]"
              />
            </div>

            {(statusFilter.length > 0 || repFilter.length > 0 || sourceFilter.length > 0 || oppStatusFilter.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStatusFilter([]);
                  setRepFilter([]);
                  setSourceFilter([]);
                  setOppStatusFilter([]);
                  setCurrentPage(1);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Summary Stats */}
          {filteredAppointments.length > 0 && (
            <div className="flex flex-wrap gap-4 pt-2 pb-2 border-t border-border/30 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Total Value:</span>
                <Badge variant="default" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {formatCurrency(summaryStats.totalValue)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">By Status:</span>
                {summaryStats.byStatus.map(([status, data]) => (
                  <Badge 
                    key={status} 
                    variant="outline" 
                    className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(status)} ${statusFilter.length === 1 && statusFilter[0] === status.toLowerCase() ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      if (statusFilter.length === 1 && statusFilter[0] === status.toLowerCase()) {
                        setStatusFilter([]);
                      } else {
                        setStatusFilter([status.toLowerCase()]);
                      }
                      setCurrentPage(1);
                    }}
                  >
                    {status}: {data.total}/{data.unique}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">By Opp. Status:</span>
                {summaryStats.byOppStatus.map(([status, data]) => (
                  <Badge 
                    key={status} 
                    variant="outline" 
                    className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${getOpportunityStatusColor(status)} ${oppStatusFilter.length === 1 && oppStatusFilter[0] === status.toLowerCase() ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      // If it's already selected via the dropdown, keep it selected (don't toggle off)
                      setOppStatusFilter([status.toLowerCase()]);
                      setCurrentPage(1);
                    }}
                  >
                    {status}: {data.count} ({formatCurrency(data.value)})
                  </Badge>
                ))}
              </div>
              {summaryStats.wonBySource.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Won By Source:</span>
                  {summaryStats.wonBySource.map(([source, data]) => (
                    <Badge 
                      key={source} 
                      variant="outline" 
                      className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    >
                      {source}: {data.count} ({formatCurrency(data.value)})
                    </Badge>
                  ))}
                </div>
              )}
              <Collapsible className="w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">By Source:</span>
                  {summaryStats.bySource.slice(0, 5).map(([source, data]) => (
                    <Badge 
                      key={source} 
                      variant="secondary" 
                      className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${sourceFilter.length === 1 && sourceFilter[0] === source ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        if (sourceFilter.length === 1 && sourceFilter[0] === source) {
                          setSourceFilter([]);
                        } else {
                          setSourceFilter([source]);
                        }
                        setCurrentPage(1);
                      }}
                    >
                      {source}: {data.count} ({formatCurrency(data.value)})
                    </Badge>
                  ))}
                  {summaryStats.bySource.length > 5 && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                        <span>+{summaryStats.bySource.length - 5} more</span>
                        <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
                <CollapsibleContent>
                  <ScrollArea className="max-h-32 mt-2">
                    <div className="flex flex-wrap gap-2 pl-[70px]">
                      {summaryStats.bySource.slice(5).map(([source, data]) => (
                        <Badge 
                          key={source} 
                          variant="secondary" 
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${sourceFilter.length === 1 && sourceFilter[0] === source ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => {
                            if (sourceFilter.length === 1 && sourceFilter[0] === source) {
                              setSourceFilter([]);
                            } else {
                              setSourceFilter([source]);
                            }
                            setCurrentPage(1);
                          }}
                        >
                          {source}: {data.count} ({formatCurrency(data.value)})
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">By Rep:</span>
                {summaryStats.byRep.map((rep) => (
                  <Badge 
                    key={rep.id} 
                    variant="outline" 
                    className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${repFilter.length === 1 && repFilter[0] === rep.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      if (repFilter.length === 1 && repFilter[0] === rep.id) {
                        setRepFilter([]);
                      } else {
                        setRepFilter([rep.id]);
                      }
                      setCurrentPage(1);
                    }}
                  >
                    {rep.name}: {rep.count} ({formatCurrency(rep.value)})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[180px]"
                  onClick={() => handleSort('contact')}
                >
                  <div className="flex items-center">
                    Contact
                    <SortIcon column="contact" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[140px]"
                  onClick={() => handleSort('address')}
                >
                  <div className="flex items-center">
                    Address
                    <SortIcon column="address" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[100px]"
                  onClick={() => handleSort('start')}
                >
                  <div className="flex items-center">
                    Start
                    <SortIcon column="start" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[100px]"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[80px]"
                  onClick={() => handleSort('rep')}
                >
                  <div className="flex items-center">
                    Rep
                    <SortIcon column="rep" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[100px]"
                  onClick={() => handleSort('source')}
                >
                  <div className="flex items-center">
                    Source
                    <SortIcon column="source" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[70px]"
                  onClick={() => handleSort('oppStatus')}
                >
                  <div className="flex items-center">
                    Opp
                    <SortIcon column="oppStatus" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[110px]"
                  onClick={() => handleSort('stage')}
                >
                  <div className="flex items-center">
                    Stage
                    <SortIcon column="stage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[80px]"
                  onClick={() => handleSort('oppValue')}
                >
                  <div className="flex items-center">
                    Value
                    <SortIcon column="oppValue" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAppointments.map((appt) => (
                  <TableRow 
                    key={appt.ghl_id} 
                    className="border-border/30 hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleRowClick(appt)}
                  >
                    <TableCell className="py-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground text-sm truncate">
                            {getContactName(appt.contact_id)}
                          </span>
                          {isUpcoming(appt.start_time) && (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1 py-0">
                              Soon
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {getContactPhone(appt.contact_id)}
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate italic">
                          {appt.title || 'Untitled'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getAddress(appt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-2">
                      {formatDateTime(appt.start_time)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getStatusColor(appt.appointment_status)}`}>
                          {appt.appointment_status || 'Unknown'}
                        </Badge>
                        {appt.salesperson_confirmed && (
                          <span title="Salesperson Confirmed" className="text-emerald-500">
                            <PhoneCall className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getUserName(appt.assigned_user_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getContactSource(appt.contact_id)}
                    </TableCell>
                    <TableCell className="py-2">
                      {getOpportunityStatus(appt.contact_id) !== '-' ? (
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getOpportunityStatusColor(getOpportunityStatus(appt.contact_id))}`}>
                          {getOpportunityStatus(appt.contact_id)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getOpportunityStage(appt.contact_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-2">
                      {formatCurrency(getOpportunityValue(appt.contact_id))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
              <span className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedAppointments.length)} of {sortedAppointments.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        opportunities={opportunities}
        contacts={contacts}
        users={users}
        appointments={appointments}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onOpenOpportunity={handleOpenOpportunity}
      />

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        allOpportunities={opportunities}
        contacts={contacts}
        users={users}
        appointments={appointments}
        open={opportunitySheetOpen}
        onOpenChange={setOpportunitySheetOpen}
      />
    </>
  );
}