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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, User, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { MultiSelectFilter } from "./MultiSelectFilter";

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
  address?: string | null;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
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

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

type TimeFilter = 'all' | 'past' | 'upcoming' | 'today';
type SortColumn = 'contact' | 'start' | 'status' | 'rep' | 'address';
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
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
    const user = users.find(u => u.ghl_id === userId);
    return user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unknown';
  };

  const getContactName = (contactId: string | null): string => {
    if (!contactId) return 'Unknown';
    const contact = contacts.find(c => c.ghl_id === contactId);
    return contact?.contact_name || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Unknown';
  };

  const getContactPhone = (contactId: string | null): string => {
    if (!contactId) return '-';
    const contact = contacts.find(c => c.ghl_id === contactId);
    return contact?.phone || '-';
  };

  const getAddress = (appointment: Appointment): string => {
    // First try to get address from contact custom_fields
    if (appointment.contact_id) {
      const contact = contacts.find(c => c.ghl_id === appointment.contact_id);
      if (contact?.custom_fields) {
        const customFields = contact.custom_fields as Record<string, unknown>[];
        if (Array.isArray(customFields)) {
          const addressField = customFields.find((f: Record<string, unknown>) => f.id === 'b7oTVsUQrLgZt84bHpCn');
          if (addressField?.value) {
            return addressField.value as string;
          }
        }
      }
    }
    // Fall back to appointment address from GHL calendar
    if (appointment.address) {
      return appointment.address;
    }
    return '-';
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

    // Time filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    if (timeFilter === 'past') {
      filtered = filtered.filter(a => a.start_time && new Date(a.start_time) < now);
    } else if (timeFilter === 'upcoming') {
      filtered = filtered.filter(a => a.start_time && new Date(a.start_time) >= now);
    } else if (timeFilter === 'today') {
      filtered = filtered.filter(a => {
        if (!a.start_time) return false;
        const apptDate = new Date(a.start_time);
        return apptDate >= todayStart && apptDate < todayEnd;
      });
    }

    return filtered;
  }, [appointments, statusFilter, repFilter, timeFilter]);

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
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredAppointments, sortColumn, sortDirection, contacts, users]);

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

  const handleTimeChange = (value: TimeFilter) => {
    setTimeFilter(value);
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
          <div className="flex flex-wrap gap-2">
            <Select value={timeFilter} onValueChange={(v) => handleTimeChange(v as TimeFilter)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>

            <MultiSelectFilter
              options={statusOptions}
              selected={statusFilter}
              onChange={handleStatusChange}
              placeholder="All Status"
              className="w-[130px]"
            />

            <MultiSelectFilter
              options={repOptions}
              selected={repFilter}
              onChange={handleRepChange}
              placeholder="All Reps"
              icon={<User className="h-3 w-3" />}
              className="w-[150px]"
            />

            {(statusFilter.length > 0 || repFilter.length > 0 || timeFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStatusFilter([]);
                  setRepFilter([]);
                  setTimeFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('contact')}
                >
                  <div className="flex items-center">
                    Contact / Appointment
                    <SortIcon column="contact" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('address')}
                >
                  <div className="flex items-center">
                    Address
                    <SortIcon column="address" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('start')}
                >
                  <div className="flex items-center">
                    Start
                    <SortIcon column="start" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('rep')}
                >
                  <div className="flex items-center">
                    Rep
                    <SortIcon column="rep" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {getContactName(appt.contact_id)}
                          </span>
                          {isUpcoming(appt.start_time) && (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                              Upcoming
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {appt.title || 'Untitled'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getContactPhone(appt.contact_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {getAddress(appt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(appt.start_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(appt.appointment_status)}>
                        {appt.appointment_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[100px]">
                      {getUserName(appt.assigned_user_id)}
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