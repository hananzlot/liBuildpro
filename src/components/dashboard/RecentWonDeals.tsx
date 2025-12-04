import { DollarSign, Trophy, MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const contactMap = new Map<string, Contact>();
  contacts.forEach(c => {
    if (c.ghl_id) contactMap.set(c.ghl_id, c);
  });

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

  const recentWon = wonOpportunities.slice(0, 5);
  const totalWonValue = wonOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  return (
    <div className="rounded-2xl bg-card p-4 border border-border/50 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-500" />
          <h3 className="text-base font-semibold text-foreground">Recent Won Deals</h3>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          {wonOpportunities.length} deals · {formatCurrency(totalWonValue)}
        </Badge>
      </div>

      {/* Deals List */}
      <div className="space-y-1">
        {recentWon.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No won deals in this period
          </p>
        ) : (
          recentWon.map((opp) => {
            const address = getAddress(opp.contact_id);
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

                {/* Value & Date */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-500">
                    {formatCurrency(opp.monetary_value)}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(opp.ghl_date_updated)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}