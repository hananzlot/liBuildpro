import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Clock, User, Search, Loader2, Phone, List, CalendarDays, Plus, MapPin, Grid3X3 } from "lucide-react";
import { format, isToday, isTomorrow, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { AppointmentDetailSheet } from "@/components/dashboard/AppointmentDetailSheet";
import { OpportunityDetailSheet } from "@/components/dashboard/OpportunityDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { findContactByIdOrGhlId } from "@/lib/utils";
import { ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useGHLMetrics } from "@/hooks/useGHLContacts";
import { AppLayout } from "@/components/layout/AppLayout";
import { CalendarAppointmentActions } from "@/components/calendar/CalendarAppointmentActions";

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

// Get initials from a name (e.g., "John Smith" -> "JS")
function getRepInitials(name: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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
  onCreateAppointment: (date: Date) => void;
  capitalizeWords: (str: string) => string;
  getStatusColor: (status: string | null) => string;
  normalizeStatus: (status: string | null) => string;
  isRescheduling: boolean;
  onGoToToday: () => void;
}

function CalendarView({
  appointments,
  contacts,
  userMap,
  currentMonth,
  onMonthChange,
  onAppointmentClick,
  onReschedule,
  onCreateAppointment,
  capitalizeWords,
  getStatusColor,
  normalizeStatus,
  isRescheduling,
  onGoToToday,
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
    e.dataTransfer.setData("text/plain", appt.id);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-lg border">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onGoToToday}
            className="text-xs"
          >
            Today
          </Button>
        </div>
        <div className="text-center">
          <span className="font-semibold text-lg">{format(currentMonth, "MMMM yyyy")}</span>
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
                  className={`min-h-[120px] border-r border-b p-1.5 cursor-pointer transition-all duration-150 ${
                    !isCurrentMonth ? "bg-muted/20" : ""
                  } ${isDayToday ? "bg-primary/5" : ""} ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""} ${
                    isDragOver ? "bg-primary/20 ring-2 ring-primary ring-dashed scale-[1.02]" : ""
                  } hover:bg-muted/40`}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isDayToday ? "text-primary" : !isCurrentMonth ? "text-muted-foreground" : ""
                  }`}>
                    {format(day, "d")}
                    {dayAppointments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.id || appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`text-[11px] px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing truncate transition-opacity ${getStatusColor(appt.appointment_status)} ${draggedAppt?.id === appt.id ? "opacity-50" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggedAppt) onAppointmentClick(appt);
                        }}
                        title={`${format(new Date(appt.start_time!), "h:mm a")} - ${capitalizeWords(getContactName(appt))} (${userMap.get(appt.assigned_user_id || "") || "Unassigned"}) - Drag to reschedule`}
                      >
                        <div className="flex items-center gap-1">
                          <CalendarAppointmentActions
                            appointment={appt}
                            compact
                          />
                          {appt.assigned_user_id && userMap.get(appt.assigned_user_id) && (
                            <span className="shrink-0 w-4 h-4 rounded bg-secondary text-secondary-foreground text-[8px] font-bold flex items-center justify-center">
                              {getRepInitials(userMap.get(appt.assigned_user_id) || "")}
                            </span>
                          )}
                          <span className="truncate">
                            <span className="font-medium">{format(new Date(appt.start_time!), "h:mm")}</span>
                            {" "}
                            {capitalizeWords(getContactName(appt)).split(" ")[0]}
                          </span>
                        </div>
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
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onCreateAppointment(selectedDate)}
                  className="h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  ✕
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-3">No appointments</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onCreateAppointment(selectedDate)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Appointment
                    </Button>
                  </div>
                ) : (
                  selectedDateAppointments.map((appt) => {
                    const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
                    const repName = userMap.get(appt.assigned_user_id || "") || "Unassigned";
                    return (
                      <div
                        key={appt.id || appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-all ${
                          draggedAppt?.id === appt.id ? "opacity-50" : ""
                        }`}
                        onClick={() => !draggedAppt && onAppointmentClick(appt)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CalendarAppointmentActions appointment={appt} />
                            {appt.assigned_user_id && repName !== "Unassigned" && (
                              <span className="shrink-0 w-6 h-6 rounded bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                                {getRepInitials(repName)}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {capitalizeWords(getContactName(appt))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(appt.start_time!), "h:mm a")}
                              </p>
                            </div>
                          </div>
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
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}:00`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelReschedule}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReschedule} disabled={isRescheduling}>
              {isRescheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Confirm Reschedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Week View Component
interface WeekViewProps {
  appointments: DBAppointment[];
  contacts: DBContact[];
  userMap: Map<string, string>;
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onAppointmentClick: (appt: DBAppointment) => void;
  onReschedule: (appt: DBAppointment, newDate: Date, newTime: string) => Promise<void>;
  onCreateAppointment: (date: Date) => void;
  capitalizeWords: (str: string) => string;
  getStatusColor: (status: string | null) => string;
  normalizeStatus: (status: string | null) => string;
  isRescheduling: boolean;
  onGoToToday: () => void;
}

function WeekView({
  appointments,
  contacts,
  userMap,
  currentWeek,
  onWeekChange,
  onAppointmentClick,
  onReschedule,
  onCreateAppointment,
  capitalizeWords,
  getStatusColor,
  normalizeStatus,
  isRescheduling,
  onGoToToday,
}: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedAppt, setDraggedAppt] = useState<DBAppointment | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{ appt: DBAppointment; targetDate: Date } | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  
  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
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
    e.dataTransfer.setData("text/plain", appt.id);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-lg border">
      {/* Week Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onGoToToday}
            className="text-xs"
          >
            Today
          </Button>
        </div>
        <div className="text-center">
          <span className="font-semibold text-lg">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
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
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
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
        {/* Week Grid */}
        <div className={`flex-1 overflow-auto ${selectedDate ? 'w-1/2' : 'w-full'}`}>
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
            {days.map((day) => {
              const isDayToday = isToday(day);
              return (
                <div 
                  key={format(day, "yyyy-MM-dd")} 
                  className={`p-2 text-center border-r last:border-r-0 ${isDayToday ? "bg-primary/5" : ""}`}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-lg font-semibold ${isDayToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Week Days */}
          <div className="grid grid-cols-7 flex-1">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayAppointments = appointmentsByDate.get(dateKey) || [];
              const isDayToday = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isDragOver = dragOverDate === dateKey;
              
              return (
                <div
                  key={dateKey}
                  className={`min-h-[300px] border-r border-b p-1.5 cursor-pointer transition-all duration-150 ${
                    isDayToday ? "bg-primary/5" : ""
                  } ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""} ${
                    isDragOver ? "bg-primary/20 ring-2 ring-primary ring-dashed scale-[1.02]" : ""
                  } hover:bg-muted/40`}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {dayAppointments.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayAppointments.map((appt) => (
                      <div
                        key={appt.id || appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`text-xs px-2 py-1.5 rounded cursor-grab active:cursor-grabbing transition-opacity ${getStatusColor(appt.appointment_status)} ${draggedAppt?.id === appt.id ? "opacity-50" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggedAppt) onAppointmentClick(appt);
                        }}
                        title={`${format(new Date(appt.start_time!), "h:mm a")} - ${capitalizeWords(getContactName(appt))} (${userMap.get(appt.assigned_user_id || "") || "Unassigned"}) - Drag to reschedule`}
                      >
                        <div className="flex items-center gap-1.5">
                          <CalendarAppointmentActions appointment={appt} />
                          {appt.assigned_user_id && userMap.get(appt.assigned_user_id) && (
                            <span className="shrink-0 w-5 h-5 rounded bg-secondary text-secondary-foreground text-[9px] font-bold flex items-center justify-center">
                              {getRepInitials(userMap.get(appt.assigned_user_id) || "")}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{format(new Date(appt.start_time!), "h:mm a")}</div>
                            <div className="truncate">{capitalizeWords(getContactName(appt))}</div>
                          </div>
                        </div>
                      </div>
                    ))}
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
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onCreateAppointment(selectedDate)}
                  className="h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  ✕
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-3">No appointments</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onCreateAppointment(selectedDate)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Appointment
                    </Button>
                  </div>
                ) : (
                  selectedDateAppointments.map((appt) => {
                    const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
                    const repName = userMap.get(appt.assigned_user_id || "") || "Unassigned";
                    return (
                      <div
                        key={appt.id || appt.ghl_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-all ${
                          draggedAppt?.id === appt.id ? "opacity-50" : ""
                        }`}
                        onClick={() => !draggedAppt && onAppointmentClick(appt)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CalendarAppointmentActions appointment={appt} />
                            {appt.assigned_user_id && repName !== "Unassigned" && (
                              <span className="shrink-0 w-6 h-6 rounded bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                                {getRepInitials(repName)}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {capitalizeWords(getContactName(appt))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(appt.start_time!), "h:mm a")}
                              </p>
                            </div>
                          </div>
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
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}:00`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelReschedule}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReschedule} disabled={isRescheduling}>
              {isRescheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Confirm Reschedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main Calendar Page Component
const Calendar = () => {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState("");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<DBAppointment | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<DBOpportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "month" | "list">("week");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Navigate to today
  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setCurrentWeek(today);
  };

  // New appointment dialog state
  const [newApptDialogOpen, setNewApptDialogOpen] = useState(false);
  const [newApptDate, setNewApptDate] = useState<Date | null>(null);
  const [newApptTime, setNewApptTime] = useState("09:00");
  const [newApptTitle, setNewApptTitle] = useState("");
  const [newApptContactName, setNewApptContactName] = useState("");
  const [newApptPhone, setNewApptPhone] = useState("");
  const [newApptAddress, setNewApptAddress] = useState("");
  const [newApptNotes, setNewApptNotes] = useState("");
  const [newApptAssignedTo, setNewApptAssignedTo] = useState<string>("");
  const [isCreatingAppt, setIsCreatingAppt] = useState(false);

  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useGHLMetrics(undefined);

  const appointments = metrics?.allAppointments || [];
  const contacts = metrics?.allContacts || [];
  const opportunities = metrics?.allOpportunities || [];
  const users = metrics?.users || [];

  // Auto-refresh every 2 minutes when on this screen
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(intervalId);
  }, [refetch]);

  // Keep selectedAppointment in sync with the latest data from appointments array
  useEffect(() => {
    if (selectedAppointment && appointments.length > 0) {
      const updatedAppointment = appointments.find(
        (a: DBAppointment) => a.id === selectedAppointment.id
      );
      if (updatedAppointment && JSON.stringify(updatedAppointment) !== JSON.stringify(selectedAppointment)) {
        setSelectedAppointment(updatedAppointment);
      }
    }
  }, [appointments, selectedAppointment]);

  // Helper to capitalize words properly
  const capitalizeWords = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Build user map
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u: DBUser) => {
      const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
      map.set(u.ghl_id, displayName);
    });
    return map;
  }, [users]);

  const nextWeekEnd = addDays(new Date(), 7);

  // All appointments with start_time for calendar view (including past)
  const allAppointmentsForCalendar = useMemo(() => {
    return appointments
      .filter((a: DBAppointment) => !!a.start_time)
      .sort((a: DBAppointment, b: DBAppointment) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  }, [appointments]);

  // Get available reps from all appointments
  const availableReps = useMemo(() => {
    const reps = new Map<string, string>();
    allAppointmentsForCalendar.forEach((a: DBAppointment) => {
      if (a.assigned_user_id && !reps.has(a.assigned_user_id)) {
        reps.set(a.assigned_user_id, userMap.get(a.assigned_user_id) || a.assigned_user_id);
      }
    });
    return Array.from(reps.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAppointmentsForCalendar, userMap]);

  // Get reps that have appointments in the current week (for week view legend filtering)
  const weekReps = useMemo(() => {
    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(currentWeek);
    const reps = new Map<string, string>();
    allAppointmentsForCalendar.forEach((a: DBAppointment) => {
      if (!a.start_time || !a.assigned_user_id) return;
      const apptDate = new Date(a.start_time);
      if (apptDate >= weekStart && apptDate <= weekEnd) {
        if (!reps.has(a.assigned_user_id)) {
          reps.set(a.assigned_user_id, userMap.get(a.assigned_user_id) || a.assigned_user_id);
        }
      }
    });
    return Array.from(reps.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAppointmentsForCalendar, userMap, currentWeek]);

  // Filtered appointments for calendar view
  const filteredCalendarAppointments = useMemo(() => {
    let result = allAppointmentsForCalendar;

    // Filter by rep
    if (repFilter !== "all") {
      result = result.filter((a: DBAppointment) => a.assigned_user_id === repFilter);
    }

    // Filter by search
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      result = result.filter((a: DBAppointment) => {
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return a.title?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }

    return result;
  }, [allAppointmentsForCalendar, repFilter, searchFilter, contacts]);

  // Filtered appointments for list view (today + upcoming only)
  const todayAndUpcomingAppointments = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return appointments
      .filter((a: DBAppointment) => {
        if (!a.start_time) return false;
        return new Date(a.start_time) >= startOfToday;
      })
      .sort((a: DBAppointment, b: DBAppointment) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  }, [appointments]);

  const filteredListAppointments = useMemo(() => {
    let result = todayAndUpcomingAppointments;

    // Filter by rep
    if (repFilter !== "all") {
      result = result.filter((a: DBAppointment) => a.assigned_user_id === repFilter);
    }

    // Filter by search
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      result = result.filter((a: DBAppointment) => {
        const contact = findContactByIdOrGhlId(contacts, a.contact_uuid, a.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return a.title?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }

    return result;
  }, [todayAndUpcomingAppointments, repFilter, searchFilter, contacts]);

  // Group by time period for list view
  const groupedAppointments = useMemo(() => {
    const groups: { label: string; appointments: DBAppointment[] }[] = [
      { label: "Today", appointments: [] },
      { label: "Tomorrow", appointments: [] },
      { label: "This Week", appointments: [] },
      { label: "Later", appointments: [] },
    ];

    filteredListAppointments.forEach((a: DBAppointment) => {
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
  }, [filteredListAppointments, nextWeekEnd]);

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      case "cancelled":
        return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "no_show":
      case "noshow":
        return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      case "showed":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
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
          company_id: companyId,
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
          company_id: companyId,
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

  // Handle opening new appointment dialog
  const handleOpenNewAppointment = (date: Date) => {
    setNewApptDate(date);
    setNewApptTime("09:00");
    setNewApptTitle("");
    setNewApptContactName("");
    setNewApptPhone("");
    setNewApptAddress("");
    setNewApptNotes("");
    setNewApptAssignedTo("");
    setNewApptDialogOpen(true);
  };

  // Handle creating new appointment
  const handleCreateAppointment = async () => {
    if (!newApptDate || !newApptContactName.trim()) {
      toast.error("Please enter a contact name");
      return;
    }

    setIsCreatingAppt(true);
    try {
      // Parse time and create start/end dates
      const [hours, minutes] = newApptTime.split(":").map(Number);
      const startTime = new Date(newApptDate);
      startTime.setHours(hours, minutes, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const title = newApptTitle.trim() || `Appointment - ${newApptContactName.trim()}`;

      // Get the primary location ID from company integrations
      const { data: integrations } = await supabase
        .from("company_integrations")
        .select("location_id")
        .eq("company_id", companyId)
        .eq("is_primary", true)
        .limit(1);

      const locationId = integrations?.[0]?.location_id || "default";

      // Create contact and appointment via edge function
      const { data, error: createError } = await supabase.functions.invoke("create-ghl-entry", {
        body: {
          firstName: newApptContactName.trim().split(" ")[0] || newApptContactName.trim(),
          lastName: newApptContactName.trim().split(" ").slice(1).join(" ") || "",
          phone: newApptPhone.trim() || null,
          address: newApptAddress.trim() || null,
          notes: newApptNotes.trim() || null,
          appointmentDateTime: startTime.toISOString(),
          assignedTo: newApptAssignedTo || null,
          enteredBy: user?.id || null,
          skipGHLAppointmentSync: true,
          locationId,
          companyId,
        },
      });

      if (createError) throw createError;

      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`Appointment created for ${format(startTime, "MMM d 'at' h:mm a")}`);
      setNewApptDialogOpen(false);
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Failed to create appointment");
    } finally {
      setIsCreatingAppt(false);
    }
  };

  const todayCount = todayAndUpcomingAppointments.filter((a: DBAppointment) => isToday(new Date(a.start_time!))).length;
  const upcomingCount = todayAndUpcomingAppointments.filter((a: DBAppointment) => !isToday(new Date(a.start_time!))).length;

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Failed to load calendar data</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
              <p className="text-sm text-muted-foreground">
                {todayCount} today • {upcomingCount} upcoming
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-2"
                onClick={() => setViewMode("week")}
                title="Week view"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-2"
                onClick={() => setViewMode("month")}
                title="Month view"
              >
                <Grid3X3 className="h-4 w-4" />
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
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search appointments..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Legends Row */}
        <div className="mb-4 flex items-center gap-6 flex-wrap">
          {/* Status Legend */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-emerald-500/20">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Confirmed</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-blue-500/20">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-blue-600 dark:text-blue-400">Showed</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-amber-500/20">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">No Show</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-red-500/20">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-red-600 dark:text-red-400">Cancelled</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-muted">
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
                <span className="text-muted-foreground">New/Other</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-amber-500/30">
                <div className="w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">!</div>
                <span className="text-amber-600 dark:text-amber-400">Rep Not Confirmed</span>
              </div>
            </div>
          </div>

          {/* Sales Rep Legend */}
          {(viewMode === "week" ? weekReps : availableReps).length > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">Sales Reps:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {(viewMode === "week" ? weekReps : availableReps).map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => setRepFilter(repFilter === rep.id ? "all" : rep.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                        repFilter === rep.id 
                          ? "bg-primary/10 ring-1 ring-primary" 
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 rounded bg-secondary text-secondary-foreground text-[9px] font-bold flex items-center justify-center">
                        {getRepInitials(rep.name)}
                      </span>
                      <span className="text-foreground">{rep.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <Skeleton className="flex-1 rounded-lg" />
        ) : viewMode === "week" ? (
          <WeekView
            appointments={filteredCalendarAppointments}
            contacts={contacts}
            userMap={userMap}
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
            onAppointmentClick={handleAppointmentClick}
            onReschedule={handleReschedule}
            onCreateAppointment={handleOpenNewAppointment}
            capitalizeWords={capitalizeWords}
            getStatusColor={getStatusColor}
            normalizeStatus={normalizeStatus}
            isRescheduling={isRescheduling}
            onGoToToday={handleGoToToday}
          />
        ) : viewMode === "month" ? (
          <CalendarView
            appointments={filteredCalendarAppointments}
            contacts={contacts}
            userMap={userMap}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onAppointmentClick={handleAppointmentClick}
            onReschedule={handleReschedule}
            onCreateAppointment={handleOpenNewAppointment}
            capitalizeWords={capitalizeWords}
            getStatusColor={getStatusColor}
            normalizeStatus={normalizeStatus}
            isRescheduling={isRescheduling}
            onGoToToday={handleGoToToday}
          />
        ) : (
          /* List View */
          <div className="flex-1 overflow-auto bg-card rounded-lg border">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {groupedAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No upcoming appointments found
                  </div>
                ) : (
                  groupedAppointments.map((group) => (
                    <div key={group.label}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        {group.label}
                        <Badge variant="secondary" className="h-5 px-1.5">
                          {group.appointments.length}
                        </Badge>
                      </h3>
                      <div className="space-y-2">
                        {group.appointments.map((appt) => {
                          const contact = findContactByIdOrGhlId(contacts, appt.contact_uuid, appt.contact_id);
                          const contactName = contact?.contact_name || 
                            `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || 
                            "Unknown";
                          const repName = userMap.get(appt.assigned_user_id || "") || "Unassigned";
                          
                          return (
                            <div
                              key={appt.id || appt.ghl_id}
                              onClick={() => handleAppointmentClick(appt)}
                              className="p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <CalendarAppointmentActions appointment={appt} />
                                  {appt.assigned_user_id && repName !== "Unassigned" && (
                                    <span className="shrink-0 w-6 h-6 rounded bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                                      {getRepInitials(repName)}
                                    </span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {capitalizeWords(contactName)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(appt.start_time!), "h:mm a")} • {format(new Date(appt.start_time!), "EEEE, MMM d")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>{repName}</span>
                                </div>
                                {contact?.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{contact.phone}</span>
                                  </div>
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
          </div>
        )}
      </div>

      {/* Appointment Detail Sheet */}
      <AppointmentDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        appointment={selectedAppointment}
        contacts={contacts}
        users={users}
        opportunities={opportunities}
        appointments={appointments}
        onRefresh={() => refetch()}
        onOpenOpportunity={(opp) => {
          setSelectedOpportunity(opp as DBOpportunity);
          setOpportunitySheetOpen(true);
        }}
      />

      {/* Opportunity Detail Sheet */}
      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        open={opportunitySheetOpen}
        onOpenChange={setOpportunitySheetOpen}
      />

      {/* New Appointment Dialog */}
      <Dialog open={newApptDialogOpen} onOpenChange={setNewApptDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              New Appointment
            </DialogTitle>
            <DialogDescription>
              {newApptDate && (
                <>Create an appointment for <span className="font-medium">{format(newApptDate, "EEEE, MMMM d, yyyy")}</span></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact-name">Contact Name *</Label>
              <Input
                id="contact-name"
                placeholder="John Doe"
                value={newApptContactName}
                onChange={(e) => setNewApptContactName(e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newApptPhone}
                onChange={(e) => setNewApptPhone(e.target.value)}
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>Time</Label>
              <Select value={newApptTime} onValueChange={setNewApptTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-popover">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}:00`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To */}
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={newApptAssignedTo} onValueChange={setNewApptAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((u: DBUser) => (
                    <SelectItem key={u.ghl_id} value={u.ghl_id}>
                      {u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  placeholder="123 Main St, City, State"
                  value={newApptAddress}
                  onChange={(e) => setNewApptAddress(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={newApptNotes}
                onChange={(e) => setNewApptNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNewApptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isCreatingAppt || !newApptContactName.trim()}>
              {isCreatingAppt ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
};

export default Calendar;
