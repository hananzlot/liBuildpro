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
}

interface DBUser {
  id: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

// Generic paginated fetch for any table
async function fetchAllFromTable(table: string, orderBy: string): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table as 'contacts' | 'opportunities' | 'appointments')
      .select('*')
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
  return fetchAllFromTable('contacts', 'ghl_date_added') as Promise<DBContact[]>;
}

async function fetchOpportunitiesFromDB(): Promise<DBOpportunity[]> {
  return fetchAllFromTable('opportunities', 'ghl_date_added') as Promise<DBOpportunity[]>;
}

async function fetchAppointmentsFromDB(): Promise<DBAppointment[]> {
  return fetchAllFromTable('appointments', 'start_time') as Promise<DBAppointment[]>;
}

async function fetchUsersFromDB(): Promise<DBUser[]> {
  const { data, error } = await supabase.from('ghl_users').select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

async function syncContacts(): Promise<{ total: number }> {
  const { data, error } = await supabase.functions.invoke('fetch-ghl-contacts', {
    body: { syncToDb: true },
  });

  if (error) throw new Error(error.message);
  return { total: data.meta?.contacts || 0 };
}

function filterByDateRange<T extends { ghl_date_added?: string | null }>(
  items: T[],
  dateRange?: DateRange,
  dateField: keyof T = 'ghl_date_added' as keyof T
): T[] {
  if (!dateRange?.from) return items;

  const startDate = dateRange.from;
  const endDate = dateRange.to || new Date();
  endDate.setHours(23, 59, 59, 999);

  return items.filter(item => {
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
  dateRange?: DateRange
): DashboardMetrics & {
  totalOpportunities: number;
  totalPipelineValue: number;
  totalAppointments: number;
  upcomingAppointments: number;
  upcomingNextWeek: number;
  opportunities: DBOpportunity[];
  filteredOpportunitiesList: DBOpportunity[];
  appointments: DBAppointment[];
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
} {
  const filteredContacts = filterByDateRange(contacts, dateRange);
  const filteredOpportunities = filterByDateRange(opportunities, dateRange);
  
  // Create user lookup map
  const userMap = new Map<string, string>();
  users.forEach(u => {
    const displayName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const leadsThisMonth = filteredContacts.filter(c => {
    const dateAdded = c.ghl_date_added ? new Date(c.ghl_date_added) : null;
    return dateAdded && dateAdded >= startOfMonth;
  }).length;

  // Group by source
  const sourceMap = new Map<string, number>();
  filteredContacts.forEach(c => {
    const source = c.source || 'Direct';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });
  
  const leadsBySource: LeadsBySource[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Filter appointments by date range (using start_time)
  const filteredAppointments = dateRange?.from 
    ? appointments.filter(a => {
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
  contacts.forEach(c => {
    if (c.ghl_id && c.assigned_to) {
      contactAssignmentMap.set(c.ghl_id, c.assigned_to);
    }
  });

  // Map contact_id -> appointment.assigned_user_id (first appointment found)
  const appointmentAssignmentMap = new Map<string, string>();
  appointments.forEach(a => {
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
  filteredAppointments.forEach(a => {
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
      const repOpportunities = filteredOpportunities.filter(o => 
        getEffectiveAssignment(o) === userGhlId
      );
      
      const totalOpportunities = repOpportunities.length;
      const wonOpportunities = repOpportunities.filter(o => 
        o.status?.toLowerCase() === 'won'
      ).length;
      
      const wonValue = repOpportunities
        .filter(o => o.status?.toLowerCase() === 'won')
        .reduce((sum, o) => sum + (o.monetary_value || 0), 0);
      
      // Conversion rate = won / total opportunities (as percentage)
      const conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;

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
  const recentLeads: GHLContact[] = filteredContacts.slice(0, 10).map(c => ({
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
    assignedTo: c.assigned_to ? (userMap.get(c.assigned_to) || c.assigned_to) : undefined,
  }));

  // Opportunities metrics
  const totalPipelineValue = filteredOpportunities
    .filter(o => o.status !== 'lost' && o.status !== 'abandoned')
    .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  // Won opportunities metrics
  const wonOpportunities = filteredOpportunities
    .filter(o => o.status?.toLowerCase() === 'won')
    .sort((a, b) => new Date(b.ghl_date_updated || 0).getTime() - new Date(a.ghl_date_updated || 0).getTime());
  const wonOpportunitiesCount = wonOpportunities.length;
  const wonOpportunitiesValue = wonOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  // Won by source - group won opportunities by contact source
  const contactSourceMap = new Map<string, string>();
  contacts.forEach(c => {
    contactSourceMap.set(c.ghl_id, c.source || 'Direct');
  });
  
  const wonBySourceMap = new Map<string, { count: number; value: number }>();
  wonOpportunities.forEach(o => {
    if (o.contact_id) {
      const source = contactSourceMap.get(o.contact_id) || 'Direct';
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
    .filter(o => o.stage_name?.toLowerCase() !== 'quickbase')
    .forEach(o => {
      if (o.contact_id) {
        const source = contactSourceMap.get(o.contact_id) || 'Direct';
        opportunitiesBySourceMap.set(source, (opportunitiesBySourceMap.get(source) || 0) + 1);
      }
    });
  
  const opportunitiesBySource = Array.from(opportunitiesBySourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Appointments by source - group filtered appointments by contact source (unique contacts only)
  const appointmentsBySourceMap = new Map<string, Set<string>>();
  filteredAppointments.forEach(a => {
    if (a.contact_id) {
      const source = contactSourceMap.get(a.contact_id) || 'Direct';
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

  // Appointments metrics
  const upcomingAppointments = appointments.filter(a => {
    if (!a.start_time) return false;
    return new Date(a.start_time) > now;
  }).length;

  // Upcoming next week
  const nextWeekEnd = new Date(now);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const upcomingNextWeek = appointments.filter(a => {
    if (!a.start_time) return false;
    const startTime = new Date(a.start_time);
    return startTime > now && startTime <= nextWeekEnd;
  }).length;

  return {
    totalLeads: filteredContacts.length,
    leadsThisMonth,
    leadsBySource,
    salesRepPerformance,
    recentLeads,
    totalOpportunities: filteredOpportunities.length,
    totalPipelineValue,
    totalAppointments: appointments.length,
    upcomingAppointments,
    upcomingNextWeek,
    opportunities: filteredOpportunities.slice(0, 10),
    filteredOpportunitiesList: filteredOpportunities,
    appointments: appointments
      .filter(a => a.start_time)
      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
      .slice(0, 10),
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
  };
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: fetchContactsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: ['opportunities'],
    queryFn: fetchOpportunitiesFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: fetchAppointmentsFromDB,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useGHLUsers() {
  return useQuery({
    queryKey: ['ghl_users'],
    queryFn: fetchUsersFromDB,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['ghl_users'] });
    },
  });
}

export function useGHLMetrics(dateRange?: DateRange) {
  const contactsQuery = useContacts();
  const opportunitiesQuery = useOpportunities();
  const appointmentsQuery = useAppointments();
  const usersQuery = useGHLUsers();

  const isLoading = contactsQuery.isLoading || opportunitiesQuery.isLoading || 
                    appointmentsQuery.isLoading || usersQuery.isLoading;
  const error = contactsQuery.error || opportunitiesQuery.error || 
                appointmentsQuery.error || usersQuery.error;

  const data = contactsQuery.data && opportunitiesQuery.data && 
               appointmentsQuery.data && usersQuery.data
    ? processMetrics(
        contactsQuery.data,
        opportunitiesQuery.data,
        appointmentsQuery.data,
        usersQuery.data,
        dateRange
      )
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
    },
  };
}
