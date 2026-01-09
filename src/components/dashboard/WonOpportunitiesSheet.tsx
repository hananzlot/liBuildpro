import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  LayoutGrid,
  TableIcon,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import type { DateRange } from "@/hooks/useGHLContacts";
import { getAddressFromContact, CUSTOM_FIELD_IDS, extractCustomField } from "@/lib/utils";

function parseGhlDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d;
}

// Format name to proper title case
function formatName(name: string): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

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
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  won_at: string | null;
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
  attributions?: unknown;
  ghl_date_added?: string | null;
}

interface DBUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DBAppointment {
  ghl_id: string;
  contact_id?: string | null;
  address?: string | null;
}

interface WonOpportunitiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: DBOpportunity[];
  contacts: DBContact[];
  users: DBUser[];
  appointments?: DBAppointment[];
  dateRange?: DateRange;
  onOpportunityClick?: (opportunity: DBOpportunity) => void;
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
  appointments = [],
  dateRange,
  onOpportunityClick,
}: WonOpportunitiesSheetProps) {
  const [sourceFilter, setSourceFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sortColumn, setSortColumn] = useState<"contact" | "address" | "source" | "rep" | "value" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => contactMap.set(c.ghl_id, c));

  const filteredOpportunities = useMemo(() => {
    let result = [...opportunities];

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

  // Prepare enriched data for both views
  const enrichedOpportunities = useMemo(() => {
    return filteredOpportunities.map((opp) => {
      const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
      const salesPerson = opp.assigned_to ? userMap.get(opp.assigned_to) : null;
      // Use getAddressFromContact with appointments fallback
      const address = getAddressFromContact(contact, appointments, opp.contact_id);
      const scopeFromCustomField = contact
        ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK)
        : null;
      const scopeFromAttributions = (() => {
        if (!contact?.attributions) return null;
        const attrs = contact.attributions as Array<{ utmContent?: string }> | null;
        if (Array.isArray(attrs) && attrs.length > 0) {
          return attrs[0]?.utmContent || null;
        }
        return null;
      })();
      const scopeOfWork = scopeFromCustomField || scopeFromAttributions;
      const notes = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.NOTES) : null;
      const rawContactName =
        contact?.contact_name ||
        `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
        "Unknown Contact";
      const contactName = formatName(rawContactName);

      const startDate = parseGhlDate(opp.ghl_date_added || contact?.ghl_date_added || null);
      // Use won_at for end date (accurate), fallback to ghl_date_updated
      const endDate = parseGhlDate(opp.won_at || opp.ghl_date_updated);
      let daysWorked: number | null = null;
      if (startDate && endDate) {
        const diff = differenceInCalendarDays(endDate, startDate);
        daysWorked = diff < 0 ? 0 : diff;
      }

      return {
        ...opp,
        contact,
        salesPerson,
        address,
        scopeOfWork,
        notes,
        contactName,
        daysWorked,
      };
    });
  }, [filteredOpportunities, contactMap, userMap, appointments]);

  // Sorted opportunities for table view
  const sortedOpportunities = useMemo(() => {
    return [...enrichedOpportunities].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "contact":
          comparison = (a.contactName || "").localeCompare(b.contactName || "");
          break;
        case "address":
          comparison = (a.address || "").localeCompare(b.address || "");
          break;
        case "source":
          comparison = (a.contact?.source || "").localeCompare(b.contact?.source || "");
          break;
        case "rep":
          comparison = (a.salesPerson || "").localeCompare(b.salesPerson || "");
          break;
        case "value":
          comparison = (a.monetary_value || 0) - (b.monetary_value || 0);
          break;
        case "date":
        default:
          // Sort by won_at (accurate) with fallback to ghl_date_updated
          comparison = new Date(a.won_at || a.ghl_date_updated || 0).getTime() - new Date(b.won_at || b.ghl_date_updated || 0).getTime();
          break;
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [enrichedOpportunities, sortColumn, sortDirection]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "date" || column === "value" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleExportCSV = () => {
    const headers = [
      "Opportunity Name",
      "Contact Name",
      "Value",
      "Address",
      "Phone",
      "Email",
      "Source",
      "Sales Rep",
      "Pipeline",
      "Stage",
      "Scope of Work",
      "Days Worked",
      "Date Won",
    ];

    const rows = enrichedOpportunities.map((opp) => [
      opp.name || "",
      opp.contactName,
      opp.monetary_value || 0,
      opp.address || "",
      opp.contact?.phone || "",
      opp.contact?.email || "",
      opp.contact?.source || "",
      opp.salesPerson || "",
      opp.pipeline_name || "",
      opp.stage_name || "",
      opp.scopeOfWork || "",
      opp.daysWorked !== null ? opp.daysWorked : "",
      // Use won_at (accurate) for export, fallback to ghl_date_updated
      (opp.won_at || opp.ghl_date_updated) ? format(new Date(opp.won_at || opp.ghl_date_updated!), "yyyy-MM-dd") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `won-opportunities-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={`w-full ${viewMode === "table" ? "sm:max-w-4xl" : "sm:max-w-xl"}`}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Won Opportunities
          </SheetTitle>
          <SheetDescription>
            {filteredOpportunities.length} deals • {formatCurrency(totalValue)} total value
          </SheetDescription>
        </SheetHeader>

        {/* Controls Row */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by source..."
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2"
              onClick={() => setViewMode("cards")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2"
              onClick={() => setViewMode("table")}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          {filteredOpportunities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {sourceFilter ? "No opportunities match the filter" : "No won opportunities found"}
            </p>
          ) : viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("contact")}
                  >
                    <div className="flex items-center">Contact<SortIcon column="contact" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("address")}
                  >
                    <div className="flex items-center">Address<SortIcon column="address" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("source")}
                  >
                    <div className="flex items-center">Source<SortIcon column="source" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("rep")}
                  >
                    <div className="flex items-center">Sales Rep<SortIcon column="rep" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none text-right"
                    onClick={() => handleSort("value")}
                  >
                    <div className="flex items-center justify-end">Value<SortIcon column="value" /></div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center">Date Won<SortIcon column="date" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOpportunities.map((opp) => (
                  <TableRow
                    key={opp.id}
                    className={onOpportunityClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onOpportunityClick?.(opp)}
                  >
                    <TableCell>
                      <div className="font-medium">{opp.contactName}</div>
                      {opp.contact?.phone && (
                        <div className="text-xs text-muted-foreground">{opp.contact.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {opp.address || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{opp.contact?.source || "-"}</TableCell>
                    <TableCell className="text-sm">{opp.salesPerson || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(opp.monetary_value || 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {/* Use won_at (accurate) for display, fallback to ghl_date_updated */}
                      {(opp.won_at || opp.ghl_date_updated)
                        ? format(new Date(opp.won_at || opp.ghl_date_updated!), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-4">
              {enrichedOpportunities.map((opp) => (
                <Card
                  key={opp.id}
                  className={`border-border/50 ${onOpportunityClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                  onClick={() => onOpportunityClick?.(opp)}
                >
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {opp.name || "Unnamed Opportunity"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {opp.contactName}
                          {opp.daysWorked !== null && ` (${opp.daysWorked} day${opp.daysWorked === 1 ? "" : "s"})`}
                        </p>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                        {formatCurrency(opp.monetary_value || 0)}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="grid gap-3 text-sm">
                      {opp.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-foreground">{opp.address}</span>
                        </div>
                      )}

                      {opp.scopeOfWork && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Scope: </span>
                            <span className="text-foreground">{opp.scopeOfWork}</span>
                          </div>
                        </div>
                      )}

                      {opp.notes && (
                        <div className="flex items-start gap-2">
                          <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Notes: </span>
                            <span className="text-foreground">{opp.notes}</span>
                          </div>
                        </div>
                      )}

                      {opp.salesPerson && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Sales Rep: </span>
                            <span className="text-foreground">{opp.salesPerson}</span>
                          </div>
                        </div>
                      )}

                      {opp.contact?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{opp.contact.phone}</span>
                        </div>
                      )}

                      {opp.contact?.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{opp.contact.email}</span>
                        </div>
                      )}

                      {(opp.pipeline_name || opp.stage_name) && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground">
                            {opp.pipeline_name}
                            {opp.stage_name && ` • ${opp.stage_name}`}
                          </span>
                        </div>
                      )}

                      {opp.contact?.source && (
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Source: </span>
                            <span className="text-foreground">{opp.contact.source}</span>
                          </div>
                        </div>
                      )}

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
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
