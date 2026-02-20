import { useState, useMemo, useEffect } from "react";
import { useAppTabs } from "@/contexts/AppTabsContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BadgePill, statusToIntent } from "@/components/ui/badge-pill";
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
import { useAppointmentsFilters } from "@/stores/useAppointmentsFilters";

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
  onFilteredCountChange?: (count: number) => void;
}

const ITEMS_PER_PAGE = 10;

export function AppointmentsTable({ 
  appointments, 
  opportunities = [], 
  contacts = [], 
  users = [],
  onFilteredCountChange
}: AppointmentsTableProps) {
  const { openTab } = useAppTabs();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);

  // Persistent filters from Zustand store
  const {
    dateRange: storedDateRange,
    statusFilter,
    repFilter,
    sourceFilter,
    oppStatusFilter,
    sortColumn,
    sortDirection,
    currentPage,
    setDateRange: setStoredDateRange,
    setStatusFilter,
    setRepFilter,
    setSourceFilter,
    setOppStatusFilter,
    setSort,
    setCurrentPage,
    clearFilters,
  } = useAppointmentsFilters();

  // Convert stored ISO strings back to DateRange
  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!storedDateRange?.from) return undefined;
    return {
      from: new Date(storedDateRange.from),
      to: storedDateRange.to ? new Date(storedDateRange.to) : undefined,
    };
  }, [storedDateRange]);

  const handleOpenOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySheetOpen(true);
  };

  const formatDateTime = (dateString: string | null) => {
     if (!dateString) return '-';
     const date = new Date(dateString);
     return date.toLocaleString('en-US', {
       month: '2-digit',
       day: '2-digit',
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
    if (!contactId && !contactUuid) return '(No Source)';
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    return contact?.source || '(No Source)';
  };

  const findPrimaryOpportunity = (contactId: string | null, contactUuid?: string | null) => {
    if (!contactId && !contactUuid) return undefined;
    return opportunities.find(o => (contactId && o.contact_id === contactId) || (contactUuid && o.contact_uuid === contactUuid));
  };

  const getOpportunityStatus = (contactId: string | null, contactUuid?: string | null): string => {
    const opp = findPrimaryOpportunity(contactId, contactUuid);
    return opp?.status || '-';
  };

  const getOpportunityValue = (contactId: string | null, contactUuid?: string | null): number | null => {
    const opp = findPrimaryOpportunity(contactId, contactUuid);
    return opp?.monetary_value || null;
  };

  // Get ALL opportunities for a contact (for proper multi-opp tracking)
  const getOpportunitiesForContact = (contactId: string | null, contactUuid?: string | null): Opportunity[] => {
    if (!contactId && !contactUuid) return [];
    return opportunities.filter(o => (contactId && o.contact_id === contactId) || (contactUuid && o.contact_uuid === contactUuid));
  };

  const getOpportunityStage = (contactId: string | null, contactUuid?: string | null): string => {
    const opp = findPrimaryOpportunity(contactId, contactUuid);
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
    let hasUnassigned = appointments.some(a => !a.assigned_user_id);
    const repList = Array.from(reps).map(id => ({
      id: id!,
      name: getUserName(id!)
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    // Add unassigned option at the end if there are unassigned appointments
    if (hasUnassigned) {
      repList.push({ id: 'unassigned', name: 'Unassigned' });
    }
    return repList;
  }, [appointments, users]);

  // Format reps for multi-select
  const repOptions = useMemo(() => {
    return uniqueReps.map(rep => ({ value: rep.id, label: rep.name }));
  }, [uniqueReps]);

  // Get unique sources for filter (including null/empty as "Unknown")
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    let hasNullSource = false;
    appointments.forEach(a => {
      const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
      if (contact?.source) {
        sources.add(contact.source);
      } else {
        hasNullSource = true;
      }
    });
    const result = Array.from(sources).sort();
    // Add placeholder for null/empty sources at the end
    if (hasNullSource) {
      result.push('(No Source)');
    }
    return result;
  }, [appointments, contacts]);

  // Format sources for multi-select
  const sourceOptions = useMemo(() => {
    return uniqueSources.map(source => ({ value: source, label: source }));
  }, [uniqueSources]);

  // Get unique opportunity statuses for filter (normalized to lowercase)
  const uniqueOppStatuses = useMemo(() => {
    const statuses = new Set<string>();
    appointments.forEach(a => {
      const opp = findPrimaryOpportunity(a.contact_id, a.contact_uuid);
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

    // Rep filter (multi-select) - handles "unassigned" for null/empty user IDs
    if (repFilter.length > 0) {
      filtered = filtered.filter(a => {
        // Check if we're filtering for "unassigned" which matches null/empty user IDs
        if (repFilter.includes('unassigned')) {
          if (!a.assigned_user_id) return true;
        }
        return a.assigned_user_id && repFilter.includes(a.assigned_user_id);
      });
    }

    // Source filter (multi-select) - handles "(No Source)" for null/empty sources
    if (sourceFilter.length > 0) {
      filtered = filtered.filter(a => {
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        const contactSource = contact?.source;
        // Check if we're filtering for "(No Source)" which matches null/empty sources
        if (sourceFilter.includes('(No Source)')) {
          if (!contactSource) return true;
        }
        return contactSource && sourceFilter.includes(contactSource);
      });
    }

    // Opportunity status filter (multi-select)
    if (oppStatusFilter.length > 0) {
      filtered = filtered.filter(a => {
        const opp = findPrimaryOpportunity(a.contact_id, a.contact_uuid);
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

  // De-dupe rows: if the same contact shows the same opp value/status/stage (often due to multiple appointment date records),
  // keep only the most recent appointment for that combination.
  const dedupedAppointments = useMemo(() => {
    const byKey = new Map<string, Appointment>();

    for (const appt of filteredAppointments) {
      const contactKey = appt.contact_id ?? appt.contact_uuid ?? `no-contact:${appt.ghl_id}`;
      const repKey = appt.assigned_user_id ?? 'unassigned';
      const opp = findPrimaryOpportunity(appt.contact_id, appt.contact_uuid);
      const oppValueKey = opp?.monetary_value ?? 'null';
      const oppStatusKey = (opp?.status ?? '-').toLowerCase();
      const oppStageKey = (opp?.stage_name ?? '-').toLowerCase();
      const key = `${contactKey}::${repKey}::${oppStatusKey}::${oppStageKey}::${oppValueKey}`;

      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, appt);
        continue;
      }

      const existingTime = existing.start_time ? new Date(existing.start_time).getTime() : 0;
      const currentTime = appt.start_time ? new Date(appt.start_time).getTime() : 0;
      if (currentTime > existingTime) {
        byKey.set(key, appt);
      }
    }

    return Array.from(byKey.values());
  }, [filteredAppointments, opportunities]);

  // Notify parent of filtered count changes
  useEffect(() => {
    onFilteredCountChange?.(dedupedAppointments.length);
  }, [dedupedAppointments.length, onFilteredCountChange]);

  // Summary stats based on filtered appointments
  // Summary stats based on filtered appointments
  const summaryStats = useMemo(() => {
    const bySource: Record<string, { count: number; value: number }> = {};
    const byStatus: Record<string, { total: number; uniqueContacts: Set<string> }> = {};
    const byOppStatus: Record<string, { count: number; value: number }> = {};
    const byRep: Record<string, { id: string; name: string; count: number; value: number; wonValue: number; countedOpps: Set<string> }> = {};
    const wonBySource: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;
    let totalWonValue = 0;
    const countedOppIds = new Set<string>(); // Track unique opportunities to avoid double-counting
    const processedContacts = new Set<string>(); // Track contacts we've already processed for opportunity lookup
    
    dedupedAppointments.forEach(a => {
      // Count by appointment status (all appointments + unique contacts)
      const status = a.appointment_status || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = { total: 0, uniqueContacts: new Set() };
      }
      byStatus[status].total += 1;
      if (a.contact_id) {
        byStatus[status].uniqueContacts.add(a.contact_id);
      }

      // Count by rep (appointments count)
      const repId = a.assigned_user_id || 'unassigned';
      const repName = getUserName(a.assigned_user_id);
      if (!byRep[repId]) {
        byRep[repId] = { id: repId, name: repName, count: 0, value: 0, wonValue: 0, countedOpps: new Set() };
      }
      byRep[repId].count += 1;
      
      // Process all opportunities for this contact (only once per contact)
      const contactKey = a.contact_id ?? a.contact_uuid;
      if (contactKey && !processedContacts.has(contactKey)) {
        processedContacts.add(contactKey);
        
        const contactOpps = getOpportunitiesForContact(a.contact_id, a.contact_uuid);
        const source = getContactSource(a.contact_id, a.contact_uuid);
        
        contactOpps.forEach(opp => {
          const oppId = opp.ghl_id || opp.id || '';
          if (!oppId || countedOppIds.has(oppId)) return;
          countedOppIds.add(oppId);
          
          const oppValue = opp.monetary_value || 0;
          const oppStatus = opp.status || '-';
          
          // Add to rep stats (attribute to the appointment's rep)
          if (!byRep[repId].countedOpps.has(oppId)) {
            byRep[repId].countedOpps.add(oppId);
            byRep[repId].value += oppValue;
            if (oppStatus.toLowerCase() === 'won') {
              byRep[repId].wonValue += oppValue;
            }
          }
          
          // By Source
          if (!bySource[source]) {
            bySource[source] = { count: 0, value: 0 };
          }
          bySource[source].count += 1;
          bySource[source].value += oppValue;
          
          // By Opp Status
          if (!byOppStatus[oppStatus]) {
            byOppStatus[oppStatus] = { count: 0, value: 0 };
          }
          byOppStatus[oppStatus].count += 1;
          byOppStatus[oppStatus].value += oppValue;
          
          // Won By Source
          if (oppStatus.toLowerCase() === 'won') {
            if (!wonBySource[source]) {
              wonBySource[source] = { count: 0, value: 0 };
            }
            wonBySource[source].count += 1;
            wonBySource[source].value += oppValue;
            totalWonValue += oppValue;
          }
          
          totalValue += oppValue;
        });
      }
    });

    // Sort byStatus: red statuses (cancelled, no_show) at end
    const redStatuses = ['cancelled', 'no_show', 'noshow'];
    const sortedByStatus = Object.entries(byStatus)
      .map(([status, data]) => [status, { total: data.total, unique: data.uniqueContacts.size }] as [string, { total: number; unique: number }])
      .sort((a, b) => {
        const aIsRed = redStatuses.includes(a[0].toLowerCase());
        const bIsRed = redStatuses.includes(b[0].toLowerCase());
        if (aIsRed && !bIsRed) return 1;
        if (!aIsRed && bIsRed) return -1;
        return b[1].total - a[1].total;
      });

    // Sort byOppStatus: red statuses (lost, abandoned) at end
    const redOppStatuses = ['lost', 'abandoned'];
    const sortedByOppStatus = Object.entries(byOppStatus).sort((a, b) => {
      const aIsRed = redOppStatuses.includes(a[0].toLowerCase());
      const bIsRed = redOppStatuses.includes(b[0].toLowerCase());
      if (aIsRed && !bIsRed) return 1;
      if (!aIsRed && bIsRed) return -1;
      return b[1].value - a[1].value;
    });

    // Sort byRep: reps with wins first, then by value
    const sortedByRep = Object.values(byRep)
      .map(data => ({ id: data.id, name: data.name, count: data.count, value: data.value, wonValue: data.wonValue }))
      .sort((a, b) => {
        // Reps with wins first
        if (a.wonValue > 0 && b.wonValue === 0) return -1;
        if (a.wonValue === 0 && b.wonValue > 0) return 1;
        // Then by won value, then by total value
        if (a.wonValue !== b.wonValue) return b.wonValue - a.wonValue;
        return b.value - a.value;
      });

    return {
      total: dedupedAppointments.length,
      uniqueContacts: processedContacts.size,
      totalValue,
      totalWonValue,
      bySource: Object.entries(bySource).sort((a, b) => b[1].value - a[1].value),
      byStatus: sortedByStatus,
      byOppStatus: sortedByOppStatus,
      wonBySource: Object.entries(wonBySource).sort((a, b) => b[1].value - a[1].value),
      byRep: sortedByRep,
    };
  }, [dedupedAppointments, contacts, opportunities, users]);

  // Sort appointments based on selected column and direction
  const sortedAppointments = useMemo(() => {
    return [...dedupedAppointments].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'contact':
          comparison = getContactName(a.contact_id, a.contact_uuid).localeCompare(getContactName(b.contact_id, b.contact_uuid));
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
          comparison = getContactSource(a.contact_id, a.contact_uuid).localeCompare(getContactSource(b.contact_id, b.contact_uuid));
          break;
        case 'oppStatus':
          comparison = getOpportunityStatus(a.contact_id, a.contact_uuid).localeCompare(getOpportunityStatus(b.contact_id, b.contact_uuid));
          break;
        case 'stage':
          comparison = getOpportunityStage(a.contact_id, a.contact_uuid).localeCompare(getOpportunityStage(b.contact_id, b.contact_uuid));
          break;
        case 'oppValue':
          const valA = getOpportunityValue(a.contact_id, a.contact_uuid) || 0;
          const valB = getOpportunityValue(b.contact_id, b.contact_uuid) || 0;
          comparison = valA - valB;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [dedupedAppointments, sortColumn, sortDirection, contacts, users, opportunities]);

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
    setStoredDateRange(range?.from, range?.to);
    setCurrentPage(1);
  };

  const handleRowClick = (appointment: Appointment) => {
    // Open in a new tab using the full-page route
    const id = appointment.id || appointment.ghl_id;
    const title = appointment.title || 'Appointment';
    openTab(`/appointment/${id}`, title);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column, 'asc');
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
                onClick={() => clearFilters()}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Summary Stats */}
          {dedupedAppointments.length > 0 && (
            <Collapsible className="border-t border-border/30 mt-2 pt-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 w-full justify-start">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                  <span>Summary Stats</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {formatCurrency(summaryStats.totalValue)}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-4 pt-2 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Total Value:</span>
                    <Badge variant="default" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {formatCurrency(summaryStats.totalValue)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Total Won:</span>
                    <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/30">
                      {formatCurrency(summaryStats.totalWonValue)}
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
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ${sourceFilter.length === 1 && sourceFilter[0] === source && oppStatusFilter.length === 1 && oppStatusFilter[0] === 'won' ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => {
                            setSourceFilter([source]);
                            setOppStatusFilter(['won']);
                            setCurrentPage(1);
                          }}
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
                          variant="outline" 
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity bg-background ${sourceFilter.length === 1 && sourceFilter[0] === source ? 'ring-2 ring-primary' : ''}`}
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
                              variant="outline" 
                              className={`text-xs cursor-pointer hover:opacity-80 transition-opacity bg-background ${sourceFilter.length === 1 && sourceFilter[0] === source ? 'ring-2 ring-primary' : ''}`}
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
                        {rep.name}: {rep.count} ({formatCurrency(rep.value)}
                        {rep.wonValue > 0 && (
                          <span className="text-emerald-400 ml-1">/ {formatCurrency(rep.wonValue)} won</span>
                        )})
                      </Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardHeader>
        <CardContent>
          <Table className="table-fixed w-full">
             <TableHeader>
               <TableRow className="border-border/50 hover:bg-transparent">
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[28%]"
                   onClick={() => handleSort('contact')}
                 >
                   <div className="flex items-center">
                     Contact Info
                     <SortIcon column="contact" />
                   </div>
                 </TableHead>
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[18%] whitespace-nowrap"
                   onClick={() => handleSort('start')}
                 >
                   <div className="flex items-center">
                     Date / Status
                     <SortIcon column="start" />
                   </div>
                 </TableHead>
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[10%]"
                   onClick={() => handleSort('rep')}
                 >
                   <div className="flex items-center">
                     Rep
                     <SortIcon column="rep" />
                   </div>
                 </TableHead>
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[11%]"
                   onClick={() => handleSort('source')}
                 >
                   <div className="flex items-center">
                     Source
                     <SortIcon column="source" />
                   </div>
                 </TableHead>
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[16%]"
                   onClick={() => handleSort('oppStatus')}
                 >
                   <div className="flex items-center">
                     Opp / Stage
                     <SortIcon column="oppStatus" />
                   </div>
                 </TableHead>
                 <TableHead 
                   className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[10%]"
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                            {getContactName(appt.contact_id, appt.contact_uuid)}
                          </span>
                          {isUpcoming(appt.start_time) && (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1 py-0">
                              Soon
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {getAddress(appt)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {getContactPhone(appt.contact_id, appt.contact_uuid)}
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate italic">
                          {appt.title || 'Untitled'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm whitespace-nowrap">{formatDateTime(appt.start_time)}</span>
                        <div className="flex items-center gap-1">
                          <BadgePill intent={
                            appt.appointment_status?.toLowerCase() === 'confirmed' || appt.appointment_status?.toLowerCase() === 'showed' ? 'success' :
                            appt.appointment_status?.toLowerCase() === 'cancelled' || appt.appointment_status?.toLowerCase() === 'no_show' ? 'danger' : 'warning'
                          }>
                            {appt.appointment_status || 'Unknown'}
                          </BadgePill>
                          {appt.salesperson_confirmed && (
                            <span title="Salesperson Confirmed" className="text-emerald-500">
                              <PhoneCall className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getUserName(appt.assigned_user_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate py-2">
                      {getContactSource(appt.contact_id)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-col gap-0.5">
                        {getOpportunityStatus(appt.contact_id, appt.contact_uuid) !== '-' ? (
                          <BadgePill intent={statusToIntent(getOpportunityStatus(appt.contact_id, appt.contact_uuid))}>
                            {getOpportunityStatus(appt.contact_id, appt.contact_uuid)}
                          </BadgePill>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {getOpportunityStage(appt.contact_id, appt.contact_uuid)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-2">
                      {formatCurrency(getOpportunityValue(appt.contact_id, appt.contact_uuid))}
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
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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