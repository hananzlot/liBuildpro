import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GHLContactsResponse, DashboardMetrics, LeadsBySource, SalesRepPerformance } from "@/types/ghl";

async function fetchContacts(): Promise<GHLContactsResponse> {
  const { data, error } = await supabase.functions.invoke('fetch-ghl-contacts', {
    body: { limit: 100 },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function processMetrics(response: GHLContactsResponse): DashboardMetrics {
  const contacts = response.contacts || [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count leads this month
  const leadsThisMonth = contacts.filter(c => {
    const dateAdded = c.dateAdded ? new Date(c.dateAdded) : null;
    return dateAdded && dateAdded >= startOfMonth;
  }).length;

  // Group by source
  const sourceMap = new Map<string, number>();
  contacts.forEach(c => {
    const source = c.source || c.attributions?.[0]?.utmSource || 'Direct';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });
  
  const leadsBySource: LeadsBySource[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Group by assigned rep
  const repMap = new Map<string, number>();
  contacts.forEach(c => {
    if (c.assignedTo) {
      repMap.set(c.assignedTo, (repMap.get(c.assignedTo) || 0) + 1);
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
  const recentLeads = [...contacts]
    .sort((a, b) => {
      const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
      const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  return {
    totalLeads: contacts.length,
    leadsThisMonth,
    leadsBySource,
    salesRepPerformance,
    recentLeads,
  };
}

export function useGHLContacts() {
  return useQuery({
    queryKey: ['ghl-contacts'],
    queryFn: fetchContacts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGHLMetrics() {
  const contactsQuery = useGHLContacts();

  return {
    ...contactsQuery,
    data: contactsQuery.data ? processMetrics(contactsQuery.data) : undefined,
  };
}
