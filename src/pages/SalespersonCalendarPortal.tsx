import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isToday, isSameDay, parseISO } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Loader2, AlertCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id: string;
  ghl_id: string | null;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  address: string | null;
  notes: string | null;
  contact_id: string | null;
}

interface Contact {
  id: string;
  ghl_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
}

function getStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-emerald-500/20 text-emerald-600 border-emerald-500/30";
    case "showed":
      return "bg-blue-500/20 text-blue-600 border-blue-500/30";
    case "no_show":
    case "noshow":
      return "bg-red-500/20 text-red-600 border-red-500/30";
    case "cancelled":
    case "canceled":
      return "bg-gray-500/20 text-gray-600 border-gray-500/30";
    default:
      return "bg-amber-500/20 text-amber-600 border-amber-500/30";
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "h:mm a");
  } catch {
    return "";
  }
}

export default function SalespersonCalendarPortal() {
  const { token } = useParams<{ token: string }>();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Validate token and get salesperson info
  const { data: tokenData, isLoading: tokenLoading, error: tokenError } = useQuery({
    queryKey: ["salesperson-portal-token", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase
        .from("salesperson_portal_tokens")
        .select(`
          *,
          salespeople!inner(id, name, phone, email, ghl_user_id, company_id),
          companies!inner(id, name, logo_url, primary_color)
        `)
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Invalid or expired link");

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error("This link has expired");
      }

      // Update access tracking
      await supabase
        .from("salesperson_portal_tokens")
        .update({
          access_count: (data.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", data.id);

      return data;
    },
    enabled: !!token,
  });

  const salesperson = tokenData?.salespeople;
  const company = tokenData?.companies;

  // Fetch appointments for this salesperson
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["salesperson-portal-appointments", salesperson?.ghl_user_id, salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.ghl_user_id || !salesperson?.company_id) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", salesperson.company_id)
        .eq("assigned_user_id", salesperson.ghl_user_id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!salesperson?.ghl_user_id && !!salesperson?.company_id,
  });

  // Fetch contacts for appointment names
  const { data: contacts = [] } = useQuery({
    queryKey: ["salesperson-portal-contacts", salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.company_id) return [];

      const { data, error } = await supabase
        .from("contacts")
        .select("id, ghl_id, contact_name, phone, email")
        .eq("company_id", salesperson.company_id);

      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!salesperson?.company_id,
  });

  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => {
      if (c.ghl_id) map.set(c.ghl_id, c);
    });
    return map;
  }, [contacts]);

  // Calculate week dates
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group appointments by day
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((appt) => {
      if (!appt.start_time) return;
      const dayKey = format(parseISO(appt.start_time), "yyyy-MM-dd");
      const existing = map.get(dayKey) || [];
      map.set(dayKey, [...existing, appt]);
    });
    return map;
  }, [appointments]);

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentWeek(today);
    setSelectedDay(today);
  };

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDay) return [];
    const dayKey = format(selectedDay, "yyyy-MM-dd");
    return appointmentsByDay.get(dayKey) || [];
  }, [selectedDay, appointmentsByDay]);

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              {tokenError instanceof Error ? tokenError.message : "This link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name || "Company"}
                className="h-8 w-8 object-contain rounded"
              />
            ) : (
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">
                {salesperson?.name}'s Calendar
              </h1>
              {company?.name && (
                <p className="text-xs text-muted-foreground truncate">{company.name}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleGoToToday} className="shrink-0">
            Today
          </Button>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="bg-card border-b border-border px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week Grid - Mobile Optimized */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayAppts = appointmentsByDay.get(dayKey) || [];
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`flex flex-col items-center py-3 px-1 border-r last:border-r-0 transition-colors ${
                  isSelected
                    ? "bg-primary/10"
                    : isToday(day)
                    ? "bg-muted/50"
                    : "hover:bg-muted/30"
                }`}
              >
                <span className="text-[10px] uppercase text-muted-foreground">
                  {format(day, "EEE")}
                </span>
                <span
                  className={`text-lg font-medium mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                    isToday(day)
                      ? "bg-primary text-primary-foreground"
                      : isSelected
                      ? "bg-primary/20 text-primary"
                      : "text-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayAppts.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayAppts.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ))}
                    {dayAppts.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">+{dayAppts.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {appointmentsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Selected Day Appointments */}
        {selectedDay && !appointmentsLoading && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              {format(selectedDay, "EEEE, MMMM d")}
              <span className="text-muted-foreground font-normal ml-2">
                ({selectedDayAppointments.length} appointment{selectedDayAppointments.length !== 1 ? "s" : ""})
              </span>
            </h2>

            {selectedDayAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No appointments scheduled</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {selectedDayAppointments
                    .sort((a, b) => {
                      if (!a.start_time || !b.start_time) return 0;
                      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
                    })
                    .map((appt) => {
                      const contact = appt.contact_id ? contactMap.get(appt.contact_id) : null;
                      const displayName = contact?.contact_name || appt.title || "Appointment";

                      return (
                        <Card key={appt.id} className="overflow-hidden">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="font-medium text-sm text-foreground truncate">
                                    {displayName}
                                  </span>
                                </div>
                                {appt.start_time && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>
                                      {formatTime(appt.start_time)}
                                      {appt.end_time && ` - ${formatTime(appt.end_time)}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${getStatusColor(appt.appointment_status)}`}>
                                {appt.appointment_status || "New"}
                              </Badge>
                            </div>

                            {appt.address && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{appt.address}</span>
                              </div>
                            )}

                            {contact?.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                              >
                                📞 {contact.phone}
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* No Day Selected State */}
        {!selectedDay && !appointmentsLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Tap a day to view appointments</p>
          </div>
        )}
      </div>
    </div>
  );
}
