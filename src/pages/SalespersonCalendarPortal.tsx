import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isToday, isSameDay, parseISO } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Loader2, AlertCircle, User, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

interface Opportunity {
  id: string;
  ghl_id: string | null;
  name: string | null;
  contact_id: string | null;
  scope_of_work: string | null;
  monetary_value: number | null;
  stage_name: string | null;
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

function getStatusDotColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-emerald-500";
    case "showed":
      return "bg-blue-500";
    case "no_show":
    case "noshow":
      return "bg-red-500";
    case "cancelled":
    case "canceled":
      return "bg-gray-400";
    default:
      return "bg-amber-500";
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

function formatTimeShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "h:mma").toLowerCase();
  } catch {
    return "";
  }
}

export default function SalespersonCalendarPortal() {
  const { token } = useParams<{ token: string }>();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

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

  // Fetch opportunities for scope of work
  const { data: opportunities = [] } = useQuery({
    queryKey: ["salesperson-portal-opportunities", salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.company_id) return [];

      const { data, error } = await supabase
        .from("opportunities")
        .select("id, ghl_id, name, contact_id, scope_of_work, monetary_value, stage_name")
        .eq("company_id", salesperson.company_id);

      if (error) throw error;
      return data as Opportunity[];
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

  const opportunityMap = useMemo(() => {
    const map = new Map<string, Opportunity>();
    opportunities.forEach((o) => {
      if (o.contact_id) map.set(o.contact_id, o);
    });
    return map;
  }, [opportunities]);

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
      map.set(dayKey, [...existing, appt].sort((a, b) => {
        if (!a.start_time || !b.start_time) return 0;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      }));
    });
    return map;
  }, [appointments]);

  const handleGoToToday = () => {
    setCurrentWeek(new Date());
  };

  const getAppointmentDetails = (appt: Appointment) => {
    const contact = appt.contact_id ? contactMap.get(appt.contact_id) : null;
    const opportunity = appt.contact_id ? opportunityMap.get(appt.contact_id) : null;
    const displayName = contact?.contact_name || appt.title || "Appointment";
    return { contact, opportunity, displayName };
  };

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

      {/* Loading State */}
      {appointmentsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Week Calendar Grid */}
      {!appointmentsLoading && (
        <div className="max-w-4xl mx-auto p-4">
          <div className="grid grid-cols-1 gap-3">
            {weekDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayAppts = appointmentsByDay.get(dayKey) || [];
              const dayIsPast = day < new Date() && !isToday(day);

              return (
                <div
                  key={dayKey}
                  className={`rounded-lg border ${
                    isToday(day)
                      ? "border-primary bg-primary/5"
                      : dayIsPast
                      ? "border-border/50 bg-muted/30"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Day Header */}
                  <div className={`px-3 py-2 border-b ${isToday(day) ? "border-primary/30" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs uppercase font-medium ${
                          isToday(day) ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {format(day, "EEE")}
                        </span>
                        <span className={`text-lg font-semibold ${
                          isToday(day)
                            ? "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center"
                            : "text-foreground"
                        }`}>
                          {format(day, "d")}
                        </span>
                      </div>
                      {dayAppts.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {dayAppts.length} appointment{dayAppts.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Appointments for this day */}
                  <div className="p-2">
                    {dayAppts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No appointments
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayAppts.map((appt) => {
                          const { displayName } = getAppointmentDetails(appt);
                          return (
                            <button
                              key={appt.id}
                              onClick={() => setSelectedAppointment(appt)}
                              className={`w-full text-left rounded-md p-2 border transition-all hover:shadow-md ${
                                getStatusColor(appt.appointment_status)
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getStatusDotColor(appt.appointment_status)}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-sm truncate">
                                      {displayName}
                                    </span>
                                    <span className="text-xs shrink-0 opacity-75">
                                      {formatTimeShort(appt.start_time)}
                                    </span>
                                  </div>
                                  {appt.address && (
                                    <p className="text-xs opacity-75 truncate mt-0.5">
                                      📍 {appt.address}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Detail Sheet */}
      <Sheet open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
          {selectedAppointment && (
            <AppointmentDetailView
              appointment={selectedAppointment}
              contact={selectedAppointment.contact_id ? contactMap.get(selectedAppointment.contact_id) : null}
              opportunity={selectedAppointment.contact_id ? opportunityMap.get(selectedAppointment.contact_id) : null}
              onClose={() => setSelectedAppointment(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface AppointmentDetailViewProps {
  appointment: Appointment;
  contact: Contact | null | undefined;
  opportunity: Opportunity | null | undefined;
  onClose: () => void;
}

function AppointmentDetailView({ appointment, contact, opportunity, onClose }: AppointmentDetailViewProps) {
  const displayName = contact?.contact_name || appointment.title || "Appointment";

  return (
    <div className="h-full flex flex-col">
      <SheetHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg">{displayName}</SheetTitle>
          <Badge variant="outline" className={getStatusColor(appointment.appointment_status)}>
            {appointment.appointment_status || "New"}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1 py-4">
        <div className="space-y-6">
          {/* Time & Date */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {appointment.start_time ? format(parseISO(appointment.start_time), "EEEE, MMMM d, yyyy") : "No date"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatTime(appointment.start_time)}
                {appointment.end_time && ` - ${formatTime(appointment.end_time)}`}
              </p>
            </div>
          </div>

          {/* Address */}
          {appointment.address && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Location</p>
                <p className="text-sm text-muted-foreground">{appointment.address}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(appointment.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-1 inline-block"
                >
                  Open in Maps →
                </a>
              </div>
            </div>
          )}

          {/* Contact Info */}
          {contact && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Contact</p>
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="text-sm text-primary hover:underline block">
                    📞 {contact.phone}
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-sm text-primary hover:underline block">
                    ✉️ {contact.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Scope of Work from Opportunity */}
          {opportunity?.scope_of_work && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Scope of Work</p>
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {opportunity.scope_of_work}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Appointment Notes */}
          {appointment.notes && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Appointment Notes</p>
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {appointment.notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Opportunity Stage & Value */}
          {opportunity && (opportunity.stage_name || opportunity.monetary_value) && (
            <div className="p-4 bg-muted/30 rounded-lg border">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Opportunity</p>
              <div className="flex items-center gap-3">
                {opportunity.stage_name && (
                  <Badge variant="secondary">{opportunity.stage_name}</Badge>
                )}
                {opportunity.monetary_value != null && opportunity.monetary_value > 0 && (
                  <span className="font-semibold text-emerald-600">
                    ${opportunity.monetary_value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
