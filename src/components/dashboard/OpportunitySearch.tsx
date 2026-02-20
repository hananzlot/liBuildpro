import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAddressFromContact as getAddressUtil, findContactByIdOrGhlId } from "@/lib/utils";

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  opportunity_number?: number | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  address?: string | null;
}

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Conversation {
  ghl_id: string;
  contact_id: string | null;
  type: string | null;
  unread_count: number | null;
  inbox_status: string | null;
  last_message_body: string | null;
  last_message_date: string | null;
  last_message_type: string | null;
  last_message_direction: string | null;
}

interface OpportunitySearchProps {
  opportunities: Opportunity[];
  appointments: Appointment[];
  contacts: Contact[];
  users: GHLUser[];
  conversations?: Conversation[];
}

export function OpportunitySearch({
  opportunities,
  appointments,
  contacts,
  users,
  conversations = [],
}: OpportunitySearchProps) {
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const getStatusSortOrder = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won": return 0;
      case "open": return 1;
      default: return 2;
    }
  };

  // Helper to get address with appointment fallback (uses shared utility)
  const getAddressWithFallback = (contactId: string | null): string => {
    if (!contactId) return "";
    const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
    return getAddressUtil(contact, appointments, contactId) || "";
  };

  // Helper to normalize phone numbers (digits only)
  const normalizePhone = (phone: string | null | undefined): string => {
    if (!phone) return "";
    return phone.replace(/\D/g, '');
  };

  const filteredOpportunities = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, '');
    const isPhoneSearch = /^\d+$/.test(queryLower.replace(/[\s\-\(\)]/g, ''));
    
    return opportunities
      .filter(opp => {
        const name = opp.name?.toLowerCase() || "";
        const contact = findContactByIdOrGhlId(contacts, undefined, opp.contact_id);
        const contactName = contact?.contact_name?.toLowerCase() || 
          `${contact?.first_name || ""} ${contact?.last_name || ""}`.toLowerCase();
        
        // Get address using robust extraction
        const address = getAddressWithFallback(opp.contact_id).toLowerCase();
        
        // Get phone (digits only)
        const phone = normalizePhone(contact?.phone);
        
        // Phone matching: anywhere in number OR last N digits match
        let phoneMatch = false;
        if (isPhoneSearch && queryDigits.length >= 3 && phone.length > 0) {
          phoneMatch = phone.includes(queryDigits) || phone.endsWith(queryDigits);
        }
        
        return name.includes(queryLower) || 
               contactName.includes(queryLower) || 
               address.includes(queryLower) ||
               phoneMatch;
      })
      .sort((a, b) => getStatusSortOrder(a.status) - getStatusSortOrder(b.status))
      .slice(0, 10);
  }, [searchQuery, opportunities, contacts]);

  const getAddress = (contactId: string | null) => {
    return getAddressWithFallback(contactId) || null;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lost":
      case "abandoned": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "open": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  const handleSelect = (opp: Opportunity) => {
    // Open in a new tab
    const customerName = getContactName(opp.contact_id);
    const oppNum = opp.opportunity_number;
    const tabTitle = oppNum 
      ? `Opp ${oppNum}${customerName && customerName !== 'Unknown' ? ` (${customerName})` : ''}`
      : opp.name || 'Opportunity';
    openTab(`/opportunity/${opp.id || opp.ghl_id}`, tabTitle);
    setIsOpen(false);
    setSearchQuery("");
  };

  const getContactName = (contactId: string | null, contactUuid?: string | null) => {
    if (!contactId && !contactUuid) return "Unknown";
    const contact = findContactByIdOrGhlId(contacts, contactUuid || undefined, contactId);
    return contact?.contact_name || 
      (contact?.first_name && contact?.last_name 
        ? `${contact.first_name} ${contact.last_name}` 
        : contact?.first_name || contact?.last_name || "Unknown");
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-[280px] justify-start gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Search opportunities...</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, address, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {searchQuery.trim() && (
            <div className="max-h-[300px] overflow-y-auto">
              {filteredOpportunities.length > 0 ? (
                <div className="p-2">
                  {filteredOpportunities.map((opp) => (
                    <button
                      key={opp.ghl_id}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelect(opp)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {getAddress(opp.contact_id) || "No address"}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {getContactName(opp.contact_id)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-semibold text-emerald-400 text-sm">
                            {formatCurrency(opp.monetary_value)}
                          </span>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                            {opp.status || "Unknown"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {opp.stage_name || "No stage"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No opportunities found
                </div>
              )}
            </div>
          )}
          
          {!searchQuery.trim() && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Start typing to search opportunities
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
