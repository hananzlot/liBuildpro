import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  MapPin,
  FileText,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  StickyNote,
  Megaphone,
  Search,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import type { DateRange } from "react-day-picker";

interface DBOpportunity {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
}

interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields: unknown;
}

interface DBUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface WonOpportunitiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: DBOpportunity[];
  contacts: DBContact[];
  users: DBUser[];
  dateRange?: DateRange; // 👈 NEW
}

// Custom field IDs from GHL
const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
  SCOPE_OF_WORK: "KwQRtJT0aMSHnq3mwR68",
  NOTES: "588ddQgiGEg3AWtTQB2i",
};

function extractCustomField(customFields: unknown, fieldId: string): string | null {
  if (!Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function WonOpportunitiesSheet({
  open,
  onOpenChange,
  opportunities,
  contacts,
  users,
  dateRange, // 👈 NEW
}: WonOpportunitiesSheetProps) {
  const [sourceFilter, setSourceFilter] = useState("");

  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => contactMap.set(c.ghl_id, c));

  // Filter opportunities by date range first, then by source (beginning of word match)
  const filteredOpportunities = useMemo(() => {
    let result = [...opportunities];

    // 🔹 Date range filter on ghl_date_updated
    if (dateRange?.from && dateRange?.to) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);

      result = result.filter((opp) => {
        if (!opp.ghl_date_updated) return false;
        const updated = new Date(opp.ghl_date_updated);
        return updated >= from && updated <= to;
      });
    }

    // 🔹 Source filter
    if (!sourceFilter.trim()) return result;

    const searchTerm = sourceFilter.toLowerCase().trim();
    return result.filter((opp) => {
      const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
      const source = (contact?.source || "").toLowerCase();
      const words = source.split(/\s+/);
      return words.some((word) => word.startsWith(searchTerm)) || source.startsWith(searchTerm);
    });
  }, [opportunities, sourceFilter, contactMap, dateRange]);

  const totalValue = filteredOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Won Opportunities
          </SheetTitle>
          <SheetDescription>
            {filteredOpportunities.length} deals • {formatCurrency(totalValue)} total value
          </SheetDescription>
        </SheetHeader>

        {/* Source Filter */}
        <div className="mt-4 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by source..."
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          <div className="space-y-4">
            {filteredOpportunities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {sourceFilter ? "No opportunities match the filter" : "No won opportunities found"}
              </p>
            ) : (
              filteredOpportunities.map((opp) => {
                const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
                const salesPerson = opp.assigned_to ? userMap.get(opp.assigned_to) : null;
                const address = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
                const scopeOfWork = contact
                  ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK)
                  : null;
                const notes = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.NOTES) : null;
                const contactName =
                  contact?.contact_name ||
                  `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
                  "Unknown Contact";

                // 🔹 Days the lead was worked on: ghl_date_updated - ghl_date_added
                let daysWorked: number | null = null;
                if (opp.ghl_date_added && opp.ghl_date_updated) {
                  const added = new Date(opp.ghl_date_added);
                  const updated = new Date(opp.ghl_date_updated);
                  const diff = differenceInCalendarDays(updated, added);
                  daysWorked = diff < 0 ? 0 : diff;
                }

                return (
                  <Card key={opp.id} className="border-border/50">
                    <CardContent className="pt-4 space-y-4">
                      {/* Header with name and value */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {opp.name || "Unnamed Opportunity"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {contactName}
                            {daysWorked !== null && ` (${daysWorked} day${daysWorked === 1 ? "" : "s"})`}
                          </p>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                          {formatCurrency(opp.monetary_value || 0)}
                        </Badge>
                      </div>

                      <Separator />

                      {/* Details grid */}
                      <div className="grid gap-3 text-sm">
                        {/* Address */}
                        {address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-foreground">{address}</span>
                          </div>
                        )}

                        {/* Scope of Work */}
                        {scopeOfWork && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <span className="text-muted-foreground">Scope: </span>
                              <span className="text-foreground">{scopeOfWork}</span>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {notes && (
                          <div className="flex items-start gap-2">
                            <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <span className="text-muted-foreground">Notes: </span>
                              <span className="text-foreground">{notes}</span>
                            </div>
                          </div>
                        )}

                        {/* Sales Person */}
                        {salesPerson && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-muted-foreground">Sales Rep: </span>
                              <span className="text-foreground">{salesPerson}</span>
                            </div>
                          </div>
                        )}

                        {/* Contact Info */}
                        {contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{contact.phone}</span>
                          </div>
                        )}

                        {contact?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{contact.email}</span>
                          </div>
                        )}

                        {/* Pipeline & Stage */}
                        {(opp.pipeline_name || opp.stage_name) && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              {opp.pipeline_name}
                              {opp.stage_name && ` • ${opp.stage_name}`}
                            </span>
                          </div>
                        )}

                        {/* Source */}
                        {contact?.source && (
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-muted-foreground">Source: </span>
                              <span className="text-foreground">{contact.source}</span>
                            </div>
                          </div>
                        )}

                        {/* Date Won */}
                        {opp.ghl_date_updated && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-muted-foreground">Won: </span>
                              <span className="text-foreground">
                                {format(new Date(opp.ghl_date_updated), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
