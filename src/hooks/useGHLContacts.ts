import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardMetrics, LeadsBySource, SalesRepPerformance, GHLContact } from "@/types/ghl";
import type { DateRange } from "react-day-picker";

export type { DateRange };

interface DBContact {
  id: string;
  ghl_id: string;
  location_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  custom_fields: unknown;
  attributions: unknown;
  created_at: string;
  updated_at: string;
}

interface DBOpportunity {
  id: string;
  ghl_id: string;
  location_id: string;
  contact_id: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
}

interface DBAppointment {
  id: string;
  ghl_id: string;
  location_id: string;
  contact_id: string | null;
  calendar_id: string | null;
  title: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  salesperson_confirmed?: boolean;
}

interface DBUser {
  id: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DBConversation {
  id: string;
  ghl_id: string;
  location_id: string;
  contact_id: string | null;
  type: string | null;
  unread_count: number | null;
  inbox_status: string | null;
  last_message_body: string | null;
  last_message_date: string | null;
  last_message_type: string | null;
  last_message_direction: string | null;
}

interface DBTask {
  id: string;
  ghl_id: string;
  contact_id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  completed: boolean;
  assigned_to: string | null;
  location_id: string;
  created_at: string;
  updated_at: string;
  entered_by: string | null;
}

interface DBContactNote {
  id: string;
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
  location_id: string;
  user_id: string | null;
  entered_by: string | null;
}

interface DBCallLog {
  id: string;
  ghl_message_id: string;
  conversation_id: string;
  contact_id: string;
  direction: string | null;
  call_date: string | null;
  user_id: string | null;
  location_id: string;
  created_at: string;
}

interface DBProfile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
}

// Generic paginated fetch for any table
async function fetchAllFromTable(table: string, orderBy: string): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table as "contacts" | "opportunities" | "appointments")
      .select("*")
      .order(orderBy as any, { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    if (data && data.length > 0) {
      allItems.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allItems;
}

async function fetchContactsFromDB(): Promise<DBContact[]> {
  return fetchAllFromTable("contacts", "ghl_date_added") as Promise<DBContact[]>;
}

async function fetchOpportunitiesFromDB(): Promise<DBOpportunity[]> {
  return fetchAllFromTable("opportunities", "ghl_date_added") as Promise<DBOpportunity[]>;
}

async function fetchAppointmentsFromDB(): Promise<DBAppointment[]> {
  return fetchAllFromTable("appointments", "start_time") as Promise<DBAppointment[]>;
}

async function fetchUsersFromDB(): Promise<DBUser[]> {
  const { data, error } = await supabase.from("ghl_users").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchConversationsFromDB(): Promise<DBConversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("last_message_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchTasksFromDB(): Promise<DBTask[]> {
  const { data, error } = await supabase.from("ghl_tasks").select("*").order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchContactNotesFromDB(): Promise<DBContactNote[]> {
  const { data, error } = await supabase
    .from("contact_notes")
    .select("*")
    .order("ghl_date_added", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchCallLogsFromDB(): Promise<DBCallLog[]> {
  const { data, error } = await supabase.from("call_logs").select("*").order("call_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchProfilesFromDB(): Promise<DBProfile[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function syncContacts(): Promise<{ total: number }> {
  const { data, error } = await supabase.functions.invoke("fetch-ghl-contacts", {
    body: { syncToDb: true },
  });

  if (error) throw new Error(error.message);
  return { total: data.meta?.contacts || 0 };
}

function filterByDateRange<T extends { ghl_date_added?: string | null }>(
  items: T[],
  dateRange?: DateRange,
  dateField: keyof T = "ghl_date_added" as keyof T,
): T[] {
  if (!dateRange?.from) return items;

  const startDate = dateRange.from;
  const endDate = dateRange.to || new Date();
  endDate.setHours(23, 59, 59, 999);

  return items.filter((item) => {
    const dateValue = item[dateField];
    if (!dateValue) return false;
    const date = new Date(dateValue as string);
    return date >= startDate && date <= endDate;
  });
}

function processMetrics(
  contacts: DBContact[],
  opportunities: DBOpportunity[],
  appointments: DBAppointment[],
  users: DBUser[],
  dateRange?: DateRange,
): DashboardMetrics & {
  totalOpportunities: number;
  totalPipelineValue: number;
  totalAppointments: number;
  cancelledAppointments: number;
  appointmentsToday: number;
  unconfirmedTodayAppointments: number;
  upcomingAppointments: number;
  upcomingNextWeek: number;
  opportunities: DBOpportunity[];
  filteredOpportunitiesList: DBOpportunity[];
  appointments: DBAppointment[];
  allAppointments: DBAppointment[];
  filteredAppointmentsList: DBAppointment[];
  contacts: DBContact[];
  allContacts: DBContact[];
  allOpportunities: DBOpportunity[];
  users: DBUser[];
  wonOpportunitiesCount: number;
  wonOpportunitiesValue: number;
  wonOpportunities: DBOpportunity[];
  wonBySource: { source: string; count: number; value: number }[];
  appointmentsBySource: { source: string; count: number }[];
  opportunitiesBySource: { source: string; count: number }[];
  oppsWithoutAppointmentsBySource: { source: string; count: number }[];
} {
  const filteredContacts = filterByDateRange(contacts, dateRange);

  // Create contact date lookup map for filtering opportunities by contact date
  const contactDateMap = new Map<string, string | null>();
  contacts.forEach((c) => {
    contactDateMap.set(c.ghl_id, c.ghl_date_added || null);
  });

  // Filter opportunities by their contact's creation date (not opportunity date)
  const filteredOpportunities = dateRange?.from
    ? opportunities.filter((opp) => {
        const contactDate = opp.contact_id ? contactDateMap.get(opp.contact_id) : null;
        if (!contactDate) return false;
        const date = new Date(contactDate);
        const startDate = dateRange.from!;
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return date >= startDate && date <= endDate;
      })
    : opportunities;

  // Create user lookup map
  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const leadsThisMonth = filteredContacts.filter((c) => {
    const dateAdded = c.ghl_date_added ? new Date(c.ghl_date_added) : null;
    return dateAdded && dateAdded >= startOfMonth;
  }).length;

  // Group by source
  const sourceMap = new Map<string, number>();
  filteredContacts.forEach((c) => {
    const source = c.source || "Direct";
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  const leadsBySource: LeadsBySource[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Filter appointments by date range (using start_time)
  const filteredAppointments = dateRange?.from
    ? appointments.filter((a) => {
        if (!a.start_time) return false;
        const startTime = new Date(a.start_time);
        const startDate = dateRange.from!;
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return startTime >= startDate && startTime <= endDate;
      })
    : appointments;

  // Create lookup maps for hybrid opportunity attribution
  // Map contact ghl_id -> contact.assigned_to
  const contactAssignmentMap = new Map<string, string>();
  contacts.forEach((c) => {
    if (c.ghl_id && c.assigned_to) {
      contactAssignmentMap.set(c.ghl_id, c.assigned_to);
    }
  });

  // Map contact_id -> appointment.assigned_user_id (first appointment found)
  const appointmentAssignmentMap = new Map<string, string>();
  appointments.forEach((a) => {
    if (a.contact_id && a.assigned_user_id && !appointmentAssignmentMap.has(a.contact_id)) {
      appointmentAssignmentMap.set(a.contact_id, a.assigned_user_id);
    }
  });

  // Helper: Get effective assignment for an opportunity using fallback chain
  const getEffectiveAssignment = (opportunity: DBOpportunity): string | null => {
    // Priority 1: Direct assignment on opportunity
    if (opportunity.assigned_to) {
      return opportunity.assigned_to;
    }
    // Priority 2: Assignment on the related contact
    if (opportunity.contact_id) {
      const contactAssignment = contactAssignmentMap.get(opportunity.contact_id);
      if (contactAssignment) {
        return contactAssignment;
      }
      // Priority 3: Assignment from appointment for this contact
      const appointmentAssignment = appointmentAssignmentMap.get(opportunity.contact_id);
      if (appointmentAssignment) {
        return appointmentAssignment;
      }
    }
    return null;
  };

  // Group appointments by assigned user - track both ghl_id and unique contacts
  const repAppointmentsMap = new Map<string, { userGhlId: string; uniqueContactIds: Set<string> }>();
  filteredAppointments.forEach((a) => {
    if (a.assigned_user_id && a.contact_id) {
      const repName = userMap.get(a.assigned_user_id) || a.assigned_user_id;
      if (!repAppointmentsMap.has(repName)) {
        repAppointmentsMap.set(repName, { userGhlId: a.assigned_user_id, uniqueContactIds: new Set() });
      }
      // Track unique contacts (don't count multiple appointments to same contact)
      repAppointmentsMap.get(repName)!.uniqueContactIds.add(a.contact_id);
    }
  });

  // Calculate metrics per rep - opportunities using hybrid attribution
  const salesRepPerformance: SalesRepPerformance[] = Array.from(repAppointmentsMap.entries())
    .map(([assignedTo, { userGhlId, uniqueContactIds }]) => {
      const uniqueAppointments = uniqueContactIds.size;

      // Get opportunities using hybrid attribution chain
      const repOpportunities = filteredOpportunities.filter((o) => getEffectiveAssignment(o) === userGhlId);

      const totalOpportunities = repOpportunities.length;
      const wonOpportunities = repOpportunities.filter((o) => o.status?.toLowerCase() === "won").length;

      const wonValue = repOpportunities
        .filter((o) => o.status?.toLowerCase() === "won")
        .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

      // Success rate = won opportunities / unique contacts with appointments (as percentage)
      const conversionRate = uniqueAppointments > 0 ? (wonOpportunities / uniqueAppointments) * 100 : 0;

      return {
        assignedTo,
        uniqueAppointments,
        wonOpportunities,
        totalOpportunities,
        wonValue,
        conversionRate,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue);

  // Recent leads with resolved names
  const recentLeads: GHLContact[] = filteredContacts.slice(0, 10).map((c) => ({
    id: c.ghl_id,
    locationId: c.location_id,
    contactName: c.contact_name || undefined,
    firstName: c.first_name || undefined,
    lastName: c.last_name || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    source: c.source || undefined,
    tags: c.tags || undefined,
    dateAdded: c.ghl_date_added || undefined,
    dateUpdated: c.ghl_date_updated || undefined,
    assignedTo: c.assigned_to ? userMap.get(c.assigned_to) || c.assigned_to : undefined,
  }));

  // Opportunities metrics
  const totalPipelineValue = filteredOpportunities
    .filter((o) => o.status !== "lost" && o.status !== "abandoned")
    .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  // Won opportunities metrics - based on opportunity close date (ghl_date_updated)
  const allWonOpportunities = opportunities.filter((o) => o.status?.toLowerCase() === "won");

  let wonOpportunities: DBOpportunity[];
  if (dateRange?.from) {
    const startDate = new Date(dateRange.from);
    const endDate = dateRange.to ? new Date(dateRange.to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    wonOpportunities = allWonOpportunities.filter((o) => {
      // Prefer ghl_date_updated as "close date", fall back to added date if missing
      const dateStr = o.ghl_date_updated || o.ghl_date_added;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
    });
  } else {
    // No date filter: all won opportunities
    wonOpportunities = allWonOpportunities;
  }

  // Always sort by close date (ghl_date_updated) newest first
  wonOpportunities = wonOpportunities.sort(
    (a, b) =>
      new Date(b.ghl_date_updated || b.ghl_date_added || 0).getTime() -
      new Date(a.ghl_date_updated || a.ghl_date_added || 0).getTime(),
  );

  const wonOpportunitiesCount = wonOpportunities.length;
  const wonOpportunitiesValue = wonOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  // Won by source - group won opportunities by contact source
  const contactSourceMap = new Map<string, string>();
  contacts.forEach((c) => {
    contactSourceMap.set(c.ghl_id, c.source || "Direct");
  });

  const wonBySourceMap = new Map<string, { count: number; value: number }>();
  wonOpportunities.forEach((o) => {
    if (o.contact_id) {
      const source = contactSourceMap.get(o.contact_id) || "Direct";
      const existing = wonBySourceMap.get(source) || { count: 0, value: 0 };
      wonBySourceMap.set(source, {
        count: existing.count + 1,
        value: existing.value + (o.monetary_value || 0),
      });
    }
  });

  const wonBySource = Array.from(wonBySourceMap.entries())
    .map(([source, data]) => ({ source, count: data.count, value: data.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Opportunities by source - group filtered opportunities by contact source (excluding quickbase stage)
  const opportunitiesBySourceMap = new Map<string, number>();
  filteredOpportunities
    .filter((o) => o.stage_name?.toLowerCase() !== "quickbase")
    .forEach((o) => {
      if (o.contact_id) {
        const source = contactSourceMap.get(o.contact_id) || "Direct";
        opportunitiesBySourceMap.set(source, (opportunitiesBySourceMap.get(source) || 0) + 1);
      }
    });

  const opportunitiesBySource = Array.from(opportunitiesBySourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Appointments by source - group filtered appointments by contact source (unique contacts only, exclude cancelled)
  const appointmentsBySourceMap = new Map<string, Set<string>>();
  filteredAppointments
    .filter((a) => a.appointment_status?.toLowerCase() !== "cancelled")
    .forEach((a) => {
      if (a.contact_id) {
        const source = contactSourceMap.get(a.contact_id) || "Direct";
        if (!appointmentsBySourceMap.has(source)) {
          appointmentsBySourceMap.set(source, new Set());
        }
        appointmentsBySourceMap.get(source)!.add(a.contact_id);
      }
    });

  const appointmentsBySource = Array.from(appointmentsBySourceMap.entries())
    .map(([source, contactIds]) => ({ source, count: contactIds.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Build set of contact IDs that have ANY appointments ever (non-cancelled)
  // Using ALL appointments, not filtered by date range
  const contactIdsWithAnyAppointments = new Set<string>();
  appointments
    .filter((a) => a.appointment_status?.toLowerCase() !== "cancelled")
    .forEach((a) => {
      if (a.contact_id) contactIdsWithAnyAppointments.add(a.contact_id);
    });

  // Opportunities WITHOUT any appointments by source
  const oppsWithoutAppointmentsBySourceMap = new Map<string, number>();
  filteredOpportunities
    .filter((o) => o.stage_name?.toLowerCase() !== "quickbase")
    .filter((o) => o.contact_id && !contactIdsWithAnyAppointments.has(o.contact_id))
    .forEach((o) => {
      if (o.contact_id) {
        const source = contactSourceMap.get(o.contact_id) || "Direct";
        oppsWithoutAppointmentsBySourceMap.set(source, (oppsWithoutAppointmentsBySourceMap.get(source) || 0) + 1);
      }
    });

  const oppsWithoutAppointmentsBySource = Array.from(oppsWithoutAppointmentsBySourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Appointments metrics
  // Start of today (midnight)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Start of tomorrow (midnight)
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // All appointments today (regardless of time - includes past ones)
  const todayAppointments = appointments.filter((a) => {
    if (!a.start_time) return false;
    const startTime = new Date(a.start_time);
    return startTime >= startOfToday && startTime < startOfTomorrow;
  });
  const appointmentsToday = todayAppointments.length;

  // Today's appointments not confirmed by rep (excluding cancelled)
  const unconfirmedTodayAppointments = todayAppointments.filter(
    (a) => !a.salesperson_confirmed && a.appointment_status?.toLowerCase() !== "cancelled"
  ).length;

  // Upcoming appointments (after today)
  const upcomingAppointments = appointments.filter((a) => {
    if (!a.start_time) return false;
    return new Date(a.start_time) >= startOfTomorrow;
  }).length;

  // Upcoming next week (excluding today)
  const nextWeekEnd = new Date(startOfTomorrow);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const upcomingNextWeek = appointments.filter((a) => {
    if (!a.start_time) return false;
    const startTime = new Date(a.start_time);
    return startTime >= startOfTomorrow && startTime <= nextWeekEnd;
  }).length;

  return {
    totalLeads: filteredContacts.filter((c) => c.source?.toLowerCase() !== "quickbase").length,
    leadsThisMonth,
    leadsBySource,
    salesRepPerformance,
    recentLeads,
    totalOpportunities: filteredOpportunities.filter((o) => o.stage_name?.toLowerCase() !== "quickbase").length,
    totalPipelineValue,
    totalAppointments: filteredAppointments.length,
    cancelledAppointments: filteredAppointments.filter((a) => a.appointment_status?.toLowerCase() === "cancelled")
      .length,
    appointmentsToday,
    unconfirmedTodayAppointments,
    upcomingAppointments,
    upcomingNextWeek,
    opportunities: filteredOpportunities,
    filteredOpportunitiesList: filteredOpportunities,
    appointments: appointments
      .filter((a) => a.start_time)
      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
      .slice(0, 10),
    allAppointments: appointments
      .filter((a) => a.start_time)
      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime()),
    filteredAppointmentsList: filteredAppointments,
    contacts: filteredContacts,
    allContacts: contacts,
    allOpportunities: opportunities,
    users,
    wonOpportunitiesCount,
    wonOpportunitiesValue,
    wonOpportunities,
    wonBySource,
    appointmentsBySource,
    opportunitiesBySource,
    oppsWithoutAppointmentsBySource,
  };
}

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: fetchContactsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunitiesFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointmentsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useGHLUsers() {
  return useQuery({
    queryKey: ["ghl_users"],
    queryFn: fetchUsersFromDB,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversationsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["ghl_tasks"],
    queryFn: fetchTasksFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useContactNotes() {
  return useQuery({
    queryKey: ["contact_notes"],
    queryFn: fetchContactNotesFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useCallLogs() {
  return useQuery({
    queryKey: ["call_logs"],
    queryFn: fetchCallLogsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfilesFromDB,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useSyncContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["ghl_users"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["call_logs"] });
    },
  });
}

export function useGHLMetrics(dateRange?: DateRange) {
  const contactsQuery = useContacts();
  const opportunitiesQuery = useOpportunities();
  const appointmentsQuery = useAppointments();
  const usersQuery = useGHLUsers();
  const conversationsQuery = useConversations();
  const tasksQuery = useTasks();
  const contactNotesQuery = useContactNotes();
  const callLogsQuery = useCallLogs();
  const profilesQuery = useProfiles();

  const isLoading =
    contactsQuery.isLoading ||
    opportunitiesQuery.isLoading ||
    appointmentsQuery.isLoading ||
    usersQuery.isLoading ||
    conversationsQuery.isLoading ||
    tasksQuery.isLoading ||
    contactNotesQuery.isLoading ||
    callLogsQuery.isLoading;
  const error =
    contactsQuery.error ||
    opportunitiesQuery.error ||
    appointmentsQuery.error ||
    usersQuery.error ||
    conversationsQuery.error ||
    tasksQuery.error ||
    contactNotesQuery.error ||
    callLogsQuery.error;

  // Filter call logs by date range
  const filteredCallLogs =
    callLogsQuery.data && dateRange?.from
      ? callLogsQuery.data.filter((c) => {
          if (!c.call_date) return false;
          const callDate = new Date(c.call_date);
          const endDate = dateRange.to || new Date();
          endDate.setHours(23, 59, 59, 999);
          return callDate >= dateRange.from! && callDate <= endDate;
        })
      : callLogsQuery.data || [];

  // Calculate unique contacts called
  const uniqueContactsCalled = new Set(filteredCallLogs.map((c) => c.contact_id)).size;

  // Calculate opportunity edits (opportunities with ghl_date_updated in date range)
  const editedOpportunities = opportunitiesQuery.data && dateRange?.from
    ? opportunitiesQuery.data.filter((o) => {
        if (!o.ghl_date_updated) return false;
        const updateDate = new Date(o.ghl_date_updated);
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return updateDate >= dateRange.from! && updateDate <= endDate;
      })
    : opportunitiesQuery.data || [];

  // Filter tasks created in date range
  const filteredTasks = tasksQuery.data && dateRange?.from
    ? tasksQuery.data.filter((t) => {
        if (!t.created_at) return false;
        const createDate = new Date(t.created_at);
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return createDate >= dateRange.from! && createDate <= endDate;
      })
    : tasksQuery.data || [];

  // Filter contact notes created in date range
  const filteredNotes = contactNotesQuery.data && dateRange?.from
    ? contactNotesQuery.data.filter((n) => {
        if (!n.ghl_date_added) return false;
        const addDate = new Date(n.ghl_date_added);
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return addDate >= dateRange.from! && addDate <= endDate;
      })
    : contactNotesQuery.data || [];

  const data =
    contactsQuery.data && opportunitiesQuery.data && appointmentsQuery.data && usersQuery.data
      ? {
          ...processMetrics(
            contactsQuery.data,
            opportunitiesQuery.data,
            appointmentsQuery.data,
            usersQuery.data,
            dateRange,
          ),
          conversations: conversationsQuery.data || [],
          tasks: tasksQuery.data || [],
          contactNotes: contactNotesQuery.data || [],
          profiles: profilesQuery.data || [],
          callLogs: filteredCallLogs,
          totalCalls: filteredCallLogs.length,
          outboundCalls: filteredCallLogs.filter((c) => c.direction === "outbound").length,
          inboundCalls: filteredCallLogs.filter((c) => c.direction === "inbound").length,
          uniqueContactsCalled,
          opportunityEdits: editedOpportunities.length,
          editedOpportunities,
          filteredTasks,
          filteredNotes,
          tasksCreatedCount: filteredTasks.length,
          notesCreatedCount: filteredNotes.length,
        }
      : undefined;

  return {
    isLoading,
    error,
    data,
    refetch: () => {
      contactsQuery.refetch();
      opportunitiesQuery.refetch();
      appointmentsQuery.refetch();
      usersQuery.refetch();
      conversationsQuery.refetch();
      tasksQuery.refetch();
      contactNotesQuery.refetch();
      callLogsQuery.refetch();
    },
  };
}
