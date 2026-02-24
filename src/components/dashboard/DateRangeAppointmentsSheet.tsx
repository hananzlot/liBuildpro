import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarCheck,
  MapPin,
  User,
  Phone,
  Clock,
  Search,
  Target,
  Mail,
  Pencil,
  Check,
  X,
  Loader2,
  Copy,
  FileText,
  LayoutGrid,
  List,
  Download,
  ChevronUp,
  ChevronDown,
  
} from "lucide-react";
import { format } from "date-fns";
import { getAddressFromContact } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";

interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  address?: string | null;
  ghl_date_added?: string | null;
  created_at?: string | null;
  entered_by?: string | null;
}

interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  custom_fields: unknown;
}

interface DBUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DBOpportunity {
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id?: string | null;
  pipeline_stage_id?: string | null;
  monetary_value: number | null;
  name?: string | null;
  assigned_to?: string | null;
  ghl_date_added?: string | null;
  ghl_date_updated?: string | null;
  location_id?: string;
  won_at?: string | null;
  scope_of_work?: string | null;
  address?: string | null;
}

interface DBNote {
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
}

interface DBTask {
  contact_id: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface GroupedContactAppointments {
  contact_id: string;
  appointments: DBAppointment[];
  contact: DBContact | null;
  opportunity: DBOpportunity | null;
  note: DBNote | null;
  task: DBTask | null;
  latestAppointment: DBAppointment;
}

interface DBProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface DateRangeAppointmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: DBAppointment[];
  contacts: DBContact[];
  users: DBUser[];
  opportunities?: DBOpportunity[];
  profiles?: DBProfile[];
  onAppointmentClick?: (appointment: DBAppointment) => void;
  defaultStatusFilter?: string; // e.g., "showed" to filter only showed appointments
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function stripHtmlTags(html: string): string {
  // Create a temporary element to parse HTML and extract text
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function DateRangeAppointmentsSheet({
  open,
  onOpenChange,
  appointments,
  contacts,
  users,
  opportunities = [],
  profiles = [],
  onAppointmentClick,
  defaultStatusFilter,
}: DateRangeAppointmentsSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter || "all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressValue, setEditAddressValue] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [localAddressState, setLocalAddressState] = useState<Record<string, string>>({});
  
  // Created date editing state
  const [editingCreatedDateId, setEditingCreatedDateId] = useState<string | null>(null);
  const [editCreatedDateValue, setEditCreatedDateValue] = useState("");
  const [isSavingCreatedDate, setIsSavingCreatedDate] = useState(false);
  const [localCreatedDateState, setLocalCreatedDateState] = useState<Record<string, string>>({});
  
  // Opportunity detail sheet state
  const [selectedOpportunity, setSelectedOpportunity] = useState<DBOpportunity | null>(null);
  const [oppDetailSheetOpen, setOppDetailSheetOpen] = useState(false);
  
  // Sorting state
  type SortColumn = "contact" | "title" | "status" | "scheduled" | "assigned" | "oppStatus" | "stage" | "value" | "noteDate" | "taskDate" | "createdOn" | "source" | "createdBy";
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultStatusFilter === "showed" ? "scheduled" : "createdOn");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Notes and tasks data
  const [notesMap, setNotesMap] = useState<Map<string, DBNote>>(new Map());
  const [tasksMap, setTasksMap] = useState<Map<string, DBTask>>(new Map());
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  const { isAdmin } = useAuth();

  // Reset status filter when defaultStatusFilter changes or sheet opens
  useEffect(() => {
    if (open && defaultStatusFilter) {
      setStatusFilter(defaultStatusFilter);
    }
  }, [open, defaultStatusFilter]);

  const queryClient = useQueryClient();

  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    if (u.ghl_id) userMap.set(u.ghl_id, displayName);
    if (u.id) userMap.set(u.id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => {
    if (c.ghl_id) contactMap.set(c.ghl_id, c);
    contactMap.set(c.id, c);
  });

  // Create profile map (id -> profile)
  const profileMap = useMemo(() => {
    const map = new Map<string, DBProfile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Create opportunity map (contact key -> first opportunity for that contact)
  const opportunityMap = useMemo(() => {
    const map = new Map<string, DBOpportunity>();
    opportunities.forEach((opp) => {
      if (opp.contact_id && !map.has(opp.contact_id)) {
        map.set(opp.contact_id, opp);
      }
      if (opp.contact_uuid && !map.has(opp.contact_uuid)) {
        map.set(opp.contact_uuid, opp);
      }
    });
    return map;
  }, [opportunities]);

  // Fetch notes and tasks when sheet opens with showed filter
  useEffect(() => {
    if (!open || defaultStatusFilter !== "showed") return;
    
    const contactIds = Array.from(new Set(
      appointments
        .filter(apt => apt.appointment_status?.toLowerCase() === "showed")
        .map(apt => apt.contact_id || apt.contact_uuid)
        .filter(Boolean) as string[]
    ));

    if (contactIds.length === 0) return;

    const fetchNotesAndTasks = async () => {
      setIsLoadingExtra(true);
      try {
        // Fetch latest note for each contact
        const { data: notesData } = await supabase
          .from("contact_notes")
          .select("contact_id, body, ghl_date_added")
          .in("contact_id", contactIds)
          .order("ghl_date_added", { ascending: false });

        // Fetch latest task for each contact
        const { data: tasksData } = await supabase
          .from("ghl_tasks")
          .select("contact_id, title, body, created_at")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false });

        // Build maps with only the latest entry per contact
        const newNotesMap = new Map<string, DBNote>();
        notesData?.forEach(note => {
          if (!newNotesMap.has(note.contact_id)) {
            newNotesMap.set(note.contact_id, note);
          }
        });

        const newTasksMap = new Map<string, DBTask>();
        tasksData?.forEach(task => {
          if (!newTasksMap.has(task.contact_id)) {
            newTasksMap.set(task.contact_id, task);
          }
        });

        setNotesMap(newNotesMap);
        setTasksMap(newTasksMap);
      } catch (error) {
        console.error("Error fetching notes/tasks:", error);
      } finally {
        setIsLoadingExtra(false);
      }
    };

    fetchNotesAndTasks();
  }, [open, defaultStatusFilter, appointments]);

  // Format currency helper
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Download table as CSV
  const handleDownloadCSV = () => {
    const headers = [
      "Contact Name",
      "Phone",
      "Address",
      "Title/Scope",
      "Appt Status",
      "Scheduled Dates",
      "Source",
      "Assigned Rep",
      "Opp Status",
      "Pipeline Stage",
      "Value",
      "Last Note",
      "Last Task"
    ];

    const rows = sortedGroupedContacts.map(group => {
      const contact = group.contact;
      const salesPerson = group.latestAppointment.assigned_user_id 
        ? userMap.get(group.latestAppointment.assigned_user_id) 
        : null;
      const contactName = contact
        ? capitalizeWords(
            contact.contact_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
            "Unknown"
          )
        : "Unknown Contact";
      
      // Get scope of work
      const scopeOfWork = contact?.custom_fields && (() => {
        const fieldsArray = contact.custom_fields as Array<{ id: string; value: string }>;
        if (!Array.isArray(fieldsArray)) return null;
        const scopeField = fieldsArray.find(f => f.id === 'KwQRtJT0aMSHnq3mwR68');
        return scopeField?.value || null;
      })();

      // Combine all scheduled dates
      const scheduledDates = group.appointments
        .filter(apt => apt.start_time)
        .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
        .map(apt => format(new Date(apt.start_time!), "MMM d, yyyy h:mma"))
        .join("; ");

      // Get address from latest appointment or fallback from contact
      const address = group.latestAppointment.address 
        || getAddressFromContact(contact, appointments, group.latestAppointment.contact_id || group.latestAppointment.contact_uuid)
        || "";

      return [
        contactName,
        contact?.phone || "",
        address,
        group.latestAppointment.title || scopeOfWork || "",
        group.latestAppointment.appointment_status || "",
        scheduledDates,
        contact?.source || "",
        salesPerson || "",
        group.opportunity?.status || "",
        group.opportunity?.stage_name || "",
        group.opportunity?.monetary_value ? group.opportunity.monetary_value.toString() : "",
        // Merged note: date + content
        group.note 
          ? `${group.note.ghl_date_added ? format(new Date(group.note.ghl_date_added), "MMM d, yyyy") + ": " : ""}${stripHtmlTags(group.note.body || "").replace(/\n/g, " ")}`
          : "",
        // Merged task: date + title
        group.task
          ? `${group.task.created_at ? format(new Date(group.task.created_at), "MMM d, yyyy") + ": " : ""}${group.task.title || ""}`
          : ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `appointments-showed-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("CSV downloaded");
  };

  // Filter by status and apply search
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    
    // Apply status filter
    if (statusFilter === "showed") {
      filtered = appointments.filter((apt) => apt.appointment_status?.toLowerCase() === "showed");
    } else if (statusFilter === "all") {
      // Show all except cancelled
      filtered = appointments.filter((apt) => apt.appointment_status?.toLowerCase() !== "cancelled");
    } else if (statusFilter !== "all") {
      filtered = appointments.filter((apt) => apt.appointment_status?.toLowerCase() === statusFilter.toLowerCase());
    }

    if (!searchFilter.trim()) return filtered;

    const searchTerm = searchFilter.toLowerCase().trim();
    return filtered.filter((apt) => {
      const contact = (apt.contact_id && contactMap.get(apt.contact_id)) || (apt.contact_uuid && contactMap.get(apt.contact_uuid)) || null;
      const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
      const title = apt.title || "";
      const rep = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) || "" : "";
      
      return (
        contactName.toLowerCase().includes(searchTerm) ||
        title.toLowerCase().includes(searchTerm) ||
        rep.toLowerCase().includes(searchTerm)
      );
    });
  }, [appointments, searchFilter, statusFilter, contactMap, userMap]);

  // Group appointments by contact
  const groupedContacts = useMemo(() => {
    const groups = new Map<string, GroupedContactAppointments>();
    const noContactAppointments: GroupedContactAppointments[] = [];

    filteredAppointments.forEach((apt) => {
      const contactKey = apt.contact_id || apt.contact_uuid;

      if (!contactKey) {
        // Appointments without contact go as individual rows
        noContactAppointments.push({
          contact_id: apt.id, // Use apt.id as unique key
          appointments: [apt],
          contact: null,
          opportunity: null,
          note: null,
          task: null,
          latestAppointment: apt,
        });
        return;
      }

      if (groups.has(contactKey)) {
        const existing = groups.get(contactKey)!;
        existing.appointments.push(apt);
        // Update latestAppointment if this one is more recent
        if (apt.start_time && existing.latestAppointment.start_time) {
          if (new Date(apt.start_time) > new Date(existing.latestAppointment.start_time)) {
            existing.latestAppointment = apt;
          }
        }
      } else {
        groups.set(contactKey, {
          contact_id: contactKey,
          appointments: [apt],
          contact: contactMap.get(contactKey) || null,
          opportunity: opportunityMap.get(contactKey) || null,
          note: notesMap.get(contactKey) || null,
          task: tasksMap.get(contactKey) || null,
          latestAppointment: apt,
        });
      }
    });

    return [...groups.values(), ...noContactAppointments];
  }, [filteredAppointments, contactMap, opportunityMap, notesMap, tasksMap]);

  // Sort grouped contacts based on selected column
  const sortedGroupedContacts = useMemo(() => {
    return [...groupedContacts].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "contact": {
          const nameA = a.contact?.contact_name || `${a.contact?.first_name || ""} ${a.contact?.last_name || ""}`.trim() || "";
          const nameB = b.contact?.contact_name || `${b.contact?.first_name || ""} ${b.contact?.last_name || ""}`.trim() || "";
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "title": {
          const titleA = a.latestAppointment.title || "";
          const titleB = b.latestAppointment.title || "";
          comparison = titleA.localeCompare(titleB);
          break;
        }
        case "status": {
          const statusA = a.latestAppointment.appointment_status || "";
          const statusB = b.latestAppointment.appointment_status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        }
        case "scheduled": {
          // Use the most recent appointment date for sorting
          const dateA = a.latestAppointment.start_time ? new Date(a.latestAppointment.start_time).getTime() : 0;
          const dateB = b.latestAppointment.start_time ? new Date(b.latestAppointment.start_time).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "assigned": {
          const repA = a.latestAppointment.assigned_user_id ? userMap.get(a.latestAppointment.assigned_user_id) || "" : "";
          const repB = b.latestAppointment.assigned_user_id ? userMap.get(b.latestAppointment.assigned_user_id) || "" : "";
          comparison = repA.localeCompare(repB);
          break;
        }
        case "oppStatus": {
          const statusA = a.opportunity?.status || "";
          const statusB = b.opportunity?.status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        }
        case "stage": {
          const stageA = a.opportunity?.stage_name || "";
          const stageB = b.opportunity?.stage_name || "";
          comparison = stageA.localeCompare(stageB);
          break;
        }
        case "value": {
          const valueA = a.opportunity?.monetary_value || 0;
          const valueB = b.opportunity?.monetary_value || 0;
          comparison = valueA - valueB;
          break;
        }
        case "noteDate": {
          const dateA = a.note?.ghl_date_added ? new Date(a.note.ghl_date_added).getTime() : 0;
          const dateB = b.note?.ghl_date_added ? new Date(b.note.ghl_date_added).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "taskDate": {
          const dateA = a.task?.created_at ? new Date(a.task.created_at).getTime() : 0;
          const dateB = b.task?.created_at ? new Date(b.task.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "createdOn": {
          const dateA = a.latestAppointment.ghl_date_added || a.latestAppointment.created_at;
          const dateB = b.latestAppointment.ghl_date_added || b.latestAppointment.created_at;
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case "source": {
          const sourceA = a.contact?.source || "";
          const sourceB = b.contact?.source || "";
          comparison = sourceA.localeCompare(sourceB);
          break;
        }
        case "createdBy": {
          const getCreatorName = (apt: DBAppointment) => {
            if (!apt.entered_by) return "";
            const profile = profileMap.get(apt.entered_by);
            return profile?.full_name || profile?.email || "";
          };
          const creatorA = getCreatorName(a.latestAppointment);
          const creatorB = getCreatorName(b.latestAppointment);
          comparison = creatorA.localeCompare(creatorB);
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [groupedContacts, sortColumn, sortDirection, userMap, profileMap]);

  const startEditingAddress = (apt: DBAppointment, currentAddress: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(apt.ghl_id);
    setEditAddressValue(localAddressState[apt.ghl_id] ?? apt.address ?? currentAddress ?? "");
  };

  const cancelEditingAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(null);
    setEditAddressValue("");
  };

  const saveAddress = async (apt: DBAppointment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!apt.ghl_id) return;

    setIsSavingAddress(true);
    try {
      // Update in GHL
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: apt.ghl_id,
          address: editAddressValue.trim() || null,
        },
      });

      if (ghlError) throw ghlError;

      // Update local state for immediate feedback
      setLocalAddressState((prev) => ({ ...prev, [apt.ghl_id]: editAddressValue.trim() }));
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
      
      toast.success("Address updated");
      setEditingAddressId(null);
      setEditAddressValue("");
    } catch (error) {
      console.error("Error updating address:", error);
      toast.error("Failed to update address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Created date editing functions
  const startEditingCreatedDate = (apt: DBAppointment, e: React.MouseEvent) => {
    e.stopPropagation();
    const aptKey = apt.id;
    const currentDate = localCreatedDateState[aptKey] ?? apt.ghl_date_added ?? apt.created_at;
    const dateValue = currentDate ? format(new Date(currentDate), "yyyy-MM-dd'T'HH:mm") : "";
    setEditingCreatedDateId(aptKey);
    setEditCreatedDateValue(dateValue);
  };

  const cancelEditingCreatedDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCreatedDateId(null);
    setEditCreatedDateValue("");
  };

  const saveCreatedDate = async (apt: DBAppointment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editCreatedDateValue) return;

    setIsSavingCreatedDate(true);
    try {
      const newDate = new Date(editCreatedDateValue).toISOString();
      
      // Update in database using id (works for all appointment types)
      const { error } = await supabase
        .from("appointments")
        .update({ ghl_date_added: newDate, updated_at: new Date().toISOString() })
        .eq("id", apt.id);

      if (error) throw error;

      // Update local state for immediate feedback
      setLocalCreatedDateState((prev) => ({ ...prev, [apt.id]: newDate }));
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
      
      toast.success("Created date updated");
      setEditingCreatedDateId(null);
      setEditCreatedDateValue("");
    } catch (error) {
      console.error("Error updating created date:", error);
      toast.error("Failed to update created date");
    } finally {
      setIsSavingCreatedDate(false);
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-7xl p-0 flex flex-col">
        <div className="p-4 border-b">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              {defaultStatusFilter === "showed" 
                ? "Appointments Showed in Date Range" 
                : "Appointments Created in Date Range"}
            </SheetTitle>
            <SheetDescription>
              {sortedGroupedContacts.length} contacts ({filteredAppointments.length} appointments)
              {defaultStatusFilter === "showed" ? " (showed status, by scheduled date)" : " created (excluding cancelled)"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-2"
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-2"
                onClick={() => setViewMode("cards")}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, title, rep..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {defaultStatusFilter === "showed" && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleDownloadCSV}
                disabled={sortedGroupedContacts.length === 0}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {sortedGroupedContacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchFilter ? "No contacts match the search" : "No appointments found"}
            </p>
          ) : viewMode === "table" ? (
            // Table View
            <div className="p-4">
              {isLoadingExtra && defaultStatusFilter === "showed" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading notes & tasks...
                </div>
              )}
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="w-[12%] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("contact")}
                    >
                      <div className="flex items-center gap-1">
                        Contact
                        {sortColumn === "contact" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="w-[10%] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1">
                        Title / Scope
                        {sortColumn === "title" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="w-[7%] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortColumn === "status" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="w-[9%] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("scheduled")}
                    >
                      <div className="flex items-center gap-1">
                        Scheduled
                        {sortColumn === "scheduled" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    {defaultStatusFilter === "showed" && (
                      <>
                        <TableHead 
                          className="w-[7%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("value")}
                        >
                          <div className="flex items-center gap-1">
                            Value
                            {sortColumn === "value" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[16%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("noteDate")}
                        >
                          <div className="flex items-center gap-1">
                            Last Note
                            {sortColumn === "noteDate" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[15%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("taskDate")}
                        >
                          <div className="flex items-center gap-1">
                            Last Task
                            {sortColumn === "taskDate" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                      </>
                    )}
                    {defaultStatusFilter !== "showed" && (
                      <>
                        <TableHead 
                          className="w-[10%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("createdOn")}
                        >
                          <div className="flex items-center gap-1">
                            Created On
                            {sortColumn === "createdOn" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[10%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("source")}
                        >
                          <div className="flex items-center gap-1">
                            Lead Source
                            {sortColumn === "source" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[10%] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("createdBy")}
                        >
                          <div className="flex items-center gap-1">
                            Created By
                            {sortColumn === "createdBy" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedGroupedContacts.map((group) => {
                    const contact = group.contact;
                    const apt = group.latestAppointment;
                    const salesPerson = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) : null;
                    const contactName = contact
                      ? capitalizeWords(
                          contact.contact_name ||
                          `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                          "Unknown"
                        )
                      : "Unknown Contact";
                    
                    const statusColor = {
                      confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      showed: "bg-green-500/10 text-green-500 border-green-500/20",
                      "no show": "bg-red-500/10 text-red-500 border-red-500/20",
                      noshow: "bg-red-500/10 text-red-500 border-red-500/20",
                    }[apt.appointment_status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                    // Get scope of work
                    const scopeOfWork = contact?.custom_fields && (() => {
                      const fieldsArray = contact.custom_fields as Array<{ id: string; value: string }>;
                      if (!Array.isArray(fieldsArray)) return null;
                      const scopeField = fieldsArray.find(f => f.id === 'KwQRtJT0aMSHnq3mwR68');
                      return scopeField?.value || null;
                    })();

                    const opp = group.opportunity;
                    const note = group.note;
                    const task = group.task;

                    const oppStatusColor = {
                      open: "bg-blue-500/10 text-blue-500",
                      won: "bg-green-500/10 text-green-500",
                      lost: "bg-red-500/10 text-red-500",
                      abandoned: "bg-gray-500/10 text-gray-500",
                    }[opp?.status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                    // Sort appointments by date descending for display
                    const sortedDates = [...group.appointments]
                      .filter(a => a.start_time)
                      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime());

                    const handleRowClick = () => {
                      if (opp) {
                        setSelectedOpportunity(opp);
                        setOppDetailSheetOpen(true);
                      } else {
                        onAppointmentClick?.(apt);
                      }
                    };

                    return (
                      <TableRow 
                        key={group.contact_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={handleRowClick}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm line-clamp-2">{contactName}</span>
                            {contact?.phone && (
                              <div className="flex items-center gap-1">
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="text-xs text-primary hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const p = contact.phone?.trim();
                                    if (!p) return;
                                    const url = `tel:${p}`;
                                    const win = window.open(url, "_blank", "noopener,noreferrer");
                                    if (!win) window.location.href = url;
                                  }}
                                >
                                  {contact.phone}
                                </a>
                                <button
                                  className="text-muted-foreground hover:text-primary p-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(contact.phone!);
                                    toast.success("Phone copied");
                                  }}
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                              {salesPerson && (
                                <span><span className="font-bold text-foreground">Rep:</span> {salesPerson}</span>
                              )}
                              {defaultStatusFilter === "showed" && opp?.status && (
                                <span><span className="font-bold text-foreground">Opp:</span> <span className="capitalize">{opp.status}</span></span>
                              )}
                              {defaultStatusFilter === "showed" && opp?.stage_name && (
                                <span><span className="font-bold text-foreground">Stage:</span> {opp.stage_name}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs whitespace-normal break-words">{apt.title || "No title"}</span>
                            {scopeOfWork && (
                              <span className="text-xs text-muted-foreground whitespace-normal break-words">{scopeOfWork}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusColor} text-[10px] px-1.5 py-0.5`}>
                            {apt.appointment_status || "?"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex flex-col">
                            {sortedDates.slice(0, 2).map((a, idx) => (
                              <span key={a.id} className={`${idx === 0 ? "font-medium text-foreground" : ""}`}>
                                {format(new Date(a.start_time!), "MMM d, h:mma")}
                              </span>
                            ))}
                            {sortedDates.length > 2 && (
                              <span className="text-muted-foreground">+{sortedDates.length - 2} more</span>
                            )}
                            {sortedDates.length === 0 && "-"}
                          </div>
                        </TableCell>
                        {defaultStatusFilter === "showed" && (
                          <>
                            <TableCell className="text-xs font-medium">
                              {formatCurrency(opp?.monetary_value)}
                            </TableCell>
                            <TableCell>
                              {note ? (
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {note.ghl_date_added ? format(new Date(note.ghl_date_added), "MMM d") : ""}
                                  </span>
                                  <span className="text-xs whitespace-normal break-words">
                                    {stripHtmlTags(note.body || "-")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {task ? (
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {task.created_at ? format(new Date(task.created_at), "MMM d") : ""}
                                  </span>
                                  <span className="text-xs whitespace-normal break-words">
                                    {task.title || "-"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        {defaultStatusFilter !== "showed" && (
                          <>
                            <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                              {editingCreatedDateId === apt.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="datetime-local"
                                    value={editCreatedDateValue}
                                    onChange={(e) => setEditCreatedDateValue(e.target.value)}
                                    className="h-7 text-xs w-[160px]"
                                    autoFocus
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => saveCreatedDate(apt, e)}
                                    disabled={isSavingCreatedDate}
                                  >
                                    {isSavingCreatedDate ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3 text-green-500" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={cancelEditingCreatedDate}
                                    disabled={isSavingCreatedDate}
                                  >
                                    <X className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 group">
                                  <span>
                                    {(() => {
                                      const createdDate = localCreatedDateState[apt.id] ?? apt.ghl_date_added ?? apt.created_at;
                                      return createdDate 
                                        ? format(new Date(createdDate), "MMM d, yyyy h:mma")
                                        : "-";
                                    })()}
                                  </span>
                                  {isAdmin && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => startEditingCreatedDate(apt, e)}
                                    >
                                      <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="line-clamp-2">{contact?.source || "-"}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {(() => {
                                if (!apt.entered_by) return "-";
                                const profile = profileMap.get(apt.entered_by);
                                return profile?.full_name || profile?.email?.split("@")[0] || "-";
                              })()}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Card View
            <div className="p-4 space-y-3">
              {sortedGroupedContacts.map((group) => {
                const contact = group.contact;
                const apt = group.latestAppointment;
                const salesPerson = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) : null;
                const contactName = contact
                  ? capitalizeWords(
                      contact.contact_name ||
                      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                      "Unknown"
                    )
                  : "Unknown Contact";
                
                // Address: local state > appointment address > fallback from contact
                const fallbackAddress = getAddressFromContact(contact, appointments, apt.contact_id || apt.contact_uuid);
                const displayAddress = localAddressState[apt.ghl_id] ?? apt.address ?? fallbackAddress;
                const isEditingThis = editingAddressId === apt.ghl_id;

                const statusColor = {
                  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  showed: "bg-green-500/10 text-green-500 border-green-500/20",
                  "no show": "bg-red-500/10 text-red-500 border-red-500/20",
                  noshow: "bg-red-500/10 text-red-500 border-red-500/20",
                }[apt.appointment_status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                // Sort appointments by date descending for display
                const sortedDates = [...group.appointments]
                  .filter(a => a.start_time)
                  .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime());

                return (
                  <Card 
                    key={group.contact_id} 
                    className={`border-border/50 ${onAppointmentClick && !isEditingThis ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => !isEditingThis && onAppointmentClick?.(apt)}
                  >
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {contactName}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {apt.title || "No title"}
                          </p>
                          {/* Scope of Work */}
                          {contact?.custom_fields && (() => {
                            const fieldsArray = contact.custom_fields as Array<{ id: string; value: string }>;
                            if (!Array.isArray(fieldsArray)) return null;
                            const scopeField = fieldsArray.find(f => f.id === 'KwQRtJT0aMSHnq3mwR68');
                            if (scopeField?.value) {
                              return (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{scopeField.value}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <Badge className={statusColor}>
                          {apt.appointment_status || "Unknown"}
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 text-sm">
                        {/* Show all scheduled dates */}
                        {sortedDates.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5">
                              {sortedDates.map((a, idx) => (
                                <span key={a.id} className={idx === 0 ? "text-foreground" : "text-muted-foreground"}>
                                  {format(new Date(a.start_time!), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Address - editable */}
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          {isEditingThis ? (
                            <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editAddressValue}
                                onChange={(e) => setEditAddressValue(e.target.value)}
                                placeholder="Enter address..."
                                className="h-7 text-sm flex-1"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => saveAddress(apt, e)}
                                disabled={isSavingAddress}
                              >
                                {isSavingAddress ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEditingAddress}
                                disabled={isSavingAddress}
                              >
                                <X className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1 group">
                              <span className="text-foreground flex-1">
                                {displayAddress || <span className="text-muted-foreground italic">No address</span>}
                              </span>
                              {isAdmin && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => startEditingAddress(apt, fallbackAddress, e)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Phone - clickable */}
                        {contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a
                              href={`tel:${contact.phone}`}
                              className="text-primary hover:underline"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const p = contact.phone?.trim();
                                if (!p) return;
                                const url = `tel:${p}`;
                                const win = window.open(url, "_blank", "noopener,noreferrer");
                                if (!win) window.location.href = url;
                              }}
                            >
                              {contact.phone}
                            </a>
                            <button
                              className="text-muted-foreground hover:text-primary p-0.5"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(contact.phone!);
                                toast.success("Phone copied");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* Email - clickable */}
                        {contact?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a
                              href={`mailto:${contact.email}`}
                              target="_top"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.email}
                            </a>
                            <button
                              className="text-muted-foreground hover:text-primary p-0.5"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(contact.email!);
                                toast.success("Email copied");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <a
                              href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}&body=${encodeURIComponent(`Dear ${(contact.first_name || '').charAt(0).toUpperCase() + (contact.first_name || '').slice(1).toLowerCase()} ${(contact.last_name || '').charAt(0).toUpperCase() + (contact.last_name || '').slice(1).toLowerCase()},${displayAddress ? `\n${displayAddress}` : ''}\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary text-xs"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              (Gmail)
                            </a>
                          </div>
                        )}

                        {/* Source & Assigned To on same line */}
                        {(contact?.source || salesPerson) && (
                          <div className="flex items-center gap-4 flex-wrap">
                            {contact?.source && (
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-foreground capitalize">{contact.source}</span>
                              </div>
                            )}
                            {salesPerson && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-foreground">{salesPerson}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <OpportunityDetailSheet
      opportunity={selectedOpportunity as any}
      appointments={appointments as any}
      contacts={contacts as any}
      users={users as any}
      open={oppDetailSheetOpen}
      onOpenChange={setOppDetailSheetOpen}
      allOpportunities={opportunities as any}
    />
    </>
  );
}
