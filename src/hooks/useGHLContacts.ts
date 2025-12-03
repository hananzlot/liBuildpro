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

// Fetch all contacts from Supabase database (handles pagination for >1000 rows)
async function fetchContactsFromDB(): Promise<DBContact[]> {
  const allContacts: DBContact[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('ghl_date_added', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allContacts.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allContacts;
}

// Sync contacts from GHL API to database
async function syncContacts(): Promise<{ total: number }> {
  const { data, error } = await supabase.functions.invoke('fetch-ghl-contacts', {
    body: { syncToDb: true },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { total: data.meta?.total || 0 };
}

function filterContactsByDateRange(contacts: DBContact[], dateRange?: DateRange): DBContact[] {
  if (!dateRange?.from) return contacts;

  const startDate = dateRange.from;
  const endDate = dateRange.to || new Date();
  
  // Set end date to end of day
  endDate.setHours(23, 59, 59, 999);

  return contacts.filter(c => {
    if (!c.ghl_date_added) return false;
    const dateAdded = new Date(c.ghl_date_added);
    return dateAdded >= startDate && dateAdded <= endDate;
  });
}

function processMetrics(contacts: DBContact[], dateRange?: DateRange): DashboardMetrics {
  const filteredContacts = filterContactsByDateRange(contacts, dateRange);
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count leads this month (from filtered set)
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

  // Group by assigned rep
  const repMap = new Map<string, number>();
  filteredContacts.forEach(c => {
    if (c.assigned_to) {
      repMap.set(c.assigned_to, (repMap.get(c.assigned_to) || 0) + 1);
    }
  });

  const salesRepPerformance: SalesRepPerformance[] = Array.from(repMap.entries())
    .map(([assignedTo, totalLeads]) => ({
      assignedTo,
      totalLeads,
      conversionRate: Math.random() * 30 + 10, // Placeholder - would need pipeline data
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads);

  // Recent leads (last 10 from filtered set)
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
    assignedTo: c.assigned_to || undefined,
  }));

  return {
    totalLeads: filteredContacts.length,
    leadsThisMonth,
    leadsBySource,
    salesRepPerformance,
    recentLeads,
  };
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: fetchContactsFromDB,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

export function useSyncContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useGHLMetrics(dateRange?: DateRange) {
  const contactsQuery = useContacts();

  return {
    ...contactsQuery,
    data: contactsQuery.data ? processMetrics(contactsQuery.data, dateRange) : undefined,
  };
}
