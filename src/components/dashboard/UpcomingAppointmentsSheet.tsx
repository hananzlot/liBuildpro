import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, User, Search, ChevronRight } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, addDays } from "date-fns";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";

interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  calendar_id: string | null;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  assigned_user_id: string | null;
  location_id?: string;
  ghl_date_added?: string | null;
  ghl_date_updated?: string | null;
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
  custom_fields?: unknown;
}

interface DBOpportunity {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
}

interface DBUser {
  id: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface UpcomingAppointmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: DBAppointment[];
  contacts: DBContact[];
  opportunities: DBOpportunity[];
  users: DBUser[];
}

export function UpcomingAppointmentsSheet({
  open,
  onOpenChange,
  appointments,
  contacts,
  opportunities,
  users,
}: UpcomingAppointmentsSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<DBAppointment | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const now = new Date();
  const nextWeekEnd = addDays(now, 7);

  // Filter to upcoming appointments only
  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter(a => {
        if (!a.start_time) return false;
        return new Date(a.start_time) > now;
      })
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  }, [appointments]);

  // Apply search filter
  const filteredAppointments = useMemo(() => {
    if (!searchFilter.trim()) return upcomingAppointments;
    const term = searchFilter.toLowerCase();
    return upcomingAppointments.filter(a => {
      const contact = contacts.find(c => c.ghl_id === a.contact_id);
      const contactName = contact?.contact_name || 
        `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
      return (
        a.title?.toLowerCase().includes(term) ||
        contactName.toLowerCase().includes(term)
      );
    });
  }, [upcomingAppointments, searchFilter, contacts]);

  // Group by time period
  const groupedAppointments = useMemo(() => {
    const groups: { label: string; appointments: DBAppointment[] }[] = [
      { label: "Today", appointments: [] },
      { label: "Tomorrow", appointments: [] },
      { label: "This Week", appointments: [] },
      { label: "Later", appointments: [] },
    ];

    filteredAppointments.forEach(a => {
      const startTime = new Date(a.start_time!);
      if (isToday(startTime)) {
        groups[0].appointments.push(a);
      } else if (isTomorrow(startTime)) {
        groups[1].appointments.push(a);
      } else if (startTime <= nextWeekEnd) {
        groups[2].appointments.push(a);
      } else {
        groups[3].appointments.push(a);
      }
    });

    return groups.filter(g => g.appointments.length > 0);
  }, [filteredAppointments, nextWeekEnd]);

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "confirmed": return "bg-emerald-500/20 text-emerald-400";
      case "cancelled":
      case "no_show": return "bg-red-500/20 text-red-400";
      case "showed": return "bg-blue-500/20 text-blue-400";
      default: return "bg-amber-500/20 text-amber-400";
    }
  };

  const handleAppointmentClick = (appointment: DBAppointment) => {
    setSelectedAppointment(appointment);
    setDetailSheetOpen(true);
  };

  const userMap = new Map<string, string>();
  users.forEach(u => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const nextWeekCount = upcomingAppointments.filter(a => 
    new Date(a.start_time!) <= nextWeekEnd
  ).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle>Upcoming Appointments</SheetTitle>
                  <SheetDescription>
                    {nextWeekCount} next 7 days • {upcomingAppointments.length} total
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Search */}
            <div className="mt-4 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search appointments..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-4 space-y-6">
              {groupedAppointments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {searchFilter ? "No appointments match your search" : "No upcoming appointments"}
                </p>
              ) : (
                groupedAppointments.map((group) => (
                  <div key={group.label}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {group.label} ({group.appointments.length})
                    </h3>
                    <div className="space-y-2">
                      {group.appointments.map((appt) => {
                        const contact = contacts.find(c => c.ghl_id === appt.contact_id);
                        const contactName = contact?.contact_name || 
                          `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "Unknown";
                        const assignedUser = appt.assigned_user_id ? userMap.get(appt.assigned_user_id) : null;

                        return (
                          <div
                            key={appt.ghl_id}
                            className="p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => handleAppointmentClick(appt)}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {appt.title || "Untitled"}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className={`text-xs ${getStatusColor(appt.appointment_status)}`}>
                                  {appt.appointment_status || "Pending"}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">{contactName}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(appt.start_time!), "MMM d, h:mm a")}
                              </div>
                              {assignedUser && (
                                <span className="truncate text-primary">{assignedUser}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        opportunities={opportunities}
        contacts={contacts}
        users={users}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </>
  );
}
