import { DollarSign, Trophy, MapPin, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/hooks/useGHLContacts";
import { differenceInCalendarDays } from "date-fns";
import { getAddressFromContact } from "@/lib/utils";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  ghl_date_updated: string | null;
  ghl_date_added: string | null;
  won_at: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  custom_fields?: unknown;
}

interface Appointment {
  ghl_id: string;
  contact_id: string | null;
  address?: string | null;
}

interface ProjectCost {
  opportunity_id: string;
  estimated_cost: number;
}

interface RecentWonDealsProps {
  wonOpportunities: Opportunity[];
  contacts: Contact[];
  appointments?: Appointment[];
  dateRange?: DateRange;
  onOpportunityClick?: (opportunity: Opportunity) => void;
}

function formatCurrency(value: number | null): string {
  if (!value) return "$0";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function capitalizeWords(str: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Normalize Supabase-style timestamps ("YYYY-MM-DD HH:mm:ss.SSS+00")
function parseGhlDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export function RecentWonDeals({ wonOpportunities, contacts, appointments = [], dateRange, onOpportunityClick }: RecentWonDealsProps) {
  const [projectCosts, setProjectCosts] = useState<Map<string, number>>(new Map());

  const contactMap = new Map<string, Contact>();
  contacts.forEach((c) => {
    if (c.ghl_id) contactMap.set(c.ghl_id, c);
  });

  // 🔹 Filter by selected date range using won_at (accurate) with fallback to ghl_date_updated
  const filteredWon = useMemo(() => {
    let result = [...wonOpportunities];

    if (dateRange?.from && dateRange?.to) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);

      result = result.filter((opp) => {
        // Use won_at (accurate), fallback to ghl_date_updated
        const dateStr = opp.won_at || opp.ghl_date_updated;
        if (!dateStr) return false;
        const updated = new Date(dateStr);
        return updated >= from && updated <= to;
      });
    }

    // Sort by won_at (accurate), fallback to ghl_date_updated
    return result.sort(
      (a, b) => new Date(b.won_at || b.ghl_date_updated || 0).getTime() - new Date(a.won_at || a.ghl_date_updated || 0).getTime(),
    );
  }, [wonOpportunities, dateRange]);

  // Fetch project costs for filtered won opportunities
  useEffect(() => {
    const fetchCosts = async () => {
      if (filteredWon.length === 0) return;

      const oppIds = filteredWon.map((o) => o.ghl_id);
      const { data, error } = await supabase
        .from("project_costs")
        .select("opportunity_id, estimated_cost")
        .in("opportunity_id", oppIds);

      if (error) {
        console.error("Failed to fetch project costs:", error);
        return;
      }

      const costMap = new Map<string, number>();
      (data || []).forEach((c: ProjectCost) => {
        costMap.set(c.opportunity_id, c.estimated_cost);
      });
      setProjectCosts(costMap);
    };

    fetchCosts();
  }, [filteredWon]);

  const getContactName = (contactId: string | null): string => {
    if (!contactId) return "Unknown";
    const contact = contactMap.get(contactId);
    if (!contact) return "Unknown";
    return capitalizeWords(
      contact.contact_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown",
    );
  };

  const getAddress = (contactId: string | null): string | null => {
    if (!contactId) return null;
    const contact = contactMap.get(contactId);
    return getAddressFromContact(contact, appointments, contactId);
  };

  const totalWonValue = filteredWon.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const totalCost = filteredWon.reduce((sum, o) => sum + (projectCosts.get(o.ghl_id) || 0), 0);
  const totalProfit = totalWonValue - totalCost;

  return (
    <div className="rounded-2xl bg-card p-4 border border-border/50 h-[280px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-500" />
          <h3 className="text-base font-semibold text-foreground">Won Deals</h3>
        </div>
        <div className="flex items-center gap-2">
          {totalCost > 0 && (
            <Badge
              variant="outline"
              className={`text-xs ${totalProfit >= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-red-500/10 text-red-500 border-red-500/30"}`}
            >
              {totalProfit >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {formatCurrency(totalProfit)}
            </Badge>
          )}
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            {filteredWon.length} · {formatCurrency(totalWonValue)}
          </Badge>
        </div>
      </div>

      {/* Deals List - Scrollable */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-1 pr-2">
          {filteredWon.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No won deals in this period</p>
          ) : (
            filteredWon
              .slice()
              .sort((a, b) => (b.monetary_value || 0) - (a.monetary_value || 0))
              .map((opp) => {
                const address = getAddress(opp.contact_id);
                const cost = projectCosts.get(opp.ghl_id);
                const profit = cost !== undefined ? (opp.monetary_value || 0) - cost : null;

                return (
                  <div
                    key={opp.ghl_id}
                    className="group grid grid-cols-[24px_1fr_auto] gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-all items-center"
                    onClick={() => onOpportunityClick?.(opp)}
                  >
                    {/* Icon */}
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign className="h-3 w-3 text-emerald-500" />
                    </div>

                    {/* Name + days worked */}
                    <div className="min-w-0">
                      {(() => {
                        const contactName = getContactName(opp.contact_id);

                        // 🔹 Days worked = won_at - ghl_date_added (calendar days)
                        const startDate = parseGhlDate(opp.ghl_date_added);
                        // Use won_at (accurate), fallback to ghl_date_updated
                        const endDate = parseGhlDate(opp.won_at || opp.ghl_date_updated);

                        let daysWorked: number | null = null;
                        if (startDate && endDate) {
                          const diff = differenceInCalendarDays(endDate, startDate);
                          daysWorked = diff < 0 ? 0 : diff;
                        }

                        return (
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {contactName}
                            {daysWorked !== null && ` (${daysWorked} day${daysWorked === 1 ? "" : "s"})`}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Value & Profit */}
                    <div className="flex items-center gap-1 text-right whitespace-nowrap text-[11px]">
                      {cost !== undefined && <span className="text-amber-500">{formatCurrency(cost)}</span>}
                      <span className="font-semibold text-emerald-500 min-w-[40px]">
                        {formatCurrency(opp.monetary_value)}
                      </span>
                      {profit !== null && (
                        <span className={`font-medium ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {profit >= 0 ? "+" : ""}
                          {formatCurrency(profit)}
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
