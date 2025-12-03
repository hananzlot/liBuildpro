import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardMetrics, LeadsBySource, SalesRepPerformance, GHLContact } from "@/types/ghl";

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

// Fetch contacts from Supabase database
async function fetchContactsFromDB(): Promise<DBContact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('ghl_date_added', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
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

function processMetrics(contacts: DBContact[]): DashboardMetrics {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count leads this month
  const leadsThisMonth = contacts.filter(c => {
    const dateAdded = c.ghl_date_added ? new Date(c.ghl_date_added) : null;
    return dateAdded && dateAdded >= startOfMonth;
  }).length;

  // Group by source
  const sourceMap = new Map<string, number>();
  contacts.forEach(c => {
    const source = c.source || 'Direct';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });
  
  const leadsBySource: LeadsBySource[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Group by assigned rep
  const repMap = new Map<string, number>();
  contacts.forEach(c => {
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

  // Recent leads (last 10)
  const recentLeads: GHLContact[] = contacts.slice(0, 10).map(c => ({
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
    totalLeads: contacts.length,
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

export function useGHLMetrics() {
  const contactsQuery = useContacts();

  return {
    ...contactsQuery,
    data: contactsQuery.data ? processMetrics(contactsQuery.data) : undefined,
  };
}
