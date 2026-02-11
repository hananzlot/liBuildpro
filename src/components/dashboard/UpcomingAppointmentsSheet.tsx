import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Clock, User, Search, ChevronRight, CheckCircle2, PhoneCall, Loader2, MapPin, Phone, Target, Mail, Copy, List, CalendarDays, FileText, RefreshCw } from "lucide-react";
import { format, isToday, isTomorrow, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getAddressFromContact, extractCustomField, CUSTOM_FIELD_IDS, findContactByIdOrGhlId } from "@/lib/utils";
import { ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { REP_CONFIRMATION_OPTIONS, type RepConfirmationStatus } from "@/components/calendar/CalendarAppointmentActions";

interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
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
  salesperson_confirmation_status?: string | null;
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

// Calendar View Component
interface CalendarViewProps {
  appointments: DBAppointment[];
  contacts: DBContact[];
  userMap: Map<string, string>;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onAppointmentClick: (appt: DBAppointment) => void;
  onReschedule: (appt: DBAppointment, newDate: Date, newTime: string) => Promise<void>;
  capitalizeWords: (str: string) => string;
  getStatusColor: (status: string | null) => string;
  normalizeStatus: (status: string | null) => string;
  isRescheduling: boolean;
}

// Generate time slots for the picker
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 20; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = min.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

function CalendarView({
  appointments,
  contacts,
  userMap,
  currentMonth,
  onMonthChange,
  onAppointmentClick,
  onReschedule,
  capitalizeWords,
  getStatusColor,
  normalizeStatus,
  isRescheduling,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedAppt, setDraggedAppt] = useState<DBAppointment | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{ appt: DBAppointment; targetDate: Date } | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, DBAppointment[]>();
    appointments.forEach((appt) => {
      if (!appt.start_time) return;
      const dateKey = format(new Date(appt.start_time), "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(appt);
    });
    // Sort appointments by time within each day
    map.forEach((appts) => {
      appts.sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
    });
    return map;
  }, [appointments]);

  const getContactName = (appt: DBAppointment) => {
    const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
    return contact?.contact_name || 
      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || 
      "Unknown";
  };

  const selectedDateAppointments = selectedDate 
    ? appointmentsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(day);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, appt: DBAppointment) => {
    e.stopPropagation();
    setDraggedAppt(appt);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", appt.ghl_id);
  };

  const handleDragEnd = () => {
    setDraggedAppt(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(null);
    
    if (!draggedAppt || !draggedAppt.start_time) return;
    
    const originalDate = new Date(draggedAppt.start_time);
    
    // If dropping on the same day, do nothing
    if (isSameDay(originalDate, targetDay)) {
      setDraggedAppt(null);
      return;
    }
    
    // Set default time from original appointment
    const originalTime = format(originalDate, "HH:mm");
    // Find closest time slot
    const closestSlot = TIME_SLOTS.reduce((prev, curr) => {
      return Math.abs(parseInt(curr.replace(":", "")) - parseInt(originalTime.replace(":", ""))) <
        Math.abs(parseInt(prev.replace(":", "")) - parseInt(originalTime.replace(":", "")))
        ? curr
        : prev;
    });
    setSelectedTime(closestSlot);
    
    // Open dialog instead of directly rescheduling
    setPendingReschedule({ appt: draggedAppt, targetDate: targetDay });
    setRescheduleDialogOpen(true);
    setDraggedAppt(null);
  };

  const handleConfirmReschedule = async () => {
    if (!pendingReschedule) return;
    await onReschedule(pendingReschedule.appt, pendingReschedule.targetDate, selectedTime);
    setRescheduleDialogOpen(false);
    setPendingReschedule(null);
  };

  const handleCancelReschedule = () => {
    setRescheduleDialogOpen(false);
    setPendingReschedule(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
          {isRescheduling && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Rescheduling...</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Drag hint */}
      {draggedAppt && (
        <div className="px-4 py-1 bg-primary/10 text-xs text-primary text-center">
          Drag to a new date to reschedule
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Grid */}
        <div className={`flex-1 overflow-auto ${selectedDate ? 'w-1/2' : 'w-full'}`}>
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayAppointments = appointmentsByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isDragOver = dragOverDate === dateKey;
              
              return (
                <div
                  key={dateKey}
                  className={`min-h-[100px] border-r border-b p-1 cursor-pointer transition-all duration-150 ${
                    !isCurrentMonth ? "bg-muted/20" : ""
                  } ${isDayToday ? "bg-primary/5" : ""} ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""} ${
                    isDragOver ? "bg-primary/20 ring-2 ring-primary ring-dashed scale-[1.02]" : ""
                  } hover:bg-muted/40`}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    isDayToday ? "text-primary" : !isCurrentMonth ? "text-muted-foreground" : ""
                  }`}>
                    {format(day, "d")}
                    {dayAppointments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`text-[10px] px-1 py-0.5 rounded cursor-grab active:cursor-grabbing truncate transition-opacity ${getStatusColor(appt.appointment_status)} ${
                          userMap.get(appt.assigned_user_id || "") ? `border-l-2` : ""
                        } ${draggedAppt?.ghl_id === appt.ghl_id ? "opacity-50" : ""}`}
                        style={{
                          borderLeftColor: appt.assigned_user_id ? getRepColor(appt.assigned_user_id) : undefined,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggedAppt) onAppointmentClick(appt);
                        }}
                        title={`${format(new Date(appt.start_time!), "h:mm a")} - ${capitalizeWords(getContactName(appt))} (${userMap.get(appt.assigned_user_id || "") || "Unassigned"}) - Drag to reschedule`}
                      >
                        <span className="font-medium">{format(new Date(appt.start_time!), "h:mm")}</span>
                        {" "}
                        {capitalizeWords(getContactName(appt)).split(" ")[0]}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayAppointments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Panel */}
        {selectedDate && (
          <div className="w-1/2 border-l flex flex-col bg-background">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <h4 className="font-medium">{format(selectedDate, "EEEE, MMM d")}</h4>
                <p className="text-xs text-muted-foreground">{selectedDateAppointments.length} appointment{selectedDateAppointments.length !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                ✕
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {selectedDateAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No appointments</p>
                ) : (
                  selectedDateAppointments.map((appt) => {
                    const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
                    const repName = userMap.get(appt.assigned_user_id || "") || "Unassigned";
                    return (
                      <div
                        key={appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-all ${
                          draggedAppt?.ghl_id === appt.ghl_id ? "opacity-50" : ""
                        }`}
                        onClick={() => !draggedAppt && onAppointmentClick(appt)}
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: appt.assigned_user_id ? getRepColor(appt.assigned_user_id) : "var(--border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {capitalizeWords(getContactName(appt))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(appt.start_time!), "h:mm a")}
                            </p>
                          </div>
                          <Badge className={`${getStatusColor(appt.appointment_status)} text-[10px] shrink-0`}>
                            {normalizeStatus(appt.appointment_status)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{repName}</span>
                        </div>
                        {contact?.phone && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-muted-foreground/60">
                          Drag to another day to reschedule
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Reschedule Time Picker Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription>
              {pendingReschedule && (
                <>
                  Moving <span className="font-medium">{capitalizeWords(getContactName(pendingReschedule.appt))}</span> to{" "}
                  <span className="font-medium">{format(pendingReschedule.targetDate, "EEEE, MMMM d, yyyy")}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original time display */}
            {pendingReschedule?.appt.start_time && (
              <div className="text-sm text-muted-foreground">
                Original time: <span className="font-medium text-foreground">{format(new Date(pendingReschedule.appt.start_time), "h:mm a")}</span>
              </div>
            )}

            {/* Time selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select new time</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_SLOTS.map((slot) => {
                    const [h, m] = slot.split(":");
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? "PM" : "AM";
                    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return (
                      <SelectItem key={slot} value={slot}>
                        {hour12}:{m} {ampm}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Quick time buttons */}
            <div className="flex flex-wrap gap-2">
              {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"].map((time) => {
                const [h, m] = time.split(":");
                const hour = parseInt(h);
                const ampm = hour >= 12 ? "PM" : "AM";
                const hour12 = hour > 12 ? hour - 12 : hour;
                return (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                    className="text-xs"
                  >
                    {hour12}:{m} {ampm}
                  </Button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelReschedule} disabled={isRescheduling}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReschedule} disabled={isRescheduling}>
              {isRescheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Generate consistent colors for sales reps based on their ID
function getRepColor(repId: string): string {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
  ];
  let hash = 0;
  for (let i = 0; i < repId.length; i++) {
    hash = repId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function UpcomingAppointmentsSheet({
  open,
  onOpenChange,
  appointments,
  contacts,
  opportunities,
  users,
}: UpcomingAppointmentsSheetProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const [searchFilter, setSearchFilter] = useState("");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<DBAppointment | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<DBOpportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);
  const [confirmingApptId, setConfirmingApptId] = useState<string | null>(null);
  const [localRepStatusState, setLocalRepStatusState] = useState<Record<string, RepConfirmationStatus>>({});
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [localStatusState, setLocalStatusState] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRescheduling, setIsRescheduling] = useState(false);

  const APPOINTMENT_STATUSES = ["new", "confirmed", "showed", "no_show", "cancelled"];

  // Helper to capitalize words properly
  const capitalizeWords = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const queryClient = useQueryClient();

  // Refresh function to re-fetch appointments data
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
  };

  const handleOpenOpportunity = (opportunity: DBOpportunity) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySheetOpen(true);
  };

  // Helper to get rep confirmation status
  const getRepStatus = (appt: DBAppointment): RepConfirmationStatus => {
    if (localRepStatusState[appt.ghl_id]) return localRepStatusState[appt.ghl_id];
    if (appt.salesperson_confirmation_status) return appt.salesperson_confirmation_status as RepConfirmationStatus;
    return appt.salesperson_confirmed ? "confirmed" : "unconfirmed";
  };

  const handleUpdateRepStatus = async (appt: DBAppointment, newStatus: RepConfirmationStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingApptId(appt.ghl_id);
    const oldValue = getRepStatus(appt);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          salesperson_confirmation_status: newStatus,
          salesperson_confirmed: newStatus === "confirmed", // Keep legacy field in sync
          salesperson_confirmed_at: newStatus !== "unconfirmed" ? new Date().toISOString() : null,
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        })
        .eq("ghl_id", appt.ghl_id);

      if (error) throw error;

      // Record edit in appointment_edits table
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appt.ghl_id,
        contact_ghl_id: appt.contact_id,
        field_name: "salesperson_confirmation_status",
        old_value: oldValue,
        new_value: newStatus,
        edited_by: user?.id || null,
        location_id: appt.location_id,
        company_id: companyId,
      });

      setLocalRepStatusState((prev) => ({ ...prev, [appt.ghl_id]: newStatus }));
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment_edits"] });
      toast.success(`Rep: ${newStatus}`);
    } catch (error) {
      console.error("Error updating rep status:", error);
      toast.error("Failed to update");
    } finally {
      setConfirmingApptId(null);
    }
  };

  const handleUpdateStatus = async (appt: DBAppointment, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingStatusId(appt.ghl_id);
    const oldStatus = localStatusState[appt.ghl_id] ?? appt.appointment_status;
    try {
      // Update appointment (saves to Supabase, syncs to GHL if connected)
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: appt.ghl_id,
          appointment_status: newStatus,
        },
      });

      if (ghlError) throw ghlError;

      // Update in Supabase with edit tracking
      const { error } = await supabase
        .from("appointments")
        .update({ 
          appointment_status: newStatus,
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        })
        .eq("ghl_id", appt.ghl_id);

      if (error) throw error;

      // Record edit in appointment_edits table
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appt.ghl_id,
        contact_ghl_id: appt.contact_id,
        field_name: "appointment_status",
        old_value: oldStatus || null,
        new_value: newStatus,
        edited_by: user?.id || null,
        location_id: appt.location_id,
        company_id: companyId,
      });

      setLocalStatusState((prev) => ({ ...prev, [appt.ghl_id]: newStatus }));
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment_edits"] });
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

  // Filter to today and upcoming appointments only (includes past appointments today) - used for list view
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

  // All appointments with start_time for calendar view (including past)
  const allAppointmentsForCalendar = useMemo(() => {
    return appointments
      .filter((a) => !!a.start_time)
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

  // Filtered appointments for list view (today + upcoming only)
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
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return a.title?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }

    return result;
  }, [todayAndUpcomingAppointments, repFilter, searchFilter, contacts]);

  // Filtered appointments for calendar view (all appointments including past)
  const filteredCalendarAppointments = useMemo(() => {
    let result = allAppointmentsForCalendar;

    // Filter by rep
    if (repFilter !== "all") {
      result = result.filter((a) => a.assigned_user_id === repFilter);
    }

    // Filter by search
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      result = result.filter((a) => {
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return a.title?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }

    return result;
  }, [allAppointmentsForCalendar, repFilter, searchFilter, contacts]);

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
        return "bg-red-500/20 text-red-400";
      case "no_show":
      case "noshow":
        return "bg-amber-500/20 text-amber-400";
      case "showed":
        return "bg-blue-500/20 text-blue-400";
      case "new":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };
  
  // Normalize status for display
  const normalizeStatus = (status: string | null) => {
    if (!status) return "No Status";
    if (status === "noshow") return "No Show";
    if (status === "no_show") return "No Show";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleAppointmentClick = (appointment: DBAppointment) => {
    setSelectedAppointment(appointment);
    setDetailSheetOpen(true);
  };

  // Handle drag-and-drop reschedule
  const handleReschedule = async (appt: DBAppointment, newDate: Date, newTime: string) => {
    if (!appt.start_time) return;
    
    setIsRescheduling(true);
    try {
      const originalDate = new Date(appt.start_time);
      
      // Parse the selected time
      const [hours, minutes] = newTime.split(":").map(Number);
      
      // Set the new date with selected time
      const newStartTime = new Date(newDate);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      // Calculate new end time if we have one
      let newEndTime: Date | null = null;
      if (appt.end_time) {
        const originalEndDate = new Date(appt.end_time);
        const duration = originalEndDate.getTime() - originalDate.getTime();
        newEndTime = new Date(newStartTime.getTime() + duration);
      }
      
      // GHL requires title change for reschedule workaround
      const titleSuffix = appt.title?.endsWith(" -1") ? "" : " -1";
      const newTitle = (appt.title || "Appointment") + titleSuffix;
      
      // Update in GHL first
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: appt.ghl_id,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime?.toISOString(),
          title: newTitle,
        },
      });

      if (ghlError) throw ghlError;

      // Update in Supabase with edit tracking
      const { error } = await supabase
        .from("appointments")
        .update({ 
          start_time: newStartTime.toISOString(),
          end_time: newEndTime?.toISOString(),
          title: newTitle.replace(" -1", ""), // Clean up title suffix
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        })
        .eq("ghl_id", appt.ghl_id);

      if (error) throw error;

      // Record edits in appointment_edits table
      const editsToInsert = [];
      if (appt.start_time !== newStartTime.toISOString()) {
        editsToInsert.push({
          appointment_ghl_id: appt.ghl_id,
          contact_ghl_id: appt.contact_id,
          field_name: "start_time",
          old_value: appt.start_time,
          new_value: newStartTime.toISOString(),
          edited_by: user?.id || null,
          location_id: appt.location_id,
        });
      }
      if (appt.end_time !== newEndTime?.toISOString()) {
        editsToInsert.push({
          appointment_ghl_id: appt.ghl_id,
          contact_ghl_id: appt.contact_id,
          field_name: "end_time",
          old_value: appt.end_time || null,
          new_value: newEndTime?.toISOString() || null,
          edited_by: user?.id || null,
          location_id: appt.location_id,
        });
      }
      if (editsToInsert.length > 0) {
        await supabase.from("appointment_edits").insert(editsToInsert);
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment_edits"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
      toast.success(`Appointment rescheduled to ${format(newStartTime, "MMM d, yyyy 'at' h:mm a")}`);
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      toast.error("Failed to reschedule appointment");
    } finally {
      setIsRescheduling(false);
    }
  };

  const todayCount = todayAndUpcomingAppointments.filter((a) => isToday(new Date(a.start_time!))).length;
  const upcomingCount = todayAndUpcomingAppointments.filter((a) => !isToday(new Date(a.start_time!))).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[90vw] p-0 overflow-hidden flex flex-col max-h-screen">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="h-5 w-5 text-primary" />
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
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === "calendar" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => setViewMode("calendar")}
                  title="Calendar view"
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="h-9 w-32 text-sm">
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

          {viewMode === "calendar" ? (
            <CalendarView
              appointments={filteredCalendarAppointments}
              contacts={contacts}
              userMap={userMap}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onAppointmentClick={handleAppointmentClick}
              onReschedule={handleReschedule}
              capitalizeWords={capitalizeWords}
              getStatusColor={getStatusColor}
              normalizeStatus={normalizeStatus}
              isRescheduling={isRescheduling}
            />
          ) : (
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
                        const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
                        const contactName =
                          contact?.contact_name ||
                          `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
                          "Unknown";
                        // Get address: contact custom_fields, then current appt, then any other appt for this contact
                        const contactAddress = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
                        const otherApptAddress = appt.contact_id 
                          ? appointments.find(a => a.contact_id === appt.contact_id && a.address)?.address 
                          : null;
                        const address = contactAddress || appt.address || otherApptAddress || null;
                        const phone = contact?.phone || null;
                        const source = contact?.source || null;
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
                                {capitalizeWords(contactName)}
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
                            
                            {/* Phone - clickable */}
                            {phone && (
                              <div className="flex items-center gap-1 text-xs mb-1 ml-5">
                                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <a
                                  href={`tel:${phone}`}
                                  className="text-primary hover:underline"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const p = phone.trim();
                                    if (!p) return;
                                    const url = `tel:${p}`;
                                    const win = window.open(url, "_blank", "noopener,noreferrer");
                                    if (!win) window.location.href = url;
                                  }}
                                >
                                  {phone}
                                </a>
                                <button
                                  className="text-muted-foreground hover:text-primary p-0.5"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(phone);
                                    toast.success("Phone copied");
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            {/* Email - clickable */}
                            {contact?.email && (
                              <div className="flex items-center gap-1 text-xs mb-1 ml-5">
                                <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <a
                                  href={`mailto:${contact.email}`}
                                  target="_top"
                                  rel="noreferrer"
                                  className="text-primary hover:underline"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.email}
                                </a>
                                <button
                                  className="text-muted-foreground hover:text-primary p-0.5"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(contact.email!);
                                    toast.success("Email copied");
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <a
                                  href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}&body=${encodeURIComponent(`Dear ${(contact.first_name || '').charAt(0).toUpperCase() + (contact.first_name || '').slice(1).toLowerCase()} ${(contact.last_name || '').charAt(0).toUpperCase() + (contact.last_name || '').slice(1).toLowerCase()},${address ? `\n${address}` : ''}\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary text-[10px] ml-1"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  (Gmail)
                                </a>
                              </div>
                            )}

                            {/* Source */}
                            {source && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-5">
                                <Target className="h-3 w-3 shrink-0" />
                                <span className="capitalize">{source}</span>
                              </div>
                            )}

                            {/* Appointment title */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-5">
                              <CalendarIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate font-semibold">{appt.title || "Untitled"}</span>
                              {assignedUser && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="truncate">{assignedUser}</span>
                                </>
                              )}
                            </div>

                            {/* Scope of Work */}
                            {(() => {
                              const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                              if (scopeOfWork) {
                                return (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 ml-5">
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{scopeOfWork}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
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
                                    {normalizeStatus(localStatusState[appt.ghl_id] ?? appt.appointment_status)}
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
                              {/* Rep Confirmation Status Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 px-2 text-xs gap-1 border ${
                                      getRepStatus(appt) === "confirmed"
                                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                                        : getRepStatus(appt) === "rescheduled"
                                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                                        : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/30"
                                    }`}
                                    disabled={confirmingApptId === appt.ghl_id}
                                  >
                                    {confirmingApptId === appt.ghl_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : getRepStatus(appt) === "confirmed" ? (
                                      <CheckCircle2 className="h-3 w-3" />
                                    ) : getRepStatus(appt) === "rescheduled" ? (
                                      <RefreshCw className="h-3 w-3" />
                                    ) : (
                                      <PhoneCall className="h-3 w-3" />
                                    )}
                                    {REP_CONFIRMATION_OPTIONS.find(o => o.value === getRepStatus(appt))?.label || "Unconfirmed"}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  align="end" 
                                  className="z-[9999] bg-popover border shadow-lg min-w-[140px]"
                                  onCloseAutoFocus={(e) => e.preventDefault()}
                                >
                                  {REP_CONFIRMATION_OPTIONS.map((option) => (
                                    <DropdownMenuItem
                                      key={option.value}
                                      onClick={(e) => handleUpdateRepStatus(appt, option.value, e)}
                                      className={`cursor-pointer gap-2 ${getRepStatus(appt) === option.value ? "bg-muted" : ""}`}
                                    >
                                      <option.icon className="h-3.5 w-3.5" />
                                      {option.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
          )}
        </SheetContent>
      </Sheet>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        opportunities={opportunities}
        contacts={contacts}
        users={users}
        appointments={appointments}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onOpenOpportunity={handleOpenOpportunity}
        onRefresh={handleRefreshData}
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
