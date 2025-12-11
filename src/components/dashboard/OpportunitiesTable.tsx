import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarCheck,
  CalendarX,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarIcon,
} from "lucide-react";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  stage_name: string | null;
  monetary_value: number | null;
  status: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
  ghl_date_added?: string | null;
  assigned_to?: string | null;
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

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  appointments?: Appointment[];
  contacts?: Contact[];
  users?: GHLUser[];
  conversations?: Conversation[];
}

type SortColumn = "name" | "stage" | "value" | "status" | "source" | "createdDate" | "updatedDate";

//const [sortColumn, setSortColumn] = useState<SortColumn>("updatedDate");

type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

export function OpportunitiesTable({
  opportunities,
  appointments = [],
  contacts = [],
  users = [],
  conversations = [],
}: OpportunitiesTableProps) {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [appointmentFilter, setAppointmentFilter] = useState<string>("all");
  const [salesRepFilter, setSalesRepFilter] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("updatedDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [tableDateField, setTableDateField] = useState<"updatedDate" | "createdDate">("updatedDate");
  const [tableDateRange, setTableDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { from: start, to: end };
  });

  const uniqueStages = useMemo(() => {
    const stages = new Set<string>();
    opportunities.forEach((opp) => {
      if (opp.stage_name) stages.add(opp.stage_name);
    });
    return Array.from(stages).sort();
  }, [opportunities]);

  // Format stages for multi-select
  const stageOptions = useMemo(() => {
    return uniqueStages.map((stage) => ({ value: stage, label: stage }));
  }, [uniqueStages]);

  // Get unique sales reps from users
  const uniqueSalesReps = useMemo(() => {
    return users
      .map((u) => ({
        ghl_id: u.ghl_id,
        name: u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Format sales reps for multi-select
  const salesRepOptions = useMemo(() => {
    return uniqueSalesReps.map((rep) => ({ value: rep.ghl_id, label: rep.name }));
  }, [uniqueSalesReps]);

  // Get unique sources from contacts
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    contacts.forEach((c) => {
      if (c.source) sources.add(c.source);
    });
    return Array.from(sources).sort();
  }, [contacts]);

  // Format sources for multi-select
  const sourceOptions = useMemo(() => {
    return uniqueSources.map((source) => ({ value: source, label: source }));
  }, [uniqueSources]);

  // Track which contacts have appointments (excluding cancelled)
  const contactsWithAppointments = useMemo(() => {
    return new Set(
      appointments
        .filter((a) => a.contact_id && a.appointment_status?.toLowerCase() !== "cancelled")
        .map((a) => a.contact_id),
    );
  }, [appointments]);

  // Map contact_id to appointments for quick lookup
  const appointmentsByContact = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments
      .filter((a) => a.contact_id && a.appointment_status?.toLowerCase() !== "cancelled")
      .forEach((a) => {
        const existing = map.get(a.contact_id!) || [];
        existing.push(a);
        map.set(a.contact_id!, existing);
      });
    return map;
  }, [appointments]);

  // User lookup map
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.ghl_id) {
        map.set(u.ghl_id, u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id);
      }
    });
    return map;
  }, [users]);

  // Contact lookup map for dates
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => {
      if (c.ghl_id) {
        map.set(c.ghl_id, c);
      }
    });
    return map;
  }, [contacts]);

  const formatAppointmentDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    );
  };

  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = opportunities;

    // Apply stage filter (multi-select)
    if (stageFilter.length > 0) {
      filtered = filtered.filter((opp) => opp.stage_name && stageFilter.includes(opp.stage_name));
    }

    // Apply source filter (multi-select)
    if (sourceFilter.length > 0) {
      filtered = filtered.filter((opp) => {
        const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
        return contact?.source && sourceFilter.includes(contact.source);
      });
    }

    // Apply appointment filter
    if (appointmentFilter === "with") {
      filtered = filtered.filter((opp) => opp.contact_id && contactsWithAppointments.has(opp.contact_id));
    } else if (appointmentFilter === "without") {
      filtered = filtered.filter((opp) => !opp.contact_id || !contactsWithAppointments.has(opp.contact_id));
    }

    // Apply sales rep filter (multi-select)
    if (salesRepFilter.length > 0) {
      filtered = filtered.filter((opp) => {
        // Check opportunity assigned_to
        if (opp.assigned_to && salesRepFilter.includes(opp.assigned_to)) return true;
        // Check contact assigned_to
        const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
        if (contact?.assigned_to && salesRepFilter.includes(contact.assigned_to)) return true;
        // Check appointment assigned_user_id
        const oppAppointments = opp.contact_id ? appointmentsByContact.get(opp.contact_id) || [] : [];
        return oppAppointments.some((a) => a.assigned_user_id && salesRepFilter.includes(a.assigned_user_id));
      });
    }

    // Apply table date range filter
    if (tableDateRange?.from) {
      filtered = filtered.filter((opp) => {
        let dateStr: string | null | undefined;
        if (tableDateField === "updatedDate") {
          dateStr = opp.ghl_date_updated || opp.ghl_date_added;
        } else {
          const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
          dateStr = contact?.ghl_date_added || opp.ghl_date_added;
        }
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const from = tableDateRange.from!;
        const to = tableDateRange.to || tableDateRange.from!;
        // Normalize to start/end of day
        const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
        return date >= fromStart && date <= toEnd;
      });
    }

    // Helper to get effective date from contact (quickbase stage = 90 days ago)
    const getEffectiveDate = (opp: Opportunity): number => {
      if (opp.stage_name?.toLowerCase() === "quickbase") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ninetyDaysAgo.getTime();
      }
      // Use contact's date if available, otherwise fall back to opportunity date
      const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
      const dateStr = contact?.ghl_date_added || opp.ghl_date_added;
      return dateStr ? new Date(dateStr).getTime() : 0;
    };

    // Helper: normalize a Date to midnight (so only the day matters)
    const toDayTimestamp = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      // strip time, keep local date; use setUTCHours(0,0,0,0) if you prefer UTC
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    // Helper to get Created date (by day)
    const getCreatedDate = (opp: Opportunity): number => {
      if (opp.stage_name?.toLowerCase() === "quickbase") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        ninetyDaysAgo.setHours(0, 0, 0, 0);
        return ninetyDaysAgo.getTime();
      }
      const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
      const dateStr = contact?.ghl_date_added || opp.ghl_date_added;
      return toDayTimestamp(dateStr);
    };

    // Helper to get UPDATED date (by day)
    const getUpdatedDate = (opp: Opportunity): number => {
      const dateStr = opp.ghl_date_updated || opp.ghl_date_added;
      return toDayTimestamp(dateStr);
    };

    // Sort opportunities
    return [...filtered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      let comparison = 0;

      const aCreated = getCreatedDate(a);
      const bCreated = getCreatedDate(b);
      const aUpdated = getUpdatedDate(a);
      const bUpdated = getUpdatedDate(b);

      switch (sortColumn) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          return dir * comparison;

        case "stage":
          comparison = (a.stage_name || "").localeCompare(b.stage_name || "");
          if (comparison !== 0) return dir * comparison;
          // secondary: created date
          return dir * (aCreated - bCreated);

        case "value":
          comparison = (a.monetary_value || 0) - (b.monetary_value || 0);
          return dir * comparison;

        case "source": {
          const contactA = a.contact_id ? contactMap.get(a.contact_id) : null;
          const contactB = b.contact_id ? contactMap.get(b.contact_id) : null;
          comparison = (contactA?.source || "").localeCompare(contactB?.source || "");
          return dir * comparison;
        }

        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          return dir * comparison;

        case "createdDate":
          // primary: created date only
          return dir * (aCreated - bCreated);

        case "updatedDate":
        default:
          // primary: updated date
          comparison = aUpdated - bUpdated;
          if (comparison !== 0) {
            return dir * comparison;
          }
          // secondary: created date
          return dir * (aCreated - bCreated);
      }
    });
  }, [
    opportunities,
    stageFilter,
    sourceFilter,
    appointmentFilter,
    salesRepFilter,
    sortColumn,
    sortDirection,
    contactsWithAppointments,
    contactMap,
    appointmentsByContact,
    tableDateRange,
    tableDateField,
  ]);

  // Reset to page 1 when filters change
  const handleStageFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setStageFilter(selected);
  };

  const handleSourceFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setSourceFilter(selected);
  };

  const handleSalesRepFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setSalesRepFilter(selected);
  };

  const handleAppointmentFilterChange = (value: string) => {
    setCurrentPage(1);
    setAppointmentFilter(value);
  };

  // Helper to extract custom field value
  const getCustomFieldValue = (contact: Contact | undefined, fieldId: string): string => {
    if (!contact?.custom_fields) return "";
    const customFields = contact.custom_fields;
    let fieldsArray: Array<{ id: string; value: string }> | null = null;

    if (Array.isArray(customFields)) {
      fieldsArray = customFields as Array<{ id: string; value: string }>;
    } else if (typeof customFields === "object") {
      fieldsArray = Object.values(customFields as Record<string, { id: string; value: string }>);
    }

    if (!fieldsArray || !Array.isArray(fieldsArray)) return "";
    const field = fieldsArray.find((f) => f.id === fieldId);
    return field?.value || "";
  };

  // CSV download function
  const downloadCSV = () => {
    const headers = [
      "Name",
      "Pipeline",
      "Stage",
      "Value",
      "Status",
      "Contact Name",
      "Phone",
      "Email",
      "Address",
      "Scope of Work",
      "Sales Rep",
      "Contact Created",
      "Latest Appointment",
    ];

    const rows = filteredAndSortedOpportunities.map((opp) => {
      const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
      const oppAppointments = opp.contact_id ? appointmentsByContact.get(opp.contact_id) || [] : [];
      const latestAppt =
        oppAppointments.length > 0
          ? oppAppointments.sort(
              (a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime(),
            )[0]
          : null;
      const salesRepName = latestAppt?.assigned_user_id
        ? userMap.get(latestAppt.assigned_user_id)
        : opp.assigned_to
          ? userMap.get(opp.assigned_to)
          : "";
      const contactDate = contact?.ghl_date_added || opp.ghl_date_added;

      const address = getCustomFieldValue(contact, "b7oTVsUQrLgZt84bHpCn");
      const scopeOfWork = getCustomFieldValue(contact, "KwQRtJT0aMSHnq3mwR68");
      const contactName =
        contact?.contact_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "";

      return [
        opp.name || "",
        opp.pipeline_name || "",
        opp.stage_name || "",
        opp.monetary_value?.toString() || "",
        opp.status || "",
        contactName,
        contact?.phone || "",
        contact?.email || "",
        address,
        scopeOfWork,
        salesRepName || "",
        contactDate ? new Date(contactDate).toLocaleDateString() : "",
        latestAppt?.start_time ? new Date(latestAppt.start_time).toLocaleString() : "",
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join(
      "\n",
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `opportunities_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Pagination calculations
  const totalItems = filteredAndSortedOpportunities.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOpportunities = filteredAndSortedOpportunities.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lost":
      case "abandoned":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  const handleRowClick = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setSheetOpen(true);
  };

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1);

    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "value" || column === "createdDate" || column === "updatedDate" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Opportunities</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Range Filter for Table */}
            <div className="flex items-center gap-1">
              <Select value={tableDateField} onValueChange={(v) => { setTableDateField(v as "updatedDate" | "createdDate"); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="updatedDate">Last Edited</SelectItem>
                  <SelectItem value="createdDate">Contact Created</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarIcon className="h-3 w-3" />
                    {tableDateRange?.from ? (
                      tableDateRange.to && tableDateRange.from.toDateString() !== tableDateRange.to.toDateString() ? (
                        <span>{format(tableDateRange.from, "MMM d")} - {format(tableDateRange.to, "MMM d")}</span>
                      ) : (
                        <span>{format(tableDateRange.from, "MMM d, yyyy")}</span>
                      )
                    ) : (
                      <span>Pick date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={tableDateRange?.from}
                    selected={tableDateRange}
                    onSelect={(range) => { setTableDateRange(range); setCurrentPage(1); }}
                    numberOfMonths={2}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {tableDateRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                  onClick={() => { setTableDateRange(undefined); setCurrentPage(1); }}
                >
                  ×
                </Button>
              )}
            </div>
            <Select value={appointmentFilter} onValueChange={handleAppointmentFilterChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-background border-border">
                <SelectValue placeholder="Filter by appointment" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Opportunities</SelectItem>
                <SelectItem value="with">With Appointments</SelectItem>
                <SelectItem value="without">Without Appointments</SelectItem>
              </SelectContent>
            </Select>
            <MultiSelectFilter
              options={stageOptions}
              selected={stageFilter}
              onChange={handleStageFilterChange}
              placeholder="All Stages"
            />
            <MultiSelectFilter
              options={sourceOptions}
              selected={sourceFilter}
              onChange={handleSourceFilterChange}
              placeholder="All Sources"
            />
            <MultiSelectFilter
              options={salesRepOptions}
              selected={salesRepFilter}
              onChange={handleSalesRepFilterChange}
              placeholder="All Sales Reps"
              icon={<User className="h-3 w-3" />}
            />
            {(stageFilter.length > 0 || sourceFilter.length > 0 || appointmentFilter !== "all" || salesRepFilter.length > 0 || tableDateRange) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStageFilter([]);
                  setSourceFilter([]);
                  setAppointmentFilter("all");
                  setSalesRepFilter([]);
                  setTableDateRange(undefined);
                  setCurrentPage(1);
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto scrollbar-styled pb-2">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Name
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("stage")}
                >
                  <div className="flex items-center">
                    Pipeline/Stage
                    <SortIcon column="stage" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("source")}
                >
                  <div className="flex items-center">
                    Source
                    <SortIcon column="source" />
                  </div>
                </TableHead>

                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("value")}
                >
                  <div className="flex items-center">
                    Value
                    <SortIcon column="value" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("createdDate")}
                >
                  <div className="flex items-center">
                    Contact Created
                    <SortIcon column="createdDate" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("updatedDate")}
                >
                  <div className="flex items-center">
                    Last Edited
                    <SortIcon column="updatedDate" />
                  </div>
                </TableHead>

                <TableHead className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last Appointment
                  </div>
                </TableHead>
                <TableHead className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Sales Rep
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No opportunities found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOpportunities.map((opp) => {
                  const oppAppointments = opp.contact_id ? appointmentsByContact.get(opp.contact_id) || [] : [];
                  const latestAppt =
                    oppAppointments.length > 0
                      ? oppAppointments.sort(
                          (a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime(),
                        )[0]
                      : null;
                  const salesRepName = latestAppt?.assigned_user_id ? userMap.get(latestAppt.assigned_user_id) : null;
                  const contact = opp.contact_id ? contactMap.get(opp.contact_id) : null;
                  const contactDate = contact?.ghl_date_added || opp.ghl_date_added;

                  return (
                    <TableRow
                      key={opp.ghl_id}
                      className="border-border/30 hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleRowClick(opp)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {opp.contact_id && contactsWithAppointments.has(opp.contact_id) ? (
                            <span title="Has appointment">
                              <CalendarCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            </span>
                          ) : (
                            <span title="No appointment">
                              <CalendarX className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                            </span>
                          )}
                          <span>{opp.name || "Unnamed"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {opp.pipeline_name && opp.stage_name
                          ? `${opp.pipeline_name} / ${opp.stage_name}`
                          : opp.stage_name || opp.pipeline_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{contact?.source || "-"}</TableCell>

                      <TableCell className="font-mono text-emerald-400">{formatCurrency(opp.monetary_value)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(opp.status)}>
                          {opp.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contactDate ? new Date(contactDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {opp.ghl_date_updated ? new Date(opp.ghl_date_updated).toLocaleDateString() : "-"}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {latestAppt ? (
                          <div className="flex flex-col">
                            <span>{formatAppointmentDateTime(latestAppt.start_time)}</span>
                            {oppAppointments.length > 1 && (
                              <span className="text-xs text-muted-foreground/70">
                                +{oppAppointments.length - 1} more
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{salesRepName || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        conversations={conversations}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allOpportunities={opportunities}
      />
    </>
  );
}
