import { DollarSign, Trophy, MapPin, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  ghl_date_updated: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  custom_fields?: unknown;
}

interface ProjectCost {
  opportunity_id: string;
  estimated_cost: number;
}

interface RecentWonDealsProps {
  wonOpportunities: Opportunity[];
  contacts: Contact[];
  onOpportunityClick?: (opportunity: Opportunity) => void;
}

function formatCurrency(value: number | null): string {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function capitalizeWords(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function RecentWonDeals({ wonOpportunities, contacts, onOpportunityClick }: RecentWonDealsProps) {
  const [projectCosts, setProjectCosts] = useState<Map<string, number>>(new Map());

  const contactMap = new Map<string, Contact>();
  contacts.forEach(c => {
    if (c.ghl_id) contactMap.set(c.ghl_id, c);
  });

  // Filter to last 30 days
  const last30DaysWon = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return wonOpportunities
      .filter(opp => {
        if (!opp.ghl_date_updated) return false;
        return new Date(opp.ghl_date_updated) >= thirtyDaysAgo;
      })
      .sort((a, b) => 
        new Date(b.ghl_date_updated || 0).getTime() - new Date(a.ghl_date_updated || 0).getTime()
      );
  }, [wonOpportunities]);

  // Fetch project costs for won opportunities
  useEffect(() => {
    const fetchCosts = async () => {
      if (last30DaysWon.length === 0) return;
      
      const oppIds = last30DaysWon.map(o => o.ghl_id);
      const { data, error } = await supabase
        .from('project_costs')
        .select('opportunity_id, estimated_cost')
        .in('opportunity_id', oppIds);
      
      if (error) {
        console.error('Failed to fetch project costs:', error);
        return;
      }
      
      const costMap = new Map<string, number>();
      (data || []).forEach((c: ProjectCost) => {
        costMap.set(c.opportunity_id, c.estimated_cost);
      });
      setProjectCosts(costMap);
    };
    
    fetchCosts();
  }, [last30DaysWon]);

  const getContactName = (contactId: string | null): string => {
    if (!contactId) return 'Unknown';
    const contact = contactMap.get(contactId);
    if (!contact) return 'Unknown';
    return capitalizeWords(
      contact.contact_name || 
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 
      'Unknown'
    );
  };

  const getAddress = (contactId: string | null): string | null => {
    if (!contactId) return null;
    const contact = contactMap.get(contactId);
    if (!contact?.custom_fields) return null;
    const customFields = contact.custom_fields as { id: string; value: string }[];
    if (!Array.isArray(customFields)) return null;
    const addressField = customFields.find(f => f.id === 'b7oTVsUQrLgZt84bHpCn');
    return addressField?.value || null;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  };

  const totalWonValue = last30DaysWon.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const totalCost = last30DaysWon.reduce((sum, o) => sum + (projectCosts.get(o.ghl_id) || 0), 0);
  const totalProfit = totalWonValue - totalCost;

  return (
    <div className="rounded-2xl bg-card p-4 border border-border/50 h-[280px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-500" />
          <h3 className="text-base font-semibold text-foreground">Won Deals (30 days)</h3>
        </div>
        <div className="flex items-center gap-2">
          {totalCost > 0 && (
            <Badge variant="outline" className={`text-xs ${totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
              {totalProfit >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {formatCurrency(totalProfit)}
            </Badge>
          )}
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            {last30DaysWon.length} · {formatCurrency(totalWonValue)}
          </Badge>
        </div>
      </div>

      {/* Deals List - Scrollable */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-1 pr-2">
          {last30DaysWon.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No won deals in the last 30 days
            </p>
          ) : (
            last30DaysWon.map((opp) => {
              const address = getAddress(opp.contact_id);
              const cost = projectCosts.get(opp.ghl_id);
              const profit = cost !== undefined ? (opp.monetary_value || 0) - cost : null;
              
              return (
                <div
                  key={opp.ghl_id}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-all"
                  onClick={() => onOpportunityClick?.(opp)}
                >
                  {/* Icon */}
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-3 w-3 text-emerald-500" />
                  </div>

                  {/* Name & Address */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {getContactName(opp.contact_id)}
                    </p>
                    {address && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {address}
                      </p>
                    )}
                  </div>

                  {/* Value & Profit - Compact single line */}
                  <div className="flex items-center gap-2 shrink-0">
                    {cost !== undefined && (
                      <span className="text-xs text-amber-500/80">
                        {formatCurrency(cost)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-emerald-500">
                      {formatCurrency(opp.monetary_value)}
                    </span>
                    {profit !== null && (
                      <span className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
