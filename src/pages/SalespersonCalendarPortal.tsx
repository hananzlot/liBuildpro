import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, subDays, isToday, isSameDay, parseISO } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Loader2, AlertCircle, User, FileText, Phone, FolderOpen, Mail, ExternalLink, Plus, Home, PenSquare, ClipboardList, Send, Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { PortalProposalsSection } from "@/components/salesperson-portal/PortalProposalsSection";
import { PortalFileUploadSection } from "@/components/salesperson-portal/PortalFileUploadSection";
import { PortalProjectLinksSection } from "@/components/salesperson-portal/PortalProjectLinksSection";
import { PortalEstimateCreator } from "@/components/salesperson-portal/PortalEstimateCreator";
import { PortalContractsSection } from "@/components/salesperson-portal/PortalContractsSection";
import { toast } from "sonner";
import { FileCheck } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"home" | "calendar" | "create" | "projects" | "estimates" | "proposals" | "contracts">("home");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Swipe gesture handling refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Validate token and get salesperson info - cache for faster subsequent loads
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const salesperson = tokenData?.salespeople;
  const company = tokenData?.companies;

  // Set browser tab title to "{FirstName} | {PlatformName}"
  useEffect(() => {
    const originalTitle = document.title;
    const firstName = salesperson?.name?.split(' ')[0];
    if (firstName) {
      document.title = `${firstName} | iBuildPro`;
    }
    return () => { document.title = originalTitle; };
  }, [salesperson?.name]);

  // Fetch appointments for this salesperson - with caching for fast reloads
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["salesperson-portal-appointments", salesperson?.id, salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.id || !salesperson?.company_id) return [];

      console.log('[Portal] Fetching appointments for salesperson:', salesperson.id, 'ghl_user_id:', salesperson.ghl_user_id);

      // Priority: salesperson_id (UUID) first, then fallback to ghl_user_id
      // This ensures salespeople without GHL integration still see their appointments
      let query = supabase
        .from("appointments")
        .select("*")
        .eq("company_id", salesperson.company_id);
      
      // Use OR filter to match by salesperson_id OR assigned_user_id (if they have a GHL ID)
      if (salesperson.ghl_user_id) {
        query = query.or(`salesperson_id.eq.${salesperson.id},assigned_user_id.eq.${salesperson.ghl_user_id}`);
      } else {
        query = query.eq("salesperson_id", salesperson.id);
      }
      
      const { data, error } = await query.order("start_time", { ascending: true });

      console.log('[Portal] Appointments query result:', data?.length || 0, 'appointments, error:', error);

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!salesperson?.id && !!salesperson?.company_id,
    staleTime: 2 * 60 * 1000, // 2 minutes - appointments change more frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch contacts for appointment names - paginated to handle large datasets
  const { data: contacts = [] } = useQuery({
    queryKey: ["salesperson-portal-contacts", salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.company_id) return [];

      return fetchAllPages<Contact>(async (from, to) => {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, ghl_id, contact_name, phone, email")
          .eq("company_id", salesperson.company_id)
          .range(from, to);

        if (error) throw error;
        return data as Contact[];
      });
    },
    enabled: !!salesperson?.company_id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Fetch opportunities for scope of work - paginated to handle large datasets
  const { data: opportunities = [] } = useQuery({
    queryKey: ["salesperson-portal-opportunities", salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.company_id) return [];

      return fetchAllPages<Opportunity>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, ghl_id, name, contact_id, scope_of_work, monetary_value, stage_name")
          .eq("company_id", salesperson.company_id)
          .range(from, to);

        if (error) throw error;
        return data as Opportunity[];
      });
    },
    enabled: !!salesperson?.company_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch record counts for home menu cards
  const { data: portalCounts } = useQuery({
    queryKey: ["salesperson-portal-counts", salesperson?.id, salesperson?.name, salesperson?.company_id],
    queryFn: async () => {
      if (!salesperson?.company_id) return { estimates: 0, proposals: 0, contracts: 0, projects: 0 };
      const orConds: string[] = [];
      if (salesperson.id) orConds.push(`salesperson_id.eq.${salesperson.id}`);
      if (salesperson.name) orConds.push(`salesperson_name.eq.${salesperson.name}`);
      const orStr = orConds.join(",");

      // Draft estimates (not yet sent)
      const { count: estCount } = await supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("company_id", salesperson.company_id)
        .eq("status", "draft")
        .or(orStr);

      // Active proposals (sent/viewed, not expired)
      const { data: proposalData } = await supabase
        .from("estimates")
        .select("id, expiration_date")
        .eq("company_id", salesperson.company_id)
        .in("status", ["sent", "viewed"])
        .or(orStr);
      const now = new Date();
      const activeProposals = (proposalData || []).filter(p => !p.expiration_date || new Date(p.expiration_date) >= now);

      // Signed contracts (accepted)
      const { count: contractCount } = await supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("company_id", salesperson.company_id)
        .eq("status", "accepted")
        .or(orStr);

      // Projects count
      const { count: projCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", salesperson.company_id)
        .is("deleted_at", null)
        .or(`primary_salesperson.eq.${salesperson.name},secondary_salesperson.eq.${salesperson.name},tertiary_salesperson.eq.${salesperson.name},quaternary_salesperson.eq.${salesperson.name}`);

      return {
        estimates: estCount || 0,
        proposals: activeProposals.length,
        contracts: contractCount || 0,
        projects: projCount || 0,
      };
    },
    enabled: !!salesperson?.company_id && !!(salesperson?.id || salesperson?.name),
    staleTime: 60 * 1000,
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
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
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
    setCurrentDate(new Date());
  };

  const handleNavigate = useCallback((direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(prev => direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === "prev" ? subDays(prev, 1) : addDays(prev, 1));
    }
  }, [viewMode]);

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleNavigate("next");
    } else if (isRightSwipe) {
      handleNavigate("prev");
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  }, [handleNavigate]);

  // Get current day's appointments for day view
  const currentDayKey = format(currentDate, "yyyy-MM-dd");
  const currentDayAppointments = appointmentsByDay.get(currentDayKey) || [];

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
            {activeTab !== "home" && (
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveTab("home")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
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
                {salesperson?.name}'s Portal
              </h1>
              {company?.name && (
                <p className="text-xs text-muted-foreground truncate">{company.name}</p>
              )}
            </div>
          </div>
          {activeTab === "calendar" && (
            <Button variant="outline" size="sm" onClick={handleGoToToday} className="shrink-0">
              Today
            </Button>
          )}
        </div>
      </header>

      {/* HOME - Menu Tiles */}
      {activeTab === "home" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-md mx-auto space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Welcome, {salesperson.name}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab("calendar")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Calendar</span>
              </button>
              <button
                onClick={() => setActiveTab("create")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PenSquare className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Quick Create</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Change Order & Upload</span>
              </button>
              <button
                onClick={() => setActiveTab("projects")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Projects</span>
                {(portalCounts?.projects ?? 0) > 0 && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 min-w-[20px] h-5">{portalCounts!.projects}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("estimates")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Estimates</span>
                {(portalCounts?.estimates ?? 0) > 0 && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 min-w-[20px] h-5">{portalCounts!.estimates}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("proposals")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Proposals</span>
                {(portalCounts?.proposals ?? 0) > 0 && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 min-w-[20px] h-5">{portalCounts!.proposals}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("contracts")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-accent transition-colors text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Contracts</span>
                {(portalCounts?.contracts ?? 0) > 0 && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 min-w-[20px] h-5">{portalCounts!.contracts}</Badge>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR TAB */}
      {activeTab === "calendar" && (
        <>
          {/* Calendar Navigation Bar */}
          <div className="bg-card border-b border-border px-4 py-2">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleNavigate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-foreground">
                  {viewMode === "week" 
                    ? `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
                    : format(currentDate, "EEEE, MMMM d, yyyy")
                  }
                </span>
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(value) => value && setViewMode(value as "day" | "week")}
                  size="sm"
                  className="bg-muted rounded-md p-0.5"
                >
                  <ToggleGroupItem value="day" className="text-xs px-3 py-1 data-[state=on]:bg-background">
                    Day
                  </ToggleGroupItem>
                  <ToggleGroupItem value="week" className="text-xs px-3 py-1 data-[state=on]:bg-background">
                    Week
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleNavigate("next")}>
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

          {/* Day View */}
          {!appointmentsLoading && viewMode === "day" && (
            <div 
              className="max-w-2xl mx-auto p-4 touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <Card className={`${isToday(currentDate) ? "border-primary" : ""}`}>
                <CardContent className={appointments.length === 0 ? "pt-3 pb-3" : "pt-4"}>
                  {currentDayAppointments.length === 0 ? (
                    <div className={`text-center ${appointments.length === 0 ? "py-2" : "py-12"}`}>
                      {appointments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No appointments scheduled</p>
                      ) : (
                        <>
                          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-muted-foreground">No appointments today</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentDayAppointments.map((appt) => {
                        const { displayName, contact } = getAppointmentDetails(appt);
                        return (
                          <button
                            key={appt.id}
                            onClick={() => setSelectedAppointment(appt)}
                            className={`w-full text-left rounded-lg p-4 border transition-all hover:shadow-lg ${
                              getStatusColor(appt.appointment_status)
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(appt.appointment_status)}`} />
                                  <span className="font-semibold text-sm">
                                    {formatTime(appt.start_time)}
                                    {appt.end_time && ` - ${formatTime(appt.end_time)}`}
                                  </span>
                                </div>
                                <p className="font-semibold text-base truncate">
                                  {displayName}
                                </p>
                                {contact?.phone && (
                                  <p className="text-sm opacity-75 mt-1 flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5" />
                                    {contact.phone}
                                  </p>
                                )}
                                {appt.address && (
                                  <p className="text-sm opacity-75 mt-1 flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {appt.address}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {appt.appointment_status || "New"}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Week Calendar Grid */}
          {!appointmentsLoading && viewMode === "week" && (
            <div className="max-w-6xl mx-auto p-4">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayAppts = appointmentsByDay.get(dayKey) || [];
                  const dayIsPast = day < new Date() && !isToday(day);
                  return (
                    <div
                      key={`header-${dayKey}`}
                      className={`text-center py-2 rounded-t-lg cursor-pointer transition-colors ${
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : dayIsPast
                          ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                          : "bg-card text-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode("day");
                      }}
                    >
                      <span className="text-xs uppercase font-medium block">
                        {format(day, "EEE")}
                      </span>
                      <span className="text-lg font-semibold">
                        {format(day, "d")}
                      </span>
                      {dayAppts.length > 0 && (
                        <Badge variant={isToday(day) ? "secondary" : "outline"} className="text-[10px] mt-1 px-1.5 py-0">
                          {dayAppts.length}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayAppts = appointmentsByDay.get(dayKey) || [];
                  const dayIsPast = day < new Date() && !isToday(day);
                  return (
                    <div
                      key={dayKey}
                      className={`min-h-[200px] rounded-b-lg border p-1.5 ${
                        isToday(day)
                          ? "border-primary bg-primary/5"
                          : dayIsPast
                          ? "border-border/50 bg-muted/20"
                          : "border-border bg-card"
                      }`}
                    >
                      {dayAppts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">—</p>
                      ) : (
                        <div className="space-y-1">
                          {dayAppts.map((appt) => {
                            const { displayName } = getAppointmentDetails(appt);
                            return (
                              <button
                                key={appt.id}
                                onClick={() => setSelectedAppointment(appt)}
                                className={`w-full text-left rounded p-1.5 border transition-all hover:shadow-md text-xs ${
                                  getStatusColor(appt.appointment_status)
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(appt.appointment_status)}`} />
                                  <span className="font-medium truncate text-[11px]">
                                    {formatTimeShort(appt.start_time)}
                                  </span>
                                </div>
                                <p className="font-medium truncate mt-0.5">
                                  {displayName.split(" ")[0]}
                                </p>
                                {appt.address && (
                                  <p className="opacity-75 truncate text-[10px] mt-0.5">
                                    📍 {appt.address.split(",")[0]}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* QUICK CREATE TAB */}
      {activeTab === "create" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto space-y-3">
            <PortalEstimateCreator
              portalToken={token || ""}
              salespersonId={salesperson.id}
              salespersonName={salesperson.name}
              salespersonGhlUserId={salesperson.ghl_user_id}
              companyId={salesperson.company_id}
            />
            <PortalFileUploadSection 
              salespersonName={salesperson.name}
              salespersonId={salesperson.id}
              salespersonGhlUserId={salesperson.ghl_user_id}
              companyId={salesperson.company_id} 
            />
          </div>
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === "projects" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">
            <PortalProjectLinksSection 
              salespersonName={salesperson.name}
              salespersonId={salesperson.id}
              salespersonGhlUserId={salesperson.ghl_user_id}
              companyId={salesperson.company_id}
            />
          </div>
        </div>
      )}

      {/* ESTIMATES TAB */}
      {activeTab === "estimates" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">
            <PortalEstimateCreator
              portalToken={token || ""}
              salespersonId={salesperson.id}
              salespersonName={salesperson.name}
              salespersonGhlUserId={salesperson.ghl_user_id}
              companyId={salesperson.company_id}
            />
          </div>
        </div>
      )}

      {/* PROPOSALS TAB */}
      {activeTab === "proposals" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">
            <PortalProposalsSection 
              salespersonName={salesperson.name}
              salespersonId={salesperson.id}
              companyId={salesperson.company_id} 
            />
          </div>
        </div>
      )}

      {/* CONTRACTS TAB */}
      {activeTab === "contracts" && salesperson && (
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">
            <PortalContractsSection 
              salespersonName={salesperson.name}
              salespersonId={salesperson.id}
              companyId={salesperson.company_id} 
            />
          </div>
        </div>
      )}

      {/* Appointment Detail Sheet */}
      <Sheet open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl px-0">
          <div className="max-w-2xl mx-auto h-full px-4 sm:px-6">
            {selectedAppointment && salesperson && (
              <AppointmentDetailView
                appointment={selectedAppointment}
                contact={selectedAppointment.contact_id ? contactMap.get(selectedAppointment.contact_id) : null}
                opportunity={selectedAppointment.contact_id ? opportunityMap.get(selectedAppointment.contact_id) : null}
                onClose={() => setSelectedAppointment(null)}
                companyId={salesperson.company_id}
                salespersonId={salesperson.id}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Navigation Bar - Mobile */}
      {salesperson && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
          <div className="max-w-md mx-auto flex items-center justify-around py-1.5">
            {[
              { key: "home" as const, icon: Home, label: "Home" },
              { key: "calendar" as const, icon: Calendar, label: "Calendar" },
              { key: "create" as const, icon: PenSquare, label: "Create" },
              { key: "projects" as const, icon: FolderOpen, label: "Projects" },
              { key: "contracts" as const, icon: FileCheck, label: "Contracts" },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
                  activeTab === key
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

interface AppointmentDetailViewProps {
  appointment: Appointment;
  contact: Contact | null | undefined;
  opportunity: Opportunity | null | undefined;
  onClose: () => void;
  companyId: string;
  salespersonId: string;
}

function AppointmentDetailView({ appointment, contact, opportunity, onClose, companyId, salespersonId }: AppointmentDetailViewProps) {
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);
  const [isSendingThankYou, setIsSendingThankYou] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const displayName = contact?.contact_name || appointment.title || "Appointment";

  // Check if a portal already exists for this opportunity/contact
  const { data: existingPortal, refetch: refetchPortal } = useQuery({
    queryKey: ["salesperson-portal-check", opportunity?.id, contact?.id, companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      // Check for existing project linked to this opportunity
      let projectId: string | null = null;
      
      if (opportunity?.id) {
        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("company_id", companyId)
          .or(`opportunity_uuid.eq.${opportunity.id},opportunity_id.eq.${opportunity.ghl_id}`)
          .is("deleted_at", null)
          .maybeSingle();
        
        if (project) projectId = project.id;
      }
      
      // Fallback: check by contact
      if (!projectId && contact?.id) {
        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("company_id", companyId)
          .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id}`)
          .is("deleted_at", null)
          .maybeSingle();
        
        if (project) projectId = project.id;
      }
      
      if (!projectId) return null;
      
      // Check for active portal token
      const { data: token } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (token?.token) {
        // Get base URL
        const { data: baseUrlSetting } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        
        const baseUrl = baseUrlSetting?.setting_value || window.location.origin;
        return `${baseUrl}/portal/${token.token}`;
      }
      
      return null;
    },
    enabled: !!companyId && !!(opportunity?.id || contact?.id),
  });

  // Set portal link from existing or newly created
  useState(() => {
    if (existingPortal) setPortalLink(existingPortal);
  });

  // Create pre-estimate portal
  const handleCreatePortal = async () => {
    if (!companyId) return;
    setIsCreatingPortal(true);
    try {
      const customerFirstName = contact?.contact_name?.split(" ")[0] || "";
      const customerLastName = contact?.contact_name?.split(" ").slice(1).join(" ") || "";
      const customerEmail = contact?.email || "";
      const customerPhone = contact?.phone || "";
      const projectAddress = appointment.address || "";
      
      // Create project with "Pre-Estimate" status
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          opportunity_id: opportunity?.ghl_id,
          opportunity_uuid: opportunity?.id,
          contact_id: contact?.ghl_id || appointment.contact_id,
          contact_uuid: contact?.id,
          location_id: "salesperson-portal",
          project_name: contact?.contact_name || appointment.title || "New Project",
          project_status: "Pre-Estimate",
          customer_first_name: customerFirstName,
          customer_last_name: customerLastName,
          customer_email: customerEmail,
          cell_phone: customerPhone,
          project_address: projectAddress,
          scope_of_work: opportunity?.scope_of_work,
          company_id: companyId,
        })
        .select("id")
        .single();
      
      if (projectError) throw projectError;
      
      // Create portal token
      const clientFullName = contact?.contact_name || appointment.title || "Customer";
      const { error: tokenError } = await supabase
        .from("client_portal_tokens")
        .insert({
          project_id: newProject.id,
          client_name: clientFullName,
          client_email: customerEmail || null,
          company_id: companyId,
          is_active: true,
        });
      
      if (tokenError) throw tokenError;
      
      // Fetch the new portal link
      const { data: portalToken } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("project_id", newProject.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (portalToken?.token) {
        const { data: baseUrlSetting } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        
        const baseUrl = baseUrlSetting?.setting_value || window.location.origin;
        setPortalLink(`${baseUrl}/portal/${portalToken.token}`);
      }
      
      toast.success("Portal created successfully");
      queryClient.invalidateQueries({ queryKey: ["salesperson-portal-check"] });
    } catch (error) {
      console.error("Error creating portal:", error);
      toast.error("Failed to create portal");
    } finally {
      setIsCreatingPortal(false);
    }
  };

  // Send thank-you email
  const handleSendThankYouEmail = async () => {
    const linkToUse = portalLink || existingPortal;
    if (!companyId || !linkToUse) return;
    
    const customerEmail = contact?.email;
    if (!customerEmail) {
      toast.error("No email address found for this contact");
      return;
    }
    
    setIsSendingThankYou(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-thank-you-email", {
        body: {
          to: customerEmail,
          customerName: contact?.contact_name || appointment.title || "Customer",
          portalLink: linkToUse,
          companyId,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(`Thank-you email sent to ${customerEmail}`);
    } catch (error) {
      console.error("Error sending thank-you email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSendingThankYou(false);
    }
  };

  const activePortalLink = portalLink || existingPortal;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SheetHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="text-base sm:text-lg truncate flex-1">{displayName}</SheetTitle>
          <Badge variant="outline" className={`${getStatusColor(appointment.appointment_status)} text-xs shrink-0`}>
            {appointment.appointment_status || "New"}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1 py-3">
        <div className="space-y-4 pr-2 max-w-full overflow-hidden">
          {/* Portal Actions Section */}
          <div className="space-y-2">
            {activePortalLink ? (
              <>
                <a
                  href={activePortalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">Open Customer Portal</span>
                  </div>
                </a>
                {/* Only show thank-you email button if the rep created the portal (not pre-existing) */}
                {portalLink && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={handleSendThankYouEmail}
                    disabled={isSendingThankYou || !contact?.email}
                    size="sm"
                  >
                    {isSendingThankYou ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">Thank you email after your initial meeting only</span>
                    <span className="text-xs text-muted-foreground shrink-0">(optional)</span>
                    {!contact?.email && (
                      <span className="text-xs text-destructive ml-auto shrink-0">No email</span>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleCreatePortal}
                disabled={isCreatingPortal}
                size="sm"
              >
                {isCreatingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">Create Customer Portal</span>
              </Button>
            )}
          </div>

          {/* Customer Info - Compact mobile layout */}
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base sm:text-lg text-foreground truncate">
                  {contact?.contact_name || appointment.title || "Customer"}
                </p>
                {contact?.phone ? (
                  <a 
                    href={`tel:${contact.phone}`} 
                    className="text-primary font-medium hover:underline flex items-center gap-1 text-sm"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.phone}</span>
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">No phone number</p>
                )}
                {contact?.email && (
                  <a 
                    href={`mailto:${contact.email}`} 
                    className="text-xs text-muted-foreground hover:text-primary hover:underline block truncate"
                  >
                    {contact.email}
                  </a>
                )}
              </div>
            </div>
          </div>


          {/* Time & Date - Compact */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base text-foreground">
                {appointment.start_time ? format(parseISO(appointment.start_time), "EEE, MMM d, yyyy") : "No date"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {formatTime(appointment.start_time)}
                {appointment.end_time && ` - ${formatTime(appointment.end_time)}`}
              </p>
            </div>
          </div>

          {/* Address - Compact */}
          {appointment.address && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-foreground">Location</p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{appointment.address}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(appointment.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-0.5 inline-block"
                >
                  Open in Maps →
                </a>
              </div>
            </div>
          )}

          {/* Scope of Work from Opportunity - Compact */}
          {opportunity?.scope_of_work && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base text-foreground">Scope of Work</p>
                <div className="mt-1.5 p-2 sm:p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {opportunity.scope_of_work}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Appointment Notes - Compact */}
          {appointment.notes && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base text-foreground">Notes</p>
                <div className="mt-1.5 p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {appointment.notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Opportunity Stage & Value - Compact */}
          {opportunity && (opportunity.stage_name || opportunity.monetary_value) && (
            <div className="p-3 bg-muted/30 rounded-lg border">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1.5">Opportunity</p>
              <div className="flex items-center gap-2 flex-wrap">
                {opportunity.stage_name && (
                  <Badge variant="secondary" className="text-xs">{opportunity.stage_name}</Badge>
                )}
                {opportunity.monetary_value != null && opportunity.monetary_value > 0 && (
                  <span className="font-semibold text-sm text-emerald-600">
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
