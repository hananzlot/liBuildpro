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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  address?: string | null;
  ghl_date_added?: string | null;
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
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DBOpportunity {
  ghl_id: string;
  contact_id: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  monetary_value: number | null;
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

interface DateRangeAppointmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: DBAppointment[];
  contacts: DBContact[];
  users: DBUser[];
  opportunities?: DBOpportunity[];
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

export function DateRangeAppointmentsSheet({
  open,
  onOpenChange,
  appointments,
  contacts,
  users,
  opportunities = [],
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
  
  // Sorting state
  type SortColumn = "contact" | "title" | "status" | "scheduled" | "assigned" | "oppStatus" | "stage" | "value" | "noteDate" | "taskDate";
  const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Notes and tasks data
  const [notesMap, setNotesMap] = useState<Map<string, DBNote>>(new Map());
  const [tasksMap, setTasksMap] = useState<Map<string, DBTask>>(new Map());
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

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
    userMap.set(u.ghl_id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => contactMap.set(c.ghl_id, c));

  // Create opportunity map (contact_id -> first opportunity for that contact)
  const opportunityMap = useMemo(() => {
    const map = new Map<string, DBOpportunity>();
    opportunities.forEach((opp) => {
      if (opp.contact_id && !map.has(opp.contact_id)) {
        map.set(opp.contact_id, opp);
      }
    });
    return map;
  }, [opportunities]);

  // Fetch notes and tasks when sheet opens with showed filter
  useEffect(() => {
    if (!open || defaultStatusFilter !== "showed") return;
    
    const contactIds = appointments
      .filter(apt => apt.appointment_status?.toLowerCase() === "showed" && apt.contact_id)
      .map(apt => apt.contact_id!)
      .filter((id, idx, arr) => arr.indexOf(id) === idx); // unique

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
      "Title/Scope",
      "Appt Status",
      "Created Date",
      "Scheduled Date",
      "Source",
      "Assigned Rep",
      "Opp Status",
      "Pipeline Stage",
      "Value",
      "Last Note Date",
      "Last Note Content",
      "Last Task Date",
      "Last Task Title"
    ];

    const rows = sortedAppointments.map(apt => {
      const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
      const salesPerson = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) : null;
      const contactName = contact
        ? capitalizeWords(
            contact.contact_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
            "Unknown"
          )
        : "Unknown Contact";
      
      const opp = apt.contact_id ? opportunityMap.get(apt.contact_id) : null;
      const note = apt.contact_id ? notesMap.get(apt.contact_id) : null;
      const task = apt.contact_id ? tasksMap.get(apt.contact_id) : null;

      // Get scope of work
      const scopeOfWork = contact?.custom_fields && (() => {
        const fieldsArray = contact.custom_fields as Array<{ id: string; value: string }>;
        if (!Array.isArray(fieldsArray)) return null;
        const scopeField = fieldsArray.find(f => f.id === 'KwQRtJT0aMSHnq3mwR68');
        return scopeField?.value || null;
      })();

      return [
        contactName,
        contact?.phone || "",
        apt.title || scopeOfWork || "",
        apt.appointment_status || "",
        apt.ghl_date_added ? format(new Date(apt.ghl_date_added), "MMM d, yyyy") : "",
        apt.start_time ? format(new Date(apt.start_time), "MMM d, yyyy h:mma") : "",
        contact?.source || "",
        salesPerson || "",
        opp?.status || "",
        opp?.stage_name || "",
        opp?.monetary_value ? opp.monetary_value.toString() : "",
        note?.ghl_date_added ? format(new Date(note.ghl_date_added), "MMM d, yyyy") : "",
        (note?.body || "").replace(/\n/g, " "),
        task?.created_at ? format(new Date(task.created_at), "MMM d, yyyy") : "",
        task?.title || ""
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
      const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
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

  // Sort appointments based on selected column
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      const contactA = a.contact_id ? contactMap.get(a.contact_id) : null;
      const contactB = b.contact_id ? contactMap.get(b.contact_id) : null;
      const oppA = a.contact_id ? opportunityMap.get(a.contact_id) : null;
      const oppB = b.contact_id ? opportunityMap.get(b.contact_id) : null;
      const noteA = a.contact_id ? notesMap.get(a.contact_id) : null;
      const noteB = b.contact_id ? notesMap.get(b.contact_id) : null;
      const taskA = a.contact_id ? tasksMap.get(a.contact_id) : null;
      const taskB = b.contact_id ? tasksMap.get(b.contact_id) : null;

      let comparison = 0;

      switch (sortColumn) {
        case "contact": {
          const nameA = contactA?.contact_name || `${contactA?.first_name || ""} ${contactA?.last_name || ""}`.trim() || "";
          const nameB = contactB?.contact_name || `${contactB?.first_name || ""} ${contactB?.last_name || ""}`.trim() || "";
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "title": {
          const titleA = a.title || "";
          const titleB = b.title || "";
          comparison = titleA.localeCompare(titleB);
          break;
        }
        case "status": {
          const statusA = a.appointment_status || "";
          const statusB = b.appointment_status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        }
        case "scheduled": {
          const dateA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const dateB = b.start_time ? new Date(b.start_time).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "assigned": {
          const repA = a.assigned_user_id ? userMap.get(a.assigned_user_id) || "" : "";
          const repB = b.assigned_user_id ? userMap.get(b.assigned_user_id) || "" : "";
          comparison = repA.localeCompare(repB);
          break;
        }
        case "oppStatus": {
          const statusA = oppA?.status || "";
          const statusB = oppB?.status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        }
        case "stage": {
          const stageA = oppA?.stage_name || "";
          const stageB = oppB?.stage_name || "";
          comparison = stageA.localeCompare(stageB);
          break;
        }
        case "value": {
          const valueA = oppA?.monetary_value || 0;
          const valueB = oppB?.monetary_value || 0;
          comparison = valueA - valueB;
          break;
        }
        case "noteDate": {
          const dateA = noteA?.ghl_date_added ? new Date(noteA.ghl_date_added).getTime() : 0;
          const dateB = noteB?.ghl_date_added ? new Date(noteB.ghl_date_added).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "taskDate": {
          const dateA = taskA?.created_at ? new Date(taskA.created_at).getTime() : 0;
          const dateB = taskB?.created_at ? new Date(taskB.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredAppointments, sortColumn, sortDirection, contactMap, opportunityMap, notesMap, tasksMap, userMap]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col">
        <div className="p-4 border-b">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              {defaultStatusFilter === "showed" 
                ? "Appointments Showed in Date Range" 
                : "Appointments Created in Date Range"}
            </SheetTitle>
            <SheetDescription>
              {sortedAppointments.length} appointments 
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
                disabled={sortedAppointments.length === 0}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {sortedAppointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchFilter ? "No appointments match the search" : "No appointments found"}
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
              <Table className="min-w-[1800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="min-w-[140px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("contact")}
                    >
                      <div className="flex items-center gap-1">
                        Contact
                        {sortColumn === "contact" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1">
                        Title / Scope
                        {sortColumn === "title" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="min-w-[70px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Appt Status
                        {sortColumn === "status" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="min-w-[80px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("scheduled")}
                    >
                      <div className="flex items-center gap-1">
                        Scheduled
                        {sortColumn === "scheduled" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="min-w-[80px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("assigned")}
                    >
                      <div className="flex items-center gap-1">
                        Assigned
                        {sortColumn === "assigned" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    {defaultStatusFilter === "showed" && (
                      <>
                        <TableHead 
                          className="min-w-[70px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("oppStatus")}
                        >
                          <div className="flex items-center gap-1">
                            Opp Status
                            {sortColumn === "oppStatus" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("stage")}
                        >
                          <div className="flex items-center gap-1">
                            Pipeline Stage
                            {sortColumn === "stage" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[90px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("value")}
                        >
                          <div className="flex items-center gap-1">
                            Value
                            {sortColumn === "value" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[180px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("noteDate")}
                        >
                          <div className="flex items-center gap-1">
                            Last Note
                            {sortColumn === "noteDate" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[180px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("taskDate")}
                        >
                          <div className="flex items-center gap-1">
                            Last Task
                            {sortColumn === "taskDate" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </div>
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAppointments.map((apt) => {
                    const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
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

                    // Get opportunity, note, task for this contact
                    const opp = apt.contact_id ? opportunityMap.get(apt.contact_id) : null;
                    const note = apt.contact_id ? notesMap.get(apt.contact_id) : null;
                    const task = apt.contact_id ? tasksMap.get(apt.contact_id) : null;

                    const oppStatusColor = {
                      open: "bg-blue-500/10 text-blue-500",
                      won: "bg-green-500/10 text-green-500",
                      lost: "bg-red-500/10 text-red-500",
                      abandoned: "bg-gray-500/10 text-gray-500",
                    }[opp?.status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                    return (
                      <TableRow 
                        key={apt.id}
                        className={onAppointmentClick ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => onAppointmentClick?.(apt)}
                      >
                        <TableCell className="max-w-[140px]">
                          <div className="flex flex-col">
                            <span className="font-medium truncate">{contactName}</span>
                            {contact?.phone && (
                              <div className="flex items-center gap-1">
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="text-xs text-primary hover:underline truncate"
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
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[120px]">
                          <div className="flex flex-col">
                            <span className="truncate text-xs">{apt.title || "No title"}</span>
                            {scopeOfWork && (
                              <span className="text-xs text-muted-foreground truncate">{scopeOfWork}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusColor} text-xs whitespace-nowrap`}>
                            {apt.appointment_status || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {apt.start_time ? format(new Date(apt.start_time), "MMM d, h:mma") : "-"}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[80px]">
                          {salesPerson || "-"}
                        </TableCell>
                        {defaultStatusFilter === "showed" && (
                          <>
                            <TableCell>
                              {opp?.status ? (
                                <Badge className={`${oppStatusColor} text-xs capitalize`}>
                                  {opp.status}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs truncate max-w-[100px]">
                              {opp?.stage_name || "-"}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {formatCurrency(opp?.monetary_value)}
                            </TableCell>
                            <TableCell className="max-w-[180px]">
                              {note ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {note.ghl_date_added ? format(new Date(note.ghl_date_added), "MMM d, yyyy") : ""}
                                  </span>
                                  <span className="text-xs whitespace-pre-wrap break-words">
                                    {note.body || "-"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[180px]">
                              {task ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {task.created_at ? format(new Date(task.created_at), "MMM d, yyyy") : ""}
                                  </span>
                                  <span className="text-xs whitespace-pre-wrap break-words">
                                    {task.title || "-"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
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
              {sortedAppointments.map((apt) => {
                const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
                const salesPerson = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) : null;
                const contactName = contact
                  ? capitalizeWords(
                      contact.contact_name ||
                      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                      "Unknown"
                    )
                  : "Unknown Contact";
                
                // Address: local state > appointment address > fallback from contact
                const fallbackAddress = getAddressFromContact(contact, appointments, apt.contact_id);
                const displayAddress = localAddressState[apt.ghl_id] ?? apt.address ?? fallbackAddress;
                const isEditingThis = editingAddressId === apt.ghl_id;

                const statusColor = {
                  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  showed: "bg-green-500/10 text-green-500 border-green-500/20",
                  "no show": "bg-red-500/10 text-red-500 border-red-500/20",
                  noshow: "bg-red-500/10 text-red-500 border-red-500/20",
                }[apt.appointment_status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                return (
                  <Card 
                    key={apt.id} 
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
                        {apt.ghl_date_added && (
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              Created {format(new Date(apt.ghl_date_added), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                        )}

                        {apt.start_time && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              Scheduled {format(new Date(apt.start_time), "MMM d, yyyy 'at' h:mm a")}
                            </span>
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
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => startEditingAddress(apt, fallbackAddress, e)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
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
  );
}
