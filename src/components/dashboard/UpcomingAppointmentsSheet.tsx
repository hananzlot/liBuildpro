import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Clock, User, Search, ChevronRight, CheckCircle2, PhoneCall, Loader2, MapPin, Phone } from "lucide-react";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getAddressFromContact, extractCustomField, CUSTOM_FIELD_IDS } from "@/lib/utils";

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
  address?: string | null;
  location_id?: string;
  ghl_date_added?: string | null;
  ghl_date_updated?: string | null;
  salesperson_confirmed?: boolean;
  salesperson_confirmed_at?: string | null;
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
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
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
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<DBAppointment | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<DBOpportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);
  const [confirmingApptId, setConfirmingApptId] = useState<string | null>(null);
  const [localConfirmedState, setLocalConfirmedState] = useState<Record<string, boolean>>({});
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [localStatusState, setLocalStatusState] = useState<Record<string, string>>({});

  const APPOINTMENT_STATUSES = ["confirmed", "showed", "no_show", "cancelled"];

  const queryClient = useQueryClient();

  const handleOpenOpportunity = (opportunity: DBOpportunity) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySheetOpen(true);
  };

  const handleToggleConfirmed = async (appt: DBAppointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingApptId(appt.ghl_id);
    const newValue = !(localConfirmedState[appt.ghl_id] ?? appt.salesperson_confirmed);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          salesperson_confirmed: newValue,
          salesperson_confirmed_at: newValue ? new Date().toISOString() : null,
        })
        .eq("ghl_id", appt.ghl_id);

      if (error) throw error;
      setLocalConfirmedState((prev) => ({ ...prev, [appt.ghl_id]: newValue }));
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(newValue ? "Confirmed" : "Unconfirmed");
    } catch (error) {
      console.error("Error updating confirmation:", error);
      toast.error("Failed to update");
    } finally {
      setConfirmingApptId(null);
    }
  };

  const handleUpdateStatus = async (appt: DBAppointment, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingStatusId(appt.ghl_id);
    try {
      // Update in GHL first
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: appt.ghl_id,
          appointment_status: newStatus,
        },
      });

      if (ghlError) throw ghlError;

      // Update in Supabase
      const { error } = await supabase
        .from("appointments")
        .update({ appointment_status: newStatus })
        .eq("ghl_id", appt.ghl_id);

      if (error) throw error;

      setLocalStatusState((prev) => ({ ...prev, [appt.ghl_id]: newStatus }));
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatusId(null);
    }
  };
  // Build user map early for filtering
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
      map.set(u.ghl_id, displayName);
    });
    return map;
  }, [users]);

  const nextWeekEnd = addDays(new Date(), 7);

  // Filter to today and upcoming appointments only (includes past appointments today)
  const todayAndUpcomingAppointments = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return appointments
      .filter((a) => {
        if (!a.start_time) return false;
        return new Date(a.start_time) >= startOfToday;
      })
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  }, [appointments]);

  // Get available reps from today and upcoming appointments
  const availableReps = useMemo(() => {
    const reps = new Map<string, string>();
    todayAndUpcomingAppointments.forEach((a) => {
      if (a.assigned_user_id && !reps.has(a.assigned_user_id)) {
        reps.set(a.assigned_user_id, userMap.get(a.assigned_user_id) || a.assigned_user_id);
      }
    });
    return Array.from(reps.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todayAndUpcomingAppointments, userMap]);

  // Apply search and rep filters
  const filteredAppointments = useMemo(() => {
    let result = todayAndUpcomingAppointments;

    // Filter by rep
    if (repFilter !== "all") {
      result = result.filter((a) => a.assigned_user_id === repFilter);
    }

    // Filter by search
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      result = result.filter((a) => {
        const contact = contacts.find((c) => c.ghl_id === a.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return a.title?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }

    return result;
  }, [todayAndUpcomingAppointments, repFilter, searchFilter, contacts]);

  // Group by time period
  const groupedAppointments = useMemo(() => {
    const groups: { label: string; appointments: DBAppointment[] }[] = [
      { label: "Today", appointments: [] },
      { label: "Tomorrow", appointments: [] },
      { label: "This Week", appointments: [] },
      { label: "Later", appointments: [] },
    ];

    filteredAppointments.forEach((a) => {
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

    return groups.filter((g) => g.appointments.length > 0);
  }, [filteredAppointments, nextWeekEnd]);

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-500/20 text-emerald-400";
      case "cancelled":
      case "no_show":
        return "bg-red-500/20 text-red-400";
      case "showed":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-amber-500/20 text-amber-400";
    }
  };

  const handleAppointmentClick = (appointment: DBAppointment) => {
    setSelectedAppointment(appointment);
    setDetailSheetOpen(true);
  };

  const todayCount = todayAndUpcomingAppointments.filter((a) => isToday(new Date(a.start_time!))).length;
  const upcomingCount = todayAndUpcomingAppointments.filter((a) => !isToday(new Date(a.start_time!))).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl p-0 overflow-hidden flex flex-col max-h-screen">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle>Today & Upcoming Appointments</SheetTitle>
                  <SheetDescription>
                    {todayCount} today • {upcomingCount} upcoming
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Filters */}
            <div className="mt-4 flex items-center gap-2">
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue placeholder="Sales Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {availableReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
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
                        const contact = contacts.find((c) => c.ghl_id === appt.contact_id);
                        const contactName =
                          contact?.contact_name ||
                          `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
                          "Unknown";
                        const address = getAddressFromContact(contact, [appt], appt.contact_id);
                        const phone = contact?.phone || null;
                        const assignedUser = appt.assigned_user_id ? userMap.get(appt.assigned_user_id) : null;
                        const isPast = new Date(appt.start_time!) < new Date();

                        return (
                          <div
                            key={appt.ghl_id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isPast
                                ? "bg-muted/30 border-muted opacity-70 hover:opacity-100"
                                : "bg-card hover:bg-muted/30"
                            }`}
                            onClick={() => handleAppointmentClick(appt)}
                          >
                            {/* Customer name - main line */}
                            <div className="flex items-center gap-2 mb-1">
                              {isPast && <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <User className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span
                                className={`font-medium text-sm truncate flex-1 ${isPast ? "text-muted-foreground" : ""}`}
                              >
                                {contactName}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                            
                            {/* Address */}
                            {address && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address}</span>
                              </div>
                            )}
                            
                            {/* Phone */}
                            {phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-5">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{phone}</span>
                              </div>
                            )}
                            
                            {/* Appointment title */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 ml-5">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">{appt.title || "Untitled"}</span>
                              {assignedUser && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="truncate">{assignedUser}</span>
                                </>
                              )}
                            </div>
                            
                            {/* Badges row - wrap on small screens */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isPast && (
                                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                  Past
                                </Badge>
                              )}
                              {/* Appointment Status Dropdown */}
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger 
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <Badge
                                    variant="outline"
                                    className={`text-xs h-6 px-2 cursor-pointer hover:opacity-80 inline-flex items-center ${getStatusColor(localStatusState[appt.ghl_id] ?? appt.appointment_status)}`}
                                  >
                                    {updatingStatusId === appt.ghl_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : null}
                                    {localStatusState[appt.ghl_id] ?? appt.appointment_status ?? "No Status"}
                                  </Badge>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  align="end" 
                                  side="bottom" 
                                  sideOffset={4} 
                                  className="z-[9999] bg-popover border shadow-lg"
                                  onCloseAutoFocus={(e) => e.preventDefault()}
                                >
                                  {APPOINTMENT_STATUSES.map((status) => (
                                    <DropdownMenuItem
                                      key={status}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateStatus(appt, status, e);
                                      }}
                                      className="capitalize cursor-pointer"
                                    >
                                      {status.replace("_", " ")}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              {/* Rep Confirmed Toggle */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 px-2 text-xs gap-1 border ${
                                  (localConfirmedState[appt.ghl_id] ?? appt.salesperson_confirmed)
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                                }`}
                                onClick={(e) => handleToggleConfirmed(appt, e)}
                                disabled={confirmingApptId === appt.ghl_id}
                              >
                                {confirmingApptId === appt.ghl_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <PhoneCall className="h-3 w-3" />
                                )}
                                {(localConfirmedState[appt.ghl_id] ?? appt.salesperson_confirmed)
                                  ? "Confirmed"
                                  : "Unconfirmed"}
                              </Button>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(appt.start_time!), "MMM d, h:mm a")}
                              </div>
                              {assignedUser && (
                                <span className={`truncate ${isPast ? "text-muted-foreground" : "text-primary"}`}>
                                  {assignedUser}
                                </span>
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
