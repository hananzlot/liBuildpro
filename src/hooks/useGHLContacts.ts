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
  opportunities: DBOpportunity[];
  appointments: DBAppointment[];
  contacts: DBContact[];
  allContacts: DBContact[];
  allOpportunities: DBOpportunity[];
  users: DBUser[];
  wonOpportunitiesCount: number;
  wonOpportunitiesValue: number;
  wonOpportunities: DBOpportunity[];
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

  // Group appointments by assigned user
  const repAppointmentsMap = new Map<string, Set<string>>();
  filteredAppointments.forEach(a => {
    if (a.assigned_user_id && a.contact_id) {
      const repName = userMap.get(a.assigned_user_id) || a.assigned_user_id;
      if (!repAppointmentsMap.has(repName)) {
        repAppointmentsMap.set(repName, new Set());
      }
      // Track unique contacts (don't count multiple appointments to same contact)
      repAppointmentsMap.get(repName)!.add(a.contact_id);
    }
  });
  // Calculate metrics per rep based on unique appointments
  const salesRepPerformance: SalesRepPerformance[] = Array.from(repAppointmentsMap.entries())
    .map(([assignedTo, uniqueContactIds]) => {
      const uniqueAppointments = uniqueContactIds.size;
      
      // Get opportunities for contacts this rep had appointments with
      const repOpportunities = opportunities.filter(o => 
        o.contact_id && uniqueContactIds.has(o.contact_id)
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

  // Appointments metrics
  const upcomingAppointments = appointments.filter(a => {
    if (!a.start_time) return false;
    return new Date(a.start_time) > now;
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
    opportunities: filteredOpportunities.slice(0, 10),
    appointments: appointments
      .filter(a => a.start_time)
      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
      .slice(0, 10),
    contacts: filteredContacts,
    allContacts: contacts,
    allOpportunities: opportunities,
    users,
    wonOpportunitiesCount,
    wonOpportunitiesValue,
    wonOpportunities,
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
