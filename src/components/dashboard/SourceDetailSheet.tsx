import { useState, useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, User, Calendar, Search, ChevronRight, Clock, Plus, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { findContactByIdOrGhlId } from "@/lib/utils";

// Helper to get PST/PDT offset in hours (uses UTC methods for correctness)
const getPSTOffset = (utcDate: Date): number => {
  // DST in US: second Sunday of March to first Sunday of November
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10)); // 2 AM PST = 10 AM UTC
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9)); // 2 AM PDT = 9 AM UTC
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8; // PDT is UTC-7, PST is UTC-8
};

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  ghl_date_added: string | null;
  custom_fields?: unknown;
  assigned_to?: string | null;
  attributions?: unknown;
  tags?: string[] | null;
  location_id?: string;
}

interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
}

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

// Import is already at top - use findContactByIdOrGhlId from utils

type ViewMode = "opportunities" | "won";

interface SourceDetailSheetProps {
  source: string | null;
  mode: ViewMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  filteredContacts: Contact[];
  opportunities: Opportunity[];
  filteredOpportunities: Opportunity[];
  appointments: Appointment[];
  filteredAppointments: Appointment[];
  users: GHLUser[];
  showAppointments?: boolean;
  showNoAppointments?: boolean;
  userId?: string | null;
}

export function SourceDetailSheet({
  source,
  mode,
  open,
  onOpenChange,
  contacts,
  filteredContacts,
  opportunities,
  filteredOpportunities,
  appointments,
  filteredAppointments,
  users,
  showAppointments = false,
  showNoAppointments = false,
  userId,
}: SourceDetailSheetProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [oppSheetOpen, setOppSheetOpen] = useState(false);
  
  // Task creation state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskOpp, setTaskOpp] = useState<Opportunity | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Reset filters when sheet opens - default to "all" status
  useEffect(() => {
    if (open) {
      setStatusFilter("all");
      setStageFilter("all");
      setSearchFilter("");
    }
  }, [open]);

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
      case "won": return "bg-emerald-500/20 text-emerald-400";
      case "lost":
      case "abandoned": return "bg-red-500/20 text-red-400";
      case "open": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const openTaskDialog = (opp: Opportunity, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskOpp(opp);
    const contact = findContactByIdOrGhlId(contacts, undefined, opp.contact_id);
    const contactName = contact?.contact_name || 
      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "";
    setTaskTitle(`Follow up: ${opp.name || contactName || "Opportunity"}`);
    setTaskNotes("");
    setTaskAssignee(opp.assigned_to || "__unassigned__");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!taskOpp || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsCreatingTask(true);
    try {
      // Get location_id from contact
      const contact = findContactByIdOrGhlId(contacts, undefined, taskOpp.contact_id);
      const locationId = contact?.location_id || "pVeFrqvtYWNIPRIi0Fmr";

      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;
      
      // Combine date and time, treating input as PST
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        // Treat input as PST: parse as UTC first, then add PST offset to get actual UTC
        const pstOffset = getPSTOffset(new Date(`${taskDueDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${taskDueDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      // Create task in GHL (edge function will also insert into ghl_tasks)
      const ghlResponse = await supabase.functions.invoke('create-ghl-task', {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateValue,
          assignedTo: assignedToValue,
          contactId: taskOpp.contact_id,
          locationId: locationId,
          enteredBy: userId || null,
        }
      });

      if (ghlResponse.error) {
        console.error('GHL sync error:', ghlResponse.error);
        toast.error("Failed to create task");
      } else {
        console.log('Task synced to GHL:', ghlResponse.data);
        toast.success("Task created and synced to GHL");
      }

      setTaskDialogOpen(false);
      setTaskOpp(null);
      setTaskTitle("");
      setTaskNotes("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskDueTime("");
    } catch (err) {
      console.error("Error creating task:", err);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Helper to normalize source names (same logic as in useGHLContacts)
  const normalizeSourceName = (sourceName: string): string => {
    if (!sourceName) return "Direct";
    return sourceName
      .toLowerCase()
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get contacts for this source within the date range (normalized matching)
  const sourceContactsInDateRange = useMemo(() => {
    return filteredContacts.filter(c => normalizeSourceName(c.source || "Direct") === source);
  }, [filteredContacts, source]);

  const sourceContactIdsInDateRange = useMemo(() => {
    // For "won" mode, get contact IDs from won opportunities that match this source
    // This ensures we show won opportunities even if the contact was added before the date range
    if (mode === "won") {
      const contactIdsFromWonOpps = new Set(
        filteredOpportunities
          .filter(o => o.status?.toLowerCase() === "won")
          .map(o => o.contact_id)
          .filter(Boolean) as string[]
      );
      const matchingContactIds = new Set<string>();
      contacts.forEach(c => {
        if (contactIdsFromWonOpps.has(c.ghl_id) && normalizeSourceName(c.source || "Direct") === source) {
          matchingContactIds.add(c.ghl_id);
        }
      });
      return matchingContactIds;
    }
    // For opportunities mode, use contacts filtered by date range
    return new Set(sourceContactsInDateRange.map(c => c.ghl_id));
  }, [mode, filteredOpportunities, contacts, source, sourceContactsInDateRange]);

  // Keep all contacts for "No Appointments" check (need to know if contact EVER had appointments)
  const allSourceContacts = useMemo(() => {
    return contacts.filter(c => normalizeSourceName(c.source || "Direct") === source);
  }, [contacts, source]);

  const allSourceContactIds = useMemo(() => {
    return new Set(allSourceContacts.map(c => c.ghl_id));
  }, [allSourceContacts]);

  // Get appointments for this source - match appointments by contact AND by start_time within date range
  // Use ALL appointments (not just filteredAppointments) and filter by contact in source
  const sourceAppointments = useMemo(() => {
    // Include appointments where the contact is from this source
    return appointments
      .filter(a => a.contact_id && sourceContactIdsInDateRange.has(a.contact_id))
      .filter(a => a.appointment_status?.toLowerCase() !== 'cancelled');
  }, [appointments, sourceContactIdsInDateRange]);

  // Get contact IDs that have appointments (for "Appointments" view - use filtered)
  const contactIdsWithFilteredAppointments = useMemo(() => {
    return new Set(sourceAppointments.map(a => a.contact_id).filter(Boolean));
  }, [sourceAppointments]);

  // Get contact IDs that have ANY appointments ever (for "No Appointments" view - use all appointments)
  const contactIdsWithAnyAppointments = useMemo(() => {
    const ids = new Set<string>();
    appointments
      .filter(a => a.appointment_status?.toLowerCase() !== 'cancelled')
      .forEach(a => {
        if (a.contact_id) ids.add(a.contact_id);
      });
    return ids;
  }, [appointments]);

  // Get opportunities for this source (use filtered opportunities, filtered by contacts in date range)
  const sourceOpportunities = useMemo(() => {
    return filteredOpportunities
      .filter(o => o.contact_id && sourceContactIdsInDateRange.has(o.contact_id))
      .filter(o => o.stage_name?.toLowerCase() !== 'quickbase');
  }, [filteredOpportunities, sourceContactIdsInDateRange]);

  // Unique appointments count (unique by appointment ghl_id)
  const uniqueAppointmentsCount = useMemo(() => {
    const uniqueIds = new Set(sourceAppointments.map(a => a.ghl_id));
    return uniqueIds.size;
  }, [sourceAppointments]);


  // Filter based on mode and search
  const displayOpportunities = useMemo(() => {
    let opps = sourceOpportunities;
    
    // When viewing appointments tab, only show contacts that have appointments (in date range)
    if (showAppointments) {
      opps = opps.filter(o => o.contact_id && contactIdsWithFilteredAppointments.has(o.contact_id));
    }
    
    // When viewing no appointments tab, only show contacts WITHOUT ANY appointments ever
    if (showNoAppointments) {
      opps = opps.filter(o => o.contact_id && !contactIdsWithAnyAppointments.has(o.contact_id));
    }
    
    if (mode === "won") {
      opps = opps.filter(o => o.status?.toLowerCase() === "won");
    }
    
    if (statusFilter !== "all") {
      opps = opps.filter(o => o.status?.toLowerCase() === statusFilter);
    }

    if (stageFilter !== "all") {
      opps = opps.filter(o => o.stage_name === stageFilter);
    }
    
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      opps = opps.filter(o => {
        const contact = findContactByIdOrGhlId(contacts, undefined, o.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return o.name?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }
    
    // Sort based on selected option
    return opps.sort((a, b) => {
      switch (sortBy) {
        case "stage":
          return (a.stage_name || "").localeCompare(b.stage_name || "");
        case "value":
          return (b.monetary_value || 0) - (a.monetary_value || 0);
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "date":
        default:
          return new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime();
      }
    });
  }, [sourceOpportunities, mode, statusFilter, stageFilter, sortBy, searchFilter, contacts, showAppointments, showNoAppointments, contactIdsWithFilteredAppointments, contactIdsWithAnyAppointments]);

  // Available statuses - "open" first, then alphabetically
  const availableStatuses = useMemo(() => {
    const statuses = new Set(sourceOpportunities.map(o => o.status?.toLowerCase() || "unknown"));
    return Array.from(statuses).sort((a, b) => {
      if (a === "open") return -1;
      if (b === "open") return 1;
      return a.localeCompare(b);
    });
  }, [sourceOpportunities]);

  // Available stages
  const availableStages = useMemo(() => {
    const stages = new Set(sourceOpportunities.map(o => o.stage_name).filter(Boolean) as string[]);
    return Array.from(stages).sort();
  }, [sourceOpportunities]);

  // Totals
  const totalValue = displayOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const wonValue = sourceOpportunities
    .filter(o => o.status?.toLowerCase() === "won")
    .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  const handleOpportunityClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setOppSheetOpen(true);
  };

  if (!source) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg">{source}</SheetTitle>
                  <SheetDescription>
                    {showAppointments 
                      ? `${uniqueAppointmentsCount} unique appointments scheduled`
                      : showNoAppointments
                        ? `${displayOpportunities.length} opportunities without appointments`
                        : mode === "opportunities" 
                          ? `${sourceOpportunities.length} opportunities • ${sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length} won`
                          : `${displayOpportunities.length} won • ${formatCurrency(wonValue)}`
                    }
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-4 space-y-3">
            {/* Compact Summary Stats */}
            {showAppointments ? (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Appointments: </span>
                  <span className="font-medium">{uniqueAppointmentsCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contacts: </span>
                  <span className="font-medium">{new Set(sourceAppointments.map(a => a.contact_id)).size}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                <button
                  onClick={() => { setStatusFilter("all"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "all" && stageFilter === "all" ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">All: </span>
                  <span className="font-medium">{sourceOpportunities.length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("open"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "open" ? "bg-blue-500/20 text-blue-400" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Open: </span>
                  <span className="font-medium">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "open").length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("all"); setStageFilter("no contact"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${stageFilter === "no contact" ? "bg-amber-500/20 text-amber-400" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">No Contact: </span>
                  <span className="font-medium text-amber-400">{sourceOpportunities.filter(o => o.stage_name?.toLowerCase().includes("no contact") || o.stage_name?.toLowerCase().includes("not contacted")).length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("all"); setStageFilter("no answer"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${stageFilter === "no answer" ? "bg-amber-500/20 text-amber-400" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">No Answer: </span>
                  <span className="font-medium text-amber-400">{sourceOpportunities.filter(o => o.stage_name?.toLowerCase().includes("no answer") || o.stage_name?.toLowerCase().includes("never answer")).length}</span>
                </button>
                <div className="px-2 py-0.5">
                  <span className="text-muted-foreground">Appointments: </span>
                  <span className="font-medium">{uniqueAppointmentsCount}</span>
                </div>
                <button
                  onClick={() => { setStatusFilter("lost"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "lost" ? "bg-red-500/20 text-red-400" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Lost: </span>
                  <span className="font-medium text-red-400">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "lost").length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("won"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "won" ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Won: </span>
                  <span className="font-medium text-emerald-400">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length}</span>
                </button>
                <div className="px-2 py-0.5">
                  <span className="text-muted-foreground">Won Value: </span>
                  <span className="font-medium text-emerald-400">{formatCurrency(wonValue)}</span>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {mode === "opportunities" && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {availableStatuses.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {availableStages.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="stage">By Stage</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="value">By Value</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Opportunities List */}
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-2">
                {displayOpportunities.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No {mode === "won" ? "won opportunities" : "opportunities"} found
                  </p>
                ) : (
                  displayOpportunities.map((opp) => {
                    const contact = findContactByIdOrGhlId(contacts, undefined, opp.contact_id);
                    const contactName = contact?.contact_name || 
                      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "Unknown";
                    
                    // Get all appointments for this contact, sorted by date (newest first)
                    const contactAppointments = appointments
                      .filter(a => a.contact_id === opp.contact_id && a.start_time)
                      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime());
                    
                    // Find upcoming appointment (today or future)
                    const now = new Date();
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const upcomingAppt = contactAppointments.find(a => 
                      new Date(a.start_time!) >= startOfToday
                    );

                    const getApptStatusColor = (status: string | null) => {
                      switch (status?.toLowerCase()) {
                        case "showed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                        case "confirmed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
                        case "no show":
                        case "noshow":
                        case "cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
                        default: return "bg-muted text-muted-foreground";
                      }
                    };
                    
                    return (
                      <div
                        key={opp.ghl_id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleOpportunityClick(opp)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{opp.name || "Unnamed"}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                              {opp.status || "Unknown"}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        {/* Pipeline Stage and Sales Rep */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {opp.stage_name && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              {opp.stage_name}
                            </Badge>
                          )}
                          {(() => {
                            const assignedUser = users.find(u => u.ghl_id === opp.assigned_to);
                            const repName = assignedUser?.name || 
                              (assignedUser?.first_name && assignedUser?.last_name 
                                ? `${assignedUser.first_name} ${assignedUser.last_name}` 
                                : assignedUser?.first_name || assignedUser?.last_name || null);
                            return repName ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {repName}
                              </span>
                            ) : null;
                          })()}
                          {upcomingAppt && (
                            <Badge variant="outline" className="text-xs font-normal bg-amber-500/10 text-amber-400 border-amber-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(upcomingAppt.start_time!), "MMM d, h:mm a")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono text-emerald-400">{formatCurrency(opp.monetary_value)}</span>
                          {opp.ghl_date_added && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(opp.ghl_date_added).toLocaleString("en-US", {
                                timeZone: "America/Los_Angeles",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })} PST
                            </div>
                          )}
                        </div>
                        {/* Appointments History */}
                        {contactAppointments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="text-xs text-muted-foreground mb-1.5">
                              Appointments ({contactAppointments.length})
                            </div>
                            <div className="space-y-1">
                              {contactAppointments.slice(0, 3).map((appt) => (
                                <div key={appt.ghl_id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>{format(new Date(appt.start_time!), "MMM d, yyyy")}</span>
                                  </div>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getApptStatusColor(appt.appointment_status)}`}>
                                    {appt.appointment_status || "Unknown"}
                                  </Badge>
                                </div>
                              ))}
                              {contactAppointments.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{contactAppointments.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity as any}
        appointments={appointments as any}
        contacts={contacts as any}
        users={users as any}
        open={oppSheetOpen}
        onOpenChange={setOppSheetOpen}
        allOpportunities={opportunities as any}
      />

      {/* Create Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Task Title</Label>
              <Input
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskNotes">Notes</Label>
              <Textarea
                id="taskNotes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Add notes for this task..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskAssignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {[...users].sort((a, b) => {
                    const nameA = (a.name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || "Unknown").toLowerCase();
                    const nameB = (b.name || `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email || "Unknown").toLowerCase();
                    return nameA.localeCompare(nameB);
                  }).map((user) => (
                    <SelectItem key={user.ghl_id} value={user.ghl_id}>
                      {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date & Time (PST) - Optional</Label>
              <div className="flex gap-2">
                <Input
                  id="taskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  id="taskDueTime"
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  className="w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground">Times are in Pacific Standard Time (PST/PDT)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreatingTask}>
              {isCreatingTask ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
