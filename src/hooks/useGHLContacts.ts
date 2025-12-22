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
  updated_at: string | null;
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
  address?: string | null;
  salesperson_confirmed?: boolean;
  ghl_date_added?: string | null;
  ghl_date_updated?: string | null;
  updated_at?: string;
  entered_by?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
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
  edited_by?: string | null;
  edited_at?: string | null;
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
  edited_by?: string | null;
  edited_at?: string | null;
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

export interface DBOpportunityEdit {
  id: string;
  opportunity_ghl_id: string;
  contact_ghl_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  edited_by: string | null;
  edited_at: string | null;
  location_id: string | null;
}

export interface DBOpportunitySale {
  id: string;
  opportunity_id: string;
  contact_id: string | null;
  location_id: string;
  sold_amount: number;
  sold_date: string;
  sold_to_name: string | null;
  sold_to_phone: string | null;
  sold_by: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBTaskEdit {
  id: string;
  task_ghl_id: string;
  contact_ghl_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  edited_by: string | null;
  edited_at: string | null;
  location_id: string | null;
}

export interface DBNoteEdit {
  id: string;
  note_ghl_id: string;
  contact_ghl_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  edited_by: string | null;
  edited_at: string | null;
  location_id: string | null;
}

export interface DBAppointmentEdit {
  id: string;
  appointment_ghl_id: string;
  contact_ghl_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  edited_by: string | null;
  edited_at: string | null;
  location_id: string | null;
}

// Location 2 ID - contacts from this location are imported to Location 1, so exclude from display
const LOCATION_2_ID = "XYDIgpHivVWHii65sId5";

// Generic paginated fetch for any table
async function fetchAllFromTable(
  table: string, 
  orderBy: string,
  excludeLocationId?: string
): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table as "contacts" | "opportunities" | "appointments")
      .select("*")
      .order(orderBy as any, { ascending: false });
    
    // Exclude Location 2 records if specified
    if (excludeLocationId) {
      query = query.neq("location_id", excludeLocationId);
    }
    
    const { data, error } = await query.range(from, from + pageSize - 1);

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
  // Exclude Location 2 contacts - they are imported to Location 1
  return fetchAllFromTable("contacts", "ghl_date_added", LOCATION_2_ID) as Promise<DBContact[]>;
}

async function fetchOpportunitiesFromDB(): Promise<DBOpportunity[]> {
  // Exclude Location 2 opportunities - they are imported to Location 1  
  return fetchAllFromTable("opportunities", "ghl_date_added", LOCATION_2_ID) as Promise<DBOpportunity[]>;
}

async function fetchAppointmentsFromDB(): Promise<DBAppointment[]> {
  // Exclude Location 2 appointments
  return fetchAllFromTable("appointments", "start_time", LOCATION_2_ID) as Promise<DBAppointment[]>;
}

async function fetchUsersFromDB(): Promise<DBUser[]> {
  // Users from both locations are fine - no filtering needed
  const { data, error } = await supabase.from("ghl_users").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchConversationsFromDB(): Promise<DBConversation[]> {
  // Exclude Location 2 conversations
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .neq("location_id", LOCATION_2_ID)
    .order("last_message_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchTasksFromDB(): Promise<DBTask[]> {
  // Exclude Location 2 tasks
  const { data, error } = await supabase
    .from("ghl_tasks")
    .select("*")
    .neq("location_id", LOCATION_2_ID)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchContactNotesFromDB(): Promise<DBContactNote[]> {
  // Exclude Location 2 notes
  const { data, error } = await supabase
    .from("contact_notes")
    .select("*")
    .neq("location_id", LOCATION_2_ID)
    .order("ghl_date_added", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchCallLogsFromDB(): Promise<DBCallLog[]> {
  // Exclude Location 2 call logs
  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .neq("location_id", LOCATION_2_ID)
    .order("call_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchProfilesFromDB(): Promise<DBProfile[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchOpportunityEditsFromDB(): Promise<DBOpportunityEdit[]> {
  const { data, error } = await supabase
    .from("opportunity_edits")
    .select("*")
    .order("edited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchOpportunitySalesFromDB(): Promise<DBOpportunitySale[]> {
  const { data, error } = await supabase
    .from("opportunity_sales")
    .select("*")
    .order("sold_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchTaskEditsFromDB(): Promise<DBTaskEdit[]> {
  const { data, error } = await supabase
    .from("task_edits")
    .select("*")
    .order("edited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchNoteEditsFromDB(): Promise<DBNoteEdit[]> {
  const { data, error } = await supabase
    .from("note_edits")
    .select("*")
    .order("edited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchAppointmentEditsFromDB(): Promise<DBAppointmentEdit[]> {
  const { data, error } = await supabase
    .from("appointment_edits")
    .select("*")
    .order("edited_at", { ascending: false });
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

async function syncGHL2(): Promise<{ contactsImported: number; opportunitiesImported: number }> {
  const { data, error } = await supabase.functions.invoke("import-ghl-location2");

  if (error) throw new Error(error.message);
  return { 
    contactsImported: data?.contactsImported || 0, 
    opportunitiesImported: data?.opportunitiesImported || 0 
  };
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
  appointmentsCreatedInRangeList: DBAppointment[];
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

  // Helper: Normalize source name to proper capitalization (title case)
  const normalizeSourceName = (source: string): string => {
    if (!source) return "Direct";
    // Convert to title case: capitalize first letter of each word
    return source
      .toLowerCase()
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper: Get source priority (Facebook=0, Google=1, Others=2)
  const getSourcePriority = (source: string): number => {
    const lower = source.toLowerCase();
    if (lower.includes('facebook')) return 0;
    if (lower.includes('google')) return 1;
    return 2;
  };

  // Helper: Sort sources by priority, then:
  // - Facebook/Google: by count desc (most appointments first)
  // - Others: alphabetically, then by count desc
  const sortSources = <T extends { source: string; count: number }>(items: T[]): T[] => {
    return items.sort((a, b) => {
      const priorityA = getSourcePriority(a.source);
      const priorityB = getSourcePriority(b.source);
      const priorityDiff = priorityA - priorityB;
      if (priorityDiff !== 0) return priorityDiff;
      
      // Within Facebook (priority 0) or Google (priority 1): sort by count desc
      if (priorityA < 2) {
        return b.count - a.count;
      }
      
      // Within Others (priority 2): sort alphabetically, then by count desc
      const alphaDiff = a.source.localeCompare(b.source);
      if (alphaDiff !== 0) return alphaDiff;
      return b.count - a.count;
    });
  };

  // Group by source (normalized)
  const sourceMap = new Map<string, number>();
  filteredContacts.forEach((c) => {
    const source = normalizeSourceName(c.source || "Direct");
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  const leadsBySource: LeadsBySource[] = sortSources(
    Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count }))
  );

  // Filter appointments by date range (using start_time) - for display/charts
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

  // Filter appointments by CREATION date (ghl_date_added) - for "Total Appointments in Date Range" KPI
  const appointmentsByCreationDate = dateRange?.from
    ? appointments.filter((a) => {
        if (!a.ghl_date_added) return false;
        const createdDate = new Date(a.ghl_date_added);
        const startDate = dateRange.from!;
        const endDate = dateRange.to || new Date();
        endDate.setHours(23, 59, 59, 999);
        return createdDate >= startDate && createdDate <= endDate;
      })
    : appointments;

  // Filter appointments that were scheduled (start_time) in the date range AND marked as "showed"
  const appointmentsShowedInDateRange = dateRange?.from
    ? appointments.filter((a) => {
        const status = a.appointment_status?.toLowerCase();
        if (status !== "showed") return false;
        // Use start_time - the appointment was scheduled in this date range and they showed up
        if (!a.start_time) return false;
        const appointmentDate = new Date(a.start_time);
        const startDate = dateRange.from!;
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return appointmentDate >= startDate && appointmentDate <= endDate;
      })
    : appointments.filter((a) => a.appointment_status?.toLowerCase() === "showed");

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
      // Use ghl_date_updated (when status was changed to won in GHL), fall back to ghl_date_added
      const dateStr = o.ghl_date_updated || o.ghl_date_added;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
    });
  } else {
    // No date filter: all won opportunities
    wonOpportunities = allWonOpportunities;
  }

  // Always sort by close date (ghl_date_updated when won) newest first
  wonOpportunities = wonOpportunities.sort(
    (a, b) =>
      new Date(b.ghl_date_updated || b.ghl_date_added || 0).getTime() -
      new Date(a.ghl_date_updated || a.ghl_date_added || 0).getTime(),
  );

  const wonOpportunitiesCount = wonOpportunities.length;
  const wonOpportunitiesValue = wonOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  // Won by source - group won opportunities by contact source (normalized)
  const contactSourceMap = new Map<string, string>();
  contacts.forEach((c) => {
    contactSourceMap.set(c.ghl_id, normalizeSourceName(c.source || "Direct"));
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
    .sort((a, b) => b.value - a.value);

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

  const opportunitiesBySource = sortSources(
    Array.from(opportunitiesBySourceMap.entries()).map(([source, count]) => ({ source, count }))
  );

  // Build set of contact IDs from the filtered opportunities (same as Opps tab)
  const filteredOppsContactIds = new Set<string>();
  filteredOpportunities
    .filter((o) => o.stage_name?.toLowerCase() !== "quickbase")
    .forEach((o) => {
      if (o.contact_id) filteredOppsContactIds.add(o.contact_id);
    });

  // Build set of contact IDs that have ANY appointments ever (non-cancelled)
  const contactIdsWithAnyAppointments = new Set<string>();
  appointments
    .filter((a) => a.appointment_status?.toLowerCase() !== "cancelled")
    .forEach((a) => {
      if (a.contact_id) contactIdsWithAnyAppointments.add(a.contact_id);
    });

  // Appointments by source - from the Opps contacts, which ones have appointments
  const appointmentsBySourceMap = new Map<string, number>();
  filteredOpportunities
    .filter((o) => o.stage_name?.toLowerCase() !== "quickbase")
    .filter((o) => o.contact_id && contactIdsWithAnyAppointments.has(o.contact_id))
    .forEach((o) => {
      if (o.contact_id) {
        const source = contactSourceMap.get(o.contact_id) || "Direct";
        appointmentsBySourceMap.set(source, (appointmentsBySourceMap.get(source) || 0) + 1);
      }
    });

  const appointmentsBySource = sortSources(
    Array.from(appointmentsBySourceMap.entries()).map(([source, count]) => ({ source, count }))
  );

  // Opportunities WITHOUT any appointments by source - leftovers from Opps tab
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

  const oppsWithoutAppointmentsBySource = sortSources(
    Array.from(oppsWithoutAppointmentsBySourceMap.entries()).map(([source, count]) => ({ source, count }))
  );

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
    totalAppointments: appointmentsByCreationDate.length,
    cancelledAppointments: appointmentsByCreationDate.filter((a) => a.appointment_status?.toLowerCase() === "cancelled")
      .length,
    appointmentsShowedInDateRange: appointmentsShowedInDateRange.length,
    appointmentsShowedInDateRangeList: appointmentsShowedInDateRange,
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
    appointmentsCreatedInRangeList: appointmentsByCreationDate,
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

export function useOpportunityEdits() {
  return useQuery({
    queryKey: ["opportunity_edits"],
    queryFn: fetchOpportunityEditsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useOpportunitySales() {
  return useQuery({
    queryKey: ["opportunity_sales"],
    queryFn: fetchOpportunitySalesFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTaskEdits() {
  return useQuery({
    queryKey: ["task_edits"],
    queryFn: fetchTaskEditsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useNoteEdits() {
  return useQuery({
    queryKey: ["note_edits"],
    queryFn: fetchNoteEditsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useAppointmentEdits() {
  return useQuery({
    queryKey: ["appointment_edits"],
    queryFn: fetchAppointmentEditsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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

export function useSyncGHL2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncGHL2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

async function fetchSyncTimestamps(): Promise<{ lastGHLSync: string | null; lastGHL2Import: string | null }> {
  const [ghlResult, ghl2Result] = await Promise.all([
    supabase.from("contacts").select("last_synced_at").order("last_synced_at", { ascending: false }).limit(1),
    supabase.from("imported_records").select("imported_at").order("imported_at", { ascending: false }).limit(1),
  ]);

  return {
    lastGHLSync: ghlResult.data?.[0]?.last_synced_at || null,
    lastGHL2Import: ghl2Result.data?.[0]?.imported_at || null,
  };
}

export function useSyncTimestamps() {
  return useQuery({
    queryKey: ["sync_timestamps"],
    queryFn: fetchSyncTimestamps,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000,
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
  const opportunityEditsQuery = useOpportunityEdits();
  const opportunitySalesQuery = useOpportunitySales();
  const taskEditsQuery = useTaskEdits();
  const noteEditsQuery = useNoteEdits();
  const appointmentEditsQuery = useAppointmentEdits();

  const isLoading =
    contactsQuery.isLoading ||
    opportunitiesQuery.isLoading ||
    appointmentsQuery.isLoading ||
    usersQuery.isLoading ||
    conversationsQuery.isLoading ||
    tasksQuery.isLoading ||
    contactNotesQuery.isLoading ||
    callLogsQuery.isLoading ||
    opportunityEditsQuery.isLoading ||
    opportunitySalesQuery.isLoading ||
    taskEditsQuery.isLoading ||
    noteEditsQuery.isLoading ||
    appointmentEditsQuery.isLoading;
  const error =
    contactsQuery.error ||
    opportunitiesQuery.error ||
    appointmentsQuery.error ||
    usersQuery.error ||
    conversationsQuery.error ||
    tasksQuery.error ||
    contactNotesQuery.error ||
    callLogsQuery.error ||
    opportunityEditsQuery.error ||
    opportunitySalesQuery.error ||
    taskEditsQuery.error ||
    noteEditsQuery.error ||
    appointmentEditsQuery.error;

  // Filter call logs by date range
  const filteredCallLogs =
    callLogsQuery.data && dateRange?.from
      ? callLogsQuery.data.filter((c) => {
          if (!c.call_date) return false;
          const callDate = new Date(c.call_date);
          const endDate = new Date(dateRange.to || new Date());
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
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return updateDate >= dateRange.from! && updateDate <= endDate;
      })
    : opportunitiesQuery.data || [];

  // Build a set of task ghl_ids that have ANY edit in the date range
  const taskGhlIdsWithEditsInRange = new Set<string>();
  if (taskEditsQuery.data && dateRange?.from) {
    const endDate = new Date(dateRange.to || new Date());
    endDate.setHours(23, 59, 59, 999);
    taskEditsQuery.data.forEach((e) => {
      if (e.edited_at) {
        const editDate = new Date(e.edited_at);
        if (editDate >= dateRange.from! && editDate <= endDate) {
          taskGhlIdsWithEditsInRange.add(e.task_ghl_id);
        }
      }
    });
  }

  // Build a set of note ghl_ids that have ANY edit in the date range
  const noteGhlIdsWithEditsInRange = new Set<string>();
  if (noteEditsQuery.data && dateRange?.from) {
    const endDate = new Date(dateRange.to || new Date());
    endDate.setHours(23, 59, 59, 999);
    noteEditsQuery.data.forEach((e) => {
      if (e.edited_at) {
        const editDate = new Date(e.edited_at);
        if (editDate >= dateRange.from! && editDate <= endDate) {
          noteGhlIdsWithEditsInRange.add(e.note_ghl_id);
        }
      }
    });
  }

  // Build a set of appointment ghl_ids that have ANY edit in the date range
  const appointmentGhlIdsWithEditsInRange = new Set<string>();
  if (appointmentEditsQuery.data && dateRange?.from) {
    const endDate = new Date(dateRange.to || new Date());
    endDate.setHours(23, 59, 59, 999);
    appointmentEditsQuery.data.forEach((e) => {
      if (e.edited_at) {
        const editDate = new Date(e.edited_at);
        if (editDate >= dateRange.from! && editDate <= endDate) {
          appointmentGhlIdsWithEditsInRange.add(e.appointment_ghl_id);
        }
      }
    });
  }

  // Filter appointments: created in range OR any edit in range (from history table)
  const filteredAppointments = appointmentsQuery.data && dateRange?.from
    ? appointmentsQuery.data.filter((a) => {
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        
        // Check if ANY edit exists in range (from history table)
        if (appointmentGhlIdsWithEditsInRange.has(a.ghl_id)) return true;
        
        // Check ghl_date_updated (for GHL-side updates)
        if (a.ghl_date_updated) {
          const updateDate = new Date(a.ghl_date_updated);
          if (updateDate >= dateRange.from! && updateDate <= endDate) return true;
        }
        
        return false;
      })
    : appointmentsQuery.data || [];

  // Filter tasks: created in range OR any edit in range (from history table)
  const filteredTasks = tasksQuery.data && dateRange?.from
    ? tasksQuery.data.filter((t) => {
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        
        // Check if ANY edit exists in range (from history table)
        if (taskGhlIdsWithEditsInRange.has(t.ghl_id)) return true;
        
        // Check if created in range
        if (t.created_at) {
          const createDate = new Date(t.created_at);
          if (createDate >= dateRange.from! && createDate <= endDate) return true;
        }
        
        return false;
      })
    : tasksQuery.data || [];

  // Filter contact notes: created in range OR any edit in range (from history table)
  const filteredNotes = contactNotesQuery.data && dateRange?.from
    ? contactNotesQuery.data.filter((n) => {
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        
        // Check if ANY edit exists in range (from history table)
        if (noteGhlIdsWithEditsInRange.has(n.ghl_id)) return true;
        
        // Check if created in range
        if (n.ghl_date_added) {
          const addDate = new Date(n.ghl_date_added);
          if (addDate >= dateRange.from! && addDate <= endDate) return true;
        }
        
        return false;
      })
    : contactNotesQuery.data || [];

  // Filter opportunity edits by date range (edited_at)
  const filteredOpportunityEdits = opportunityEditsQuery.data && dateRange?.from
    ? opportunityEditsQuery.data.filter((e) => {
        if (!e.edited_at) return false;
        const editDate = new Date(e.edited_at);
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return editDate >= dateRange.from! && editDate <= endDate;
      })
    : opportunityEditsQuery.data || [];

  // Filter task edits by date range
  const filteredTaskEdits = taskEditsQuery.data && dateRange?.from
    ? taskEditsQuery.data.filter((e) => {
        if (!e.edited_at) return false;
        const editDate = new Date(e.edited_at);
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return editDate >= dateRange.from! && editDate <= endDate;
      })
    : taskEditsQuery.data || [];

  // Filter note edits by date range
  const filteredNoteEdits = noteEditsQuery.data && dateRange?.from
    ? noteEditsQuery.data.filter((e) => {
        if (!e.edited_at) return false;
        const editDate = new Date(e.edited_at);
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return editDate >= dateRange.from! && editDate <= endDate;
      })
    : noteEditsQuery.data || [];

  // Filter appointment edits by date range
  const filteredAppointmentEdits = appointmentEditsQuery.data && dateRange?.from
    ? appointmentEditsQuery.data.filter((e) => {
        if (!e.edited_at) return false;
        const editDate = new Date(e.edited_at);
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return editDate >= dateRange.from! && editDate <= endDate;
      })
    : appointmentEditsQuery.data || [];

  // Filter opportunity sales by date range (sold_date)
  const filteredOpportunitySales = opportunitySalesQuery.data && dateRange?.from
    ? opportunitySalesQuery.data.filter((s) => {
        if (!s.sold_date) return false;
        const soldDate = new Date(s.sold_date);
        const endDate = new Date(dateRange.to || new Date());
        endDate.setHours(23, 59, 59, 999);
        return soldDate >= dateRange.from! && soldDate <= endDate;
      })
    : opportunitySalesQuery.data || [];

  const totalOpportunitySalesAmount = filteredOpportunitySales.reduce((sum, s) => sum + (s.sold_amount || 0), 0);

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
          filteredAppointments,
          appointmentsEditedCount: filteredAppointments.length,
          filteredTasks,
          filteredNotes,
          tasksCreatedCount: filteredTasks.length,
          notesCreatedCount: filteredNotes.length,
          filteredOpportunityEdits,
          filteredTaskEdits,
          filteredNoteEdits,
          filteredAppointmentEdits,
          // In-app activity counts (for Activity KPI)
          inAppTaskActivityCount: filteredTasks.filter(t => t.entered_by).length + filteredTaskEdits.length,
          inAppNoteActivityCount: filteredNotes.filter(n => n.entered_by).length + filteredNoteEdits.length,
          inAppAppointmentActivityCount: filteredAppointments.filter(a => a.entered_by).length + filteredAppointmentEdits.length,
          taskEdits: taskEditsQuery.data || [],
          noteEdits: noteEditsQuery.data || [],
          appointmentEdits: appointmentEditsQuery.data || [],
          opportunitySales: opportunitySalesQuery.data || [],
          filteredOpportunitySales,
          opportunitySalesCount: filteredOpportunitySales.length,
          totalOpportunitySalesAmount,
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
      opportunityEditsQuery.refetch();
      opportunitySalesQuery.refetch();
      taskEditsQuery.refetch();
      noteEditsQuery.refetch();
      appointmentEditsQuery.refetch();
    },
  };
}
