import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp, ArrowUpDown, Calendar, User, Clock, Plus, FileText, Loader2, RefreshCw, ExternalLink, CheckSquare, TrendingUp, Snowflake, Briefcase, Save, PartyPopper, Download, StickyNote, ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripHtml, getAddressFromContact, extractCustomField, CUSTOM_FIELD_IDS, findContactByIdOrGhlId } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
interface DBOpportunity {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
}
interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  title: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  start_time: string | null;
  end_time: string | null;
  location_id?: string;
}
interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  assigned_to: string | null;
  location_id?: string;
  custom_fields?: unknown;
  attributions?: unknown;
}
interface DBUser {
  id: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}
interface DBContactNote {
  id: string;
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
}
interface DBTask {
  id: string;
  ghl_id: string;
  contact_id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  completed: boolean;
  assigned_to: string | null;
}
interface GHLTask {
  id: string;
  ghl_id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string;
  assigned_to: string | null;
}
type DueDateFilter = "all" | "past_due" | "today" | "tomorrow" | "future";

// Calculate PST/PDT offset for a given UTC date
const getPSTOffset = (utcDate: Date): number => {
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10));
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9));
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8;
};
interface FollowUpManagementProps {
  opportunities: DBOpportunity[];
  appointments: DBAppointment[];
  contacts: DBContact[];
  users: DBUser[];
  contactNotes: DBContactNote[];
  tasks: DBTask[];
  onOpenOpportunity: (opportunity: DBOpportunity) => void;
  onDataRefresh?: () => void;
}
type SortField = "appointment_date" | "last_note_date" | "contact_name" | "opportunity_name";
type SortDirection = "asc" | "desc";
const DEFAULT_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";
export function FollowUpManagement({
  opportunities,
  appointments,
  contacts,
  users,
  contactNotes,
  tasks,
  onOpenOpportunity,
  onDataRefresh
}: FollowUpManagementProps) {
  const {
    user
  } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [staleNotesOpen, setStaleNotesOpen] = useState(false);
  const [noTasksOpen, setNoTasksOpen] = useState(false);
  const [pastConfirmedOpen, setPastConfirmedOpen] = useState(false);
  const [tasksHelperOpen, setTasksHelperOpen] = useState(false);
  const [closeToSaleOpen, setCloseToSaleOpen] = useState(false);
  const [closeToSaleRepFilter, setCloseToSaleRepFilter] = useState<string>("all");
  const [closeToSaleSort, setCloseToSaleSort] = useState<{ field: "opportunity" | "address" | "rep" | "value" | "note_date" | "task_date" | "appt_date"; direction: SortDirection }>({ field: "value", direction: "desc" });
  const [needsAttentionOpen, setNeedsAttentionOpen] = useState(false);
  const [needsAttentionRepFilter, setNeedsAttentionRepFilter] = useState<string>("all");
  const [needsAttentionPage, setNeedsAttentionPage] = useState(1);
  const [missingScopeOpen, setMissingScopeOpen] = useState(false);
  const [missingScopeRepFilter, setMissingScopeRepFilter] = useState<string>("all");
  const [staleNewOpen, setStaleNewOpen] = useState(false);
  const [staleNewRepFilter, setStaleNewRepFilter] = useState<string>("all");
  const [staleNewSourceFilter, setStaleNewSourceFilter] = useState<string>("all");
  const [staleNewStageFilter, setStaleNewStageFilter] = useState<string>("all"); // Now uses actual stage names
  const [staleNewSort, setStaleNewSort] = useState<{ field: "name" | "address" | "stage" | "source" | "rep" | "value" | "date_added"; direction: SortDirection }>({ field: "date_added", direction: "desc" });
  const NEEDS_ATTENTION_PAGE_SIZE = 10;

  // Tasks Helper State
  const [ghlTasks, setGhlTasks] = useState<GHLTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksAssigneeFilter, setTasksAssigneeFilter] = useState<string>("all");
  const [tasksDueDateFilter, setTasksDueDateFilter] = useState<DueDateFilter>("all");
  const [staleNotesSort, setStaleNotesSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "appointment_date",
    direction: "desc"
  });
  const [noTasksSort, setNoTasksSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "appointment_date",
    direction: "desc"
  });
  const [pastConfirmedSort, setPastConfirmedSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "appointment_date",
    direction: "desc"
  });
  const [staleNotesRepFilter, setStaleNotesRepFilter] = useState<string>("all");
  const [noTasksRepFilter, setNoTasksRepFilter] = useState<string>("all");
  const [pastConfirmedRepFilter, setPastConfirmedRepFilter] = useState<string>("all");

  // Note Dialog State
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDialogContactId, setNoteDialogContactId] = useState<string | null>(null);
  const [noteDialogContactName, setNoteDialogContactName] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Task Dialog State
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogOpportunity, setTaskDialogOpportunity] = useState<DBOpportunity | null>(null);
  const [taskDialogContactId, setTaskDialogContactId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<string>("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("09:00");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Appointment Status Update State
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [updatingPipelineStageId, setUpdatingPipelineStageId] = useState<string | null>(null);
  
  // Auto-create orphaned opportunities state
  const [creatingOrphanedOpportunities, setCreatingOrphanedOpportunities] = useState(false);
  const [orphanedOpportunitiesCreated, setOrphanedOpportunitiesCreated] = useState<Set<string>>(new Set());

  // Scope Dialog State
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [scopeDialogOpportunity, setScopeDialogOpportunity] = useState<DBOpportunity | null>(null);
  const [scopeDialogContactId, setScopeDialogContactId] = useState<string | null>(null);
  const [scopeDialogContactName, setScopeDialogContactName] = useState<string>("");
  const [scopeText, setScopeText] = useState("");
  const [isSavingScope, setIsSavingScope] = useState(false);

  // Helper functions
  const getUserName = (userId: string | null): string => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.ghl_id === userId);
    return user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Unknown";
  };
  const getContactName = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return "Unknown Contact";
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    return contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "Unknown Contact";
  };
  const getOpportunityForAppointment = (contactId: string | null): DBOpportunity | undefined => {
    if (!contactId) return undefined;
    return opportunities.find(o => o.contact_id === contactId && o.status?.toLowerCase() === "open");
  };
  const getLatestNoteDate = (contactId: string): Date | null => {
    const notes = contactNotes.filter(n => n.contact_id === contactId);
    if (notes.length === 0) return null;
    const latest = notes.reduce((latest, note) => {
      if (!note.ghl_date_added) return latest;
      const noteDate = new Date(note.ghl_date_added);
      return !latest || noteDate > latest ? noteDate : latest;
    }, null as Date | null);
    return latest;
  };

  // Get latest note for a contact (includes body)
  const getLatestNote = (contactId: string): DBContactNote | null => {
    const notes = contactNotes.filter(n => n.contact_id === contactId && n.ghl_date_added);
    if (notes.length === 0) return null;
    return notes.reduce((latest, note) => {
      if (!note.ghl_date_added) return latest;
      if (!latest) return note;
      return new Date(note.ghl_date_added) > new Date(latest.ghl_date_added!) ? note : latest;
    }, null as DBContactNote | null);
  };

  // Get latest task for a contact
  const getLatestTask = (contactId: string): DBTask | null => {
    const contactTasks = tasks.filter(t => t.contact_id === contactId);
    if (contactTasks.length === 0) return null;
    // Sort by due_date descending, then by id as fallback
    return contactTasks.sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateB - dateA;
    })[0];
  };

  // Get latest appointment for a contact
  const getLatestAppointment = (contactId: string): DBAppointment | null => {
    const contactAppts = appointments.filter(a => 
      a.contact_id === contactId && 
      a.start_time &&
      a.appointment_status?.toLowerCase() !== "cancelled"
    );
    if (contactAppts.length === 0) return null;
    return contactAppts.sort((a, b) => 
      new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime()
  )[0];
  };

  // Get oldest note date for a contact (for setting opportunity creation date)
  const getOldestNoteDate = (contactId: string): Date | null => {
    const notes = contactNotes.filter(n => n.contact_id === contactId && n.ghl_date_added);
    if (notes.length === 0) return null;
    return notes.reduce((oldest, note) => {
      const noteDate = new Date(note.ghl_date_added!);
      return !oldest || noteDate < oldest ? noteDate : oldest;
    }, null as Date | null);
  };

  // Get oldest appointment date for a contact (fallback for creation date)
  const getOldestAppointmentDate = (contactId: string): Date | null => {
    const contactAppts = appointments.filter(a => a.contact_id === contactId && a.start_time);
    if (contactAppts.length === 0) return null;
    return contactAppts.reduce((oldest, appt) => {
      const apptDate = new Date(appt.start_time!);
      return !oldest || apptDate < oldest ? apptDate : oldest;
    }, null as Date | null);
  };

  // Auto-create opportunity for orphaned appointment
  const createOrphanedOpportunity = async (appointment: DBAppointment, contact: DBContact | undefined) => {
    if (!appointment.contact_id || !contact || !companyId) return null;
    
    // Skip if already being created or was already created this session
    if (orphanedOpportunitiesCreated.has(appointment.contact_id)) return null;

    try {
      // Get the oldest note date, fallback to oldest appointment date
      const oldestNoteDate = getOldestNoteDate(appointment.contact_id);
      const oldestApptDate = getOldestAppointmentDate(appointment.contact_id);
      const creationDate = (oldestNoteDate || oldestApptDate || new Date()).toISOString();

      // Generate a local opportunity ID
      const localOppId = `local_opp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Create the opportunity in Supabase
      const { data: newOpp, error } = await supabase
        .from('opportunities')
        .insert({
          ghl_id: localOppId,
          provider: 'local',
          contact_id: appointment.contact_id,
          contact_uuid: contact.id,
          name: contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
          status: 'open',
          stage_name: 'Follow Up',
          pipeline_name: 'Sales Pipeline',
          assigned_to: appointment.assigned_user_id || contact.assigned_to,
          location_id: contact.location_id || appointment.location_id || DEFAULT_LOCATION_ID,
          ghl_date_added: creationDate,
          created_at: creationDate,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create orphaned opportunity:', error);
        return null;
      }

      console.log(`Auto-created opportunity for orphaned appointment: ${localOppId} with creation date ${creationDate}`);
      return newOpp as DBOpportunity;
    } catch (err) {
      console.error('Error creating orphaned opportunity:', err);
      return null;
    }
  };

  // Effect to auto-create opportunities for orphaned past confirmed appointments
  useEffect(() => {
    const autoCreateOrphanedOpportunities = async () => {
      if (creatingOrphanedOpportunities || !companyId) return;

      const now = new Date();
      const orphanedAppointments: Array<{ appointment: DBAppointment; contact: DBContact | undefined }> = [];

      // Find past confirmed appointments without opportunities
      appointments.forEach(appointment => {
        if (!appointment.start_time || !appointment.contact_id) return;
        const appointmentDate = new Date(appointment.start_time);
        if (appointmentDate >= now) return;

        const appointmentStatus = appointment.appointment_status?.toLowerCase();
        if (appointmentStatus !== "confirmed") return;

        // Check if already has an opportunity
        const existingOpp = opportunities.find(o => o.contact_id === appointment.contact_id);
        if (existingOpp) return;

        // Skip if already processed this session
        if (orphanedOpportunitiesCreated.has(appointment.contact_id)) return;

        const contact = findContactByIdOrGhlId(contacts, undefined, appointment.contact_id);
        if (contact) {
          orphanedAppointments.push({ appointment, contact });
        }
      });

      if (orphanedAppointments.length === 0) return;

      setCreatingOrphanedOpportunities(true);
      console.log(`Auto-creating ${orphanedAppointments.length} opportunities for orphaned appointments...`);

      const createdContactIds = new Set<string>();
      for (const { appointment, contact } of orphanedAppointments) {
        const newOpp = await createOrphanedOpportunity(appointment, contact);
        if (newOpp && appointment.contact_id) {
          createdContactIds.add(appointment.contact_id);
        }
      }

      if (createdContactIds.size > 0) {
        setOrphanedOpportunitiesCreated(prev => new Set([...prev, ...createdContactIds]));
        toast.success(`Auto-created ${createdContactIds.size} opportunity${createdContactIds.size > 1 ? 'ies' : ''} for orphaned appointments`);
        onDataRefresh?.();
      }

      setCreatingOrphanedOpportunities(false);
    };

    autoCreateOrphanedOpportunities();
  }, [appointments, opportunities, contacts, companyId, creatingOrphanedOpportunities, orphanedOpportunitiesCreated]);

  // Export Close to Sale data as CSV
  const exportCloseToSaleCSV = () => {
    const headers = [
      "Opportunity",
      "Address",
      "Scope",
      "Pipeline Stage",
      "Assigned Rep",
      "Value",
      "Latest Note Date",
      "Latest Note Content",
      "Latest Task Date",
      "Latest Task Title",
      "Latest Appointment Date"
    ];

    const rows = closeToSaleData.map(opp => {
      const latestNote = opp.contact_id ? getLatestNote(opp.contact_id) : null;
      const latestTask = opp.contact_id ? getLatestTask(opp.contact_id) : null;
      const latestAppt = opp.contact_id ? getLatestAppointment(opp.contact_id) : null;
      
      // Strip HTML from note body
      const noteContent = latestNote?.body 
        ? latestNote.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
        : "";

      return [
        opp.name || "Unnamed",
        getAddress(opp.contact_id),
        getScope(opp.contact_id) || "",
        opp.stage_name || "",
        getUserName(opp.assigned_to),
        opp.monetary_value?.toString() || "0",
        latestNote?.ghl_date_added ? new Date(latestNote.ghl_date_added).toLocaleDateString() : "",
        noteContent,
        latestTask?.due_date ? new Date(latestTask.due_date).toLocaleDateString() : "",
        latestTask?.title || "",
        latestAppt?.start_time ? new Date(latestAppt.start_time).toLocaleDateString() : ""
      ];
    });

    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `close-to-sale-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Get unique reps for filter
  const uniqueReps = useMemo(() => {
    const reps = new Set<string>();
    appointments.forEach(a => {
      if (a.assigned_user_id) reps.add(a.assigned_user_id);
    });
    return Array.from(reps).map(id => ({
      id,
      name: getUserName(id)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, users]);

  // Fetch GHL Tasks (scoped to current company)
  const fetchGhlTasks = async () => {
    if (!companyId) {
      setGhlTasks([]);
      return;
    }

    setIsLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from("ghl_tasks")
        .select("*")
        .eq("company_id", companyId)
        .eq("completed", false)
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error);
        toast.error("Failed to fetch tasks");
        return;
      }

      setGhlTasks(data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      toast.error("Failed to fetch tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchGhlTasks();
    // Re-fetch when switching/simulating companies
  }, [companyId]);

  // Get unique assignees from GHL tasks
  const uniqueTaskAssignees = useMemo(() => {
    const assigneeIds = new Set(ghlTasks.map(t => t.assigned_to).filter(Boolean));
    return Array.from(assigneeIds).map(id => ({
      id: id!,
      name: getUserName(id!)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ghlTasks, users]);

  // Get opportunity for a contact (for tasks) - prioritize open over lost
  const getOpportunityForContact = (contactId: string): DBOpportunity | undefined => {
    const contactOpps = opportunities.filter(o => o.contact_id === contactId);
    if (contactOpps.length === 0) return undefined;
    // Prioritize open opportunities over lost/abandoned
    const openOpp = contactOpps.find(o => o.status?.toLowerCase() === "open");
    if (openOpp) return openOpp;
    const wonOpp = contactOpps.find(o => o.status?.toLowerCase() === "won");
    if (wonOpp) return wonOpp;
    // Return first if no open/won found
    return contactOpps[0];
  };

  // Format due date for tasks in PST
  const formatTaskDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const date = new Date(dueDate);
    // Use toLocaleString with America/Los_Angeles timezone for accurate PST/PDT conversion
    const pstDateString = date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    return pstDateString + " PST";
  };
  const isTaskOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Helper to get PST start of day for comparisons
  const getPSTDayBoundaries = () => {
    const now = new Date();
    // Get current time in PST
    const pstNow = new Date(now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles"
    }));
    // Start of today in PST (converted back to UTC for comparison)
    const todayPST = new Date(pstNow.getFullYear(), pstNow.getMonth(), pstNow.getDate());
    const pstOffset = getPSTOffset(now);
    // Convert PST boundaries to UTC timestamps
    const todayStartUTC = new Date(todayPST.getTime() + pstOffset * 60 * 60 * 1000);
    const tomorrowStartUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrowStartUTC = new Date(todayStartUTC.getTime() + 48 * 60 * 60 * 1000);
    return {
      todayStartUTC,
      tomorrowStartUTC,
      dayAfterTomorrowStartUTC
    };
  };

  // Calculate task counts by category (using PST)
  const taskCounts = useMemo(() => {
    let baseTasks = ghlTasks.filter(t => !t.completed);

    // Filter out tasks where the associated opportunity is lost
    baseTasks = baseTasks.filter(t => {
      const opportunity = getOpportunityForContact(t.contact_id);
      if (!opportunity) return true;
      return opportunity.status?.toLowerCase() !== "lost";
    });
    const {
      todayStartUTC,
      tomorrowStartUTC,
      dayAfterTomorrowStartUTC
    } = getPSTDayBoundaries();
    const pastDue = baseTasks.filter(t => t.due_date && new Date(t.due_date) < todayStartUTC).length;
    const today = baseTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= todayStartUTC && dueDate < tomorrowStartUTC;
    }).length;
    const tomorrow = baseTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= tomorrowStartUTC && dueDate < dayAfterTomorrowStartUTC;
    }).length;
    const future = baseTasks.filter(t => t.due_date && new Date(t.due_date) >= dayAfterTomorrowStartUTC).length;
    return {
      pastDue,
      today,
      tomorrow,
      future,
      total: baseTasks.length
    };
  }, [ghlTasks, opportunities]);

  // Filter GHL tasks (using PST)
  const filteredGhlTasks = useMemo(() => {
    let filtered = ghlTasks.filter(t => !t.completed);

    // Filter out tasks where the associated opportunity is lost
    filtered = filtered.filter(t => {
      const opportunity = getOpportunityForContact(t.contact_id);
      if (!opportunity) return true;
      return opportunity.status?.toLowerCase() !== "lost";
    });

    // Assignee filter
    if (tasksAssigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assigned_to === tasksAssigneeFilter);
    }

    // Due date filter (using PST boundaries)
    const {
      todayStartUTC,
      tomorrowStartUTC,
      dayAfterTomorrowStartUTC
    } = getPSTDayBoundaries();
    if (tasksDueDateFilter === "past_due") {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < todayStartUTC;
      });
    } else if (tasksDueDateFilter === "today") {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate >= todayStartUTC && dueDate < tomorrowStartUTC;
      });
    } else if (tasksDueDateFilter === "tomorrow") {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate >= tomorrowStartUTC && dueDate < dayAfterTomorrowStartUTC;
      });
    } else if (tasksDueDateFilter === "future") {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) >= dayAfterTomorrowStartUTC;
      });
    }

    // Sort by due date, earliest first, nulls last
    return filtered.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [ghlTasks, tasksAssigneeFilter, tasksDueDateFilter, opportunities]);
  const handleTaskClick = (task: GHLTask) => {
    const opportunity = getOpportunityForContact(task.contact_id);
    if (opportunity) {
      onOpenOpportunity(opportunity);
    } else {
      toast.error("No opportunity found for this contact");
    }
  };

  // Action handlers
  const handleOpenNoteDialog = (contactId: string, contactName: string) => {
    setNoteDialogContactId(contactId);
    setNoteDialogContactName(contactName);
    setNoteText("");
    setNoteDialogOpen(true);
  };
  const handleCreateNote = async () => {
    if (!noteDialogContactId || !noteText.trim()) return;
    setIsCreatingNote(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("create-contact-note", {
        body: {
          contactId: noteDialogContactId,
          body: noteText.trim(),
          enteredBy: user?.id || null
        }
      });
      if (error) throw error;
      toast.success("Note created successfully");
      setNoteDialogOpen(false);
      setNoteText("");
      onDataRefresh?.();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Failed to create note");
    } finally {
      setIsCreatingNote(false);
    }
  };
  const handleOpenTaskDialog = (opportunity: DBOpportunity, contactId: string | null, contactName: string) => {
    setTaskDialogOpportunity(opportunity);
    setTaskDialogContactId(contactId);
    setTaskTitle(`Follow up: ${contactName}`);
    setTaskNotes("");
    setTaskAssignee(opportunity.assigned_to || "");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };
  const handleCreateTask = async () => {
    if (!taskDialogOpportunity || !taskTitle.trim()) return;
    setIsCreatingTask(true);
    try {
      // Build due date in PST
      let dueDateTime: string | null = null;
      if (taskDueDate) {
        const pstOffset = -8;
        const [year, month, day] = taskDueDate.split("-").map(Number);
        const [hours, minutes] = taskDueTime.split(":").map(Number);
        const utcHours = hours - pstOffset;
        const date = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, 0));
        dueDateTime = date.toISOString();
      }

      // Get location_id from contact (use ghl_id lookup since taskDialogContactId is a ghl_id)
      const contact = findContactByIdOrGhlId(contacts, null, taskDialogContactId);
      const locationId = contact?.location_id || DEFAULT_LOCATION_ID;

      // Create in GHL first (edge function will also insert into ghl_tasks)
      const {
        error: ghlError
      } = await supabase.functions.invoke("create-ghl-task", {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateTime,
          assignedTo: taskAssignee === "unassigned" ? null : taskAssignee || null,
          contactId: taskDialogContactId,
          locationId: locationId,
          enteredBy: user?.id || null
        }
      });
      if (ghlError) {
        console.error("GHL sync error:", ghlError);
        toast.error("Failed to create task");
        return;
      }
      toast.success("Task created successfully");
      setTaskDialogOpen(false);

      // Refresh tasks list
      await fetchGhlTasks();
      onDataRefresh?.();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingTask(false);
    }
  };
  const handleUpdateAppointmentStatus = async (appointmentGhlId: string, newStatus: string) => {
    setUpdatingAppointmentId(appointmentGhlId);
    // Get old status before updating
    const appointment = appointments.find(a => a.ghl_id === appointmentGhlId);
    const oldStatus = appointment?.appointment_status;
    try {
      // Update in GHL
      const {
        error: ghlError
      } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: appointmentGhlId,
          appointment_status: newStatus
        }
      });
      if (ghlError) throw ghlError;

      // Update in Supabase with edit tracking
      const {
        error: dbError
      } = await supabase.from("appointments").update({
        appointment_status: newStatus,
        edited_by: user?.id || null,
        edited_at: new Date().toISOString(),
      }).eq("ghl_id", appointmentGhlId);
      if (dbError) throw dbError;

      // Record edit in appointment_edits table
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appointmentGhlId,
        contact_ghl_id: appointment?.contact_id || null,
        field_name: "appointment_status",
        old_value: oldStatus || null,
        new_value: newStatus,
        edited_by: user?.id || null,
        location_id: appointment?.location_id || null,
        company_id: companyId,
      });

      toast.success(`Appointment marked as "${newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ["appointment_edits"] });
      onDataRefresh?.();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Failed to update appointment status");
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  // Scope handlers
  const handleOpenScopeDialog = (opportunity: DBOpportunity) => {
    const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
    const contactName = getContactName(opportunity.contact_id, opportunity.contact_uuid);
    setScopeDialogOpportunity(opportunity);
    setScopeDialogContactId(opportunity.contact_id);
    setScopeDialogContactName(contactName);
    setScopeText("");
    setScopeDialogOpen(true);
  };
  const handleSaveScope = async () => {
    if (!scopeDialogContactId || !scopeText.trim()) return;
    setIsSavingScope(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("update-contact-scope", {
        body: {
          contactId: scopeDialogContactId,
          scopeOfWork: scopeText.trim(),
          editedBy: user?.id || null,
          opportunityGhlId: scopeDialogOpportunity?.ghl_id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Scope of work saved");
      setScopeDialogOpen(false);
      setScopeText("");
      onDataRefresh?.();
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error saving scope:", error);
      toast.error("Failed to save scope of work");
    } finally {
      setIsSavingScope(false);
    }
  };

  // Build stage map for pipeline stage dropdown
  const stageMap = useMemo(() => {
    const map = new Map<string, {
      stageId: string;
      pipelineId: string;
    }>();
    opportunities.forEach(o => {
      if (o.stage_name && o.pipeline_stage_id && o.pipeline_id) {
        map.set(o.stage_name, {
          stageId: o.pipeline_stage_id,
          pipelineId: o.pipeline_id
        });
      }
    });
    return map;
  }, [opportunities]);
  const availableStages = useMemo(() => {
    return Array.from(stageMap.keys()).sort();
  }, [stageMap]);
  const handleUpdatePipelineStage = async (opportunity: DBOpportunity, newStageName: string) => {
    if (!opportunity) return;
    const stageInfo = stageMap.get(newStageName);
    if (!stageInfo) {
      toast.error("Invalid stage selected");
      return;
    }
    setUpdatingPipelineStageId(opportunity.id);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          status: opportunity.status,
          stage_name: newStageName,
          pipeline_stage_id: stageInfo.stageId,
          monetary_value: opportunity.monetary_value,
          assigned_to: opportunity.assigned_to,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Pipeline stage updated to "${newStageName}"`);
      onDataRefresh?.();
    } catch (error) {
      console.error("Error updating pipeline stage:", error);
      toast.error("Failed to update pipeline stage");
    } finally {
      setUpdatingPipelineStageId(null);
    }
  };

  // Helper to get address from contact custom_fields with appointment fallback
  const getAddress = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return "No address";
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    return getAddressFromContact(contact, appointments, contactId) || "No address";
  };

  // Helper to get scope from contact custom_fields
  const getScope = (contactId: string | null, contactUuid?: string | null): string => {
    if (!contactId && !contactUuid) return "";
    const contact = findContactByIdOrGhlId(contacts, contactUuid, contactId);
    if (!contact) return "";

    // Try custom_fields first
    if (contact.custom_fields) {
      const customFields = contact.custom_fields as Array<{
        id: string;
        value: string;
      }>;
      if (Array.isArray(customFields)) {
        const scopeField = customFields.find(f => f.id === "KwQRtJT0aMSHnq3mwR68");
        if (scopeField?.value) return scopeField.value;
      }
    }

    // Fall back to attributions.utmContent for Location 2 contacts
    if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
      const attrs = contact.attributions as Array<{
        utmContent?: string;
      }>;
      if (attrs[0]?.utmContent) return attrs[0].utmContent;
    }
    return "";
  };

  // Close to Sale Data - opportunities with pipeline stage containing "close to sale", "important", or "second appointment"
  const closeToSaleData = useMemo(() => {
    const results = opportunities.filter(o => {
      const stageName = o.stage_name?.toLowerCase() || "";
      const isCloseToSale = stageName.includes("close") && stageName.includes("sale");
      const isImportant = stageName === "important";
      const isSecondAppointment = stageName.includes("second") && stageName.includes("appointment");
      return (isCloseToSale || isImportant || isSecondAppointment) && o.status?.toLowerCase() === "open";
    });

    // Deduplicate by contact_id (keep the one with highest monetary value)
    const uniqueMap = new Map<string, DBOpportunity>();
    results.forEach(o => {
      if (!o.contact_id) return;
      const existing = uniqueMap.get(o.contact_id);
      if (!existing || (o.monetary_value || 0) > (existing.monetary_value || 0)) {
        uniqueMap.set(o.contact_id, o);
      }
    });
    let unique = Array.from(uniqueMap.values());

    // Apply rep filter
    if (closeToSaleRepFilter !== "all") {
      unique = unique.filter(o => o.assigned_to === closeToSaleRepFilter);
    }

    // Helper to get latest note date for an opportunity
    const getLatestNoteDate = (contactId: string | null): Date | null => {
      if (!contactId) return null;
      const note = getLatestNote(contactId);
      return note?.ghl_date_added ? new Date(note.ghl_date_added) : null;
    };

    // Helper to get latest task date for an opportunity
    const getLatestTaskDate = (contactId: string | null): Date | null => {
      if (!contactId) return null;
      const task = getLatestTask(contactId);
      return task?.due_date ? new Date(task.due_date) : null;
    };

    // Helper to get latest appointment date for an opportunity
    const getLatestApptDate = (contactId: string | null): Date | null => {
      if (!contactId) return null;
      const appt = getLatestAppointment(contactId);
      return appt?.start_time ? new Date(appt.start_time) : null;
    };

    // Sort based on current sort state
    return unique.sort((a, b) => {
      const dir = closeToSaleSort.direction === "asc" ? 1 : -1;
      switch (closeToSaleSort.field) {
        case "opportunity":
          return dir * (a.name || "").localeCompare(b.name || "");
        case "address":
          return dir * (getAddress(a.contact_id) || "").localeCompare(getAddress(b.contact_id) || "");
        case "rep":
          return dir * (getUserName(a.assigned_to) || "").localeCompare(getUserName(b.assigned_to) || "");
        case "value":
          return dir * ((a.monetary_value || 0) - (b.monetary_value || 0));
        case "note_date": {
          const dateA = getLatestNoteDate(a.contact_id);
          const dateB = getLatestNoteDate(b.contact_id);
          if (!dateA && !dateB) return 0;
          if (!dateA) return dir;
          if (!dateB) return -dir;
          return dir * (dateA.getTime() - dateB.getTime());
        }
        case "task_date": {
          const dateA = getLatestTaskDate(a.contact_id);
          const dateB = getLatestTaskDate(b.contact_id);
          if (!dateA && !dateB) return 0;
          if (!dateA) return dir;
          if (!dateB) return -dir;
          return dir * (dateA.getTime() - dateB.getTime());
        }
        case "appt_date": {
          const dateA = getLatestApptDate(a.contact_id);
          const dateB = getLatestApptDate(b.contact_id);
          if (!dateA && !dateB) return 0;
          if (!dateA) return dir;
          if (!dateB) return -dir;
          return dir * (dateA.getTime() - dateB.getTime());
        }
        default:
          return 0;
      }
    });
  }, [opportunities, closeToSaleRepFilter, closeToSaleSort, getLatestNote, getLatestTask, getLatestAppointment, getAddress, getUserName]);

  // Missing Scope Data - Won opportunities or close-to-sale stages without scope of work
  const missingScopeData = useMemo(() => {
    const results = opportunities.filter(o => {
      if (!o.contact_id) return false;

      // Check if won OR in close-to-sale stage
      const isWon = o.status?.toLowerCase() === "won";
      const stageName = o.stage_name?.toLowerCase() || "";
      const isCloseToSale = stageName.includes("close") && stageName.includes("sale");
      const isImportant = stageName === "important";
      const isSecondAppointment = stageName.includes("second") && stageName.includes("appointment");
      if (!isWon && !isCloseToSale && !isImportant && !isSecondAppointment) return false;

      // Check if scope is missing
      const scope = getScope(o.contact_id);
      return !scope || scope.trim() === "";
    });

    // Deduplicate by contact_id (keep the one with highest monetary value)
    const uniqueMap = new Map<string, DBOpportunity>();
    results.forEach(o => {
      if (!o.contact_id) return;
      const existing = uniqueMap.get(o.contact_id);
      if (!existing || (o.monetary_value || 0) > (existing.monetary_value || 0)) {
        uniqueMap.set(o.contact_id, o);
      }
    });
    let unique = Array.from(uniqueMap.values());

    // Apply rep filter
    if (missingScopeRepFilter !== "all") {
      unique = unique.filter(o => o.assigned_to === missingScopeRepFilter);
    }

    // Sort by monetary value descending
    return unique.sort((a, b) => (b.monetary_value || 0) - (a.monetary_value || 0));
  }, [opportunities, contacts, missingScopeRepFilter]);
  const contactsWithFutureAppointments = useMemo(() => {
    const now = new Date();
    const set = new Set<string>();
    appointments.forEach(a => {
      if (!a.contact_id || !a.start_time) return;
      if (a.appointment_status?.toLowerCase() === "cancelled") return;
      const apptDate = new Date(a.start_time);
      if (apptDate > now) {
        set.add(a.contact_id);
      }
    });
    return set;
  }, [appointments]);

  // Contacts with future tasks
  const contactsWithFutureTasks = useMemo(() => {
    const now = new Date();
    const set = new Set<string>();
    ghlTasks.forEach(t => {
      if (!t.contact_id || !t.due_date) return;
      if (t.completed) return;
      const taskDate = new Date(t.due_date);
      if (taskDate > now) {
        set.add(t.contact_id);
      }
    });
    return set;
  }, [ghlTasks]);

  // Helper to get source from contact
  const getContactSource = (contactId: string | null): string => {
    if (!contactId) return "";
    const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
    return contact?.source || "";
  };

  // Stale Opportunities - no future appointments, no future tasks, excluding lost/abandoned/won
  const staleOpportunitiesRaw = useMemo(() => {
    const excludedStages = ["lost", "abandon", "dnc", "do not call"];
    const excludedStatuses = ["lost", "abandoned", "won"];
    
    return opportunities.filter(o => {
      if (!o.contact_id) return false;
      
      // Exclude lost/abandoned status
      const status = o.status?.toLowerCase() || "";
      if (excludedStatuses.includes(status)) return false;
      
      // Exclude lost/abandoned/dnc stages
      const stageName = o.stage_name?.toLowerCase() || "";
      if (excludedStages.some(ex => stageName.includes(ex))) return false;
      
      // Check if has future appointment
      if (contactsWithFutureAppointments.has(o.contact_id)) return false;
      
      // Check if has future task
      if (contactsWithFutureTasks.has(o.contact_id)) return false;
      
      return true;
    });
  }, [opportunities, contactsWithFutureAppointments, contactsWithFutureTasks]);

  // Get unique stages, sources, and reps from stale opportunities for filters
  const staleFilterOptions = useMemo(() => {
    const stages = new Set<string>();
    const sources = new Set<string>();
    const reps = new Set<string>();
    
    staleOpportunitiesRaw.forEach(o => {
      if (o.stage_name) stages.add(o.stage_name);
      if (o.assigned_to) reps.add(o.assigned_to);
      if (o.contact_id) {
        const source = getContactSource(o.contact_id);
        if (source) sources.add(source);
      }
    });
    
    return {
      stages: Array.from(stages).sort(),
      sources: Array.from(sources).sort(),
      reps: Array.from(reps).map(id => ({ id, name: getUserName(id) })).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [staleOpportunitiesRaw, contacts, users]);

  // Stale opportunities filtered and deduplicated (excluding Quickbase by default)
  const staleNewData = useMemo(() => {
    let results = [...staleOpportunitiesRaw];
    
    // Apply stage filter
    if (staleNewStageFilter === "all") {
      // Exclude Quickbase by default when "all" is selected
      results = results.filter(o => o.stage_name?.toLowerCase() !== "quickbase");
    } else if (staleNewStageFilter === "__new_stages__") {
      // Filter to only "New" stages (for badge click)
      results = results.filter(o => o.stage_name?.toLowerCase().includes("new"));
    } else if (staleNewStageFilter === "__other_stages__") {
      // Filter to "Other" stages (not New, not Quickbase)
      results = results.filter(o => {
        const stageName = o.stage_name?.toLowerCase() || "";
        return !stageName.includes("new") && stageName !== "quickbase";
      });
    } else {
      // Filter to specific stage name
      results = results.filter(o => o.stage_name === staleNewStageFilter);
    }

    // Deduplicate by contact_id (keep the one with highest monetary value)
    const uniqueMap = new Map<string, DBOpportunity>();
    results.forEach(o => {
      if (!o.contact_id) return;
      const existing = uniqueMap.get(o.contact_id);
      if (!existing || (o.monetary_value || 0) > (existing.monetary_value || 0)) {
        uniqueMap.set(o.contact_id, o);
      }
    });
    let unique = Array.from(uniqueMap.values());

    // Apply rep filter
    if (staleNewRepFilter !== "all") {
      unique = unique.filter(o => o.assigned_to === staleNewRepFilter);
    }
    
    // Apply source filter
    if (staleNewSourceFilter !== "all") {
      unique = unique.filter(o => getContactSource(o.contact_id) === staleNewSourceFilter);
    }

    // Apply sorting
    const direction = staleNewSort.direction === "asc" ? 1 : -1;
    return unique.sort((a, b) => {
      switch (staleNewSort.field) {
        case "name":
          return direction * (a.name || "").localeCompare(b.name || "");
        case "address":
          return direction * getAddress(a.contact_id).localeCompare(getAddress(b.contact_id));
        case "stage":
          return direction * (a.stage_name || "").localeCompare(b.stage_name || "");
        case "source":
          return direction * getContactSource(a.contact_id).localeCompare(getContactSource(b.contact_id));
        case "rep":
          return direction * getUserName(a.assigned_to).localeCompare(getUserName(b.assigned_to));
        case "date_added":
          const dateA = a.ghl_date_added ? new Date(a.ghl_date_added).getTime() : 0;
          const dateB = b.ghl_date_added ? new Date(b.ghl_date_added).getTime() : 0;
          return direction * (dateA - dateB);
        case "value":
        default:
          return direction * ((a.monetary_value || 0) - (b.monetary_value || 0));
      }
    });
  }, [staleOpportunitiesRaw, staleNewStageFilter, staleNewRepFilter, staleNewSourceFilter, staleNewSort, contacts]);

  // Counts for badges (excluding Quickbase, before filters, deduplicated by contact)
  const staleNewCounts = useMemo(() => {
    // Filter out Quickbase for badge counts
    const filtered = staleOpportunitiesRaw.filter(o => o.stage_name?.toLowerCase() !== "quickbase");
    
    // Categorize by New vs Other
    const newStage: DBOpportunity[] = [];
    const otherStage: DBOpportunity[] = [];
    
    filtered.forEach(o => {
      const stageName = o.stage_name?.toLowerCase() || "";
      if (stageName.includes("new")) {
        newStage.push(o);
      } else {
        otherStage.push(o);
      }
    });
    
    // Dedupe new stage
    const newMap = new Map<string, DBOpportunity>();
    newStage.forEach(o => {
      if (!o.contact_id) return;
      const existing = newMap.get(o.contact_id);
      if (!existing || (o.monetary_value || 0) > (existing.monetary_value || 0)) {
        newMap.set(o.contact_id, o);
      }
    });
    
    // Dedupe other stage
    const otherMap = new Map<string, DBOpportunity>();
    otherStage.forEach(o => {
      if (!o.contact_id) return;
      const existing = otherMap.get(o.contact_id);
      if (!existing || (o.monetary_value || 0) > (existing.monetary_value || 0)) {
        otherMap.set(o.contact_id, o);
      }
    });
    
    return {
      newCount: newMap.size,
      otherCount: otherMap.size,
      total: newMap.size + otherMap.size
    };
  }, [staleOpportunitiesRaw]);
  const staleNotesData = useMemo(() => {
    const results: Array<{
      appointment: DBAppointment;
      opportunity: DBOpportunity;
      contact: DBContact | undefined;
      lastNoteDate: Date | null;
      daysSinceNote: number | null;
    }> = [];
    const now = new Date();
    appointments.forEach(appointment => {
      if (!appointment.contact_id || !appointment.start_time) return;
      if (appointment.appointment_status?.toLowerCase() === "cancelled") return;

      // 🔴 NEW: if this contact has any future appointment, skip entirely
      if (contactsWithFutureAppointments.has(appointment.contact_id)) return;
      const appointmentDate = new Date(appointment.start_time);

      // Only include past appointments
      if (appointmentDate >= now) return;
      const opportunity = getOpportunityForAppointment(appointment.contact_id);
      if (!opportunity) return;
      const lastNoteDate = getLatestNoteDate(appointment.contact_id);

      // Include if no notes exist OR last note is before appointment
      if (lastNoteDate === null || lastNoteDate < appointmentDate) {
        const contact = findContactByIdOrGhlId(contacts, undefined, appointment.contact_id);
        const daysSinceNote = lastNoteDate ? Math.floor((Date.now() - lastNoteDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        results.push({
          appointment,
          opportunity,
          contact,
          lastNoteDate,
          daysSinceNote
        });
      }
    });

    // ... your existing rep filter + sort stays the same
    let filtered = results;
    if (staleNotesRepFilter !== "all") {
      filtered = results.filter(r => r.appointment.assigned_user_id === staleNotesRepFilter);
    }
    filtered.sort((a, b) => {
      const direction = staleNotesSort.direction === "asc" ? 1 : -1;
      switch (staleNotesSort.field) {
        case "appointment_date":
          return direction * (new Date(a.appointment.start_time!).getTime() - new Date(b.appointment.start_time!).getTime());
        case "last_note_date":
          if (!a.lastNoteDate && !b.lastNoteDate) return 0;
          if (!a.lastNoteDate) return direction;
          if (!b.lastNoteDate) return -direction;
          return direction * (a.lastNoteDate.getTime() - b.lastNoteDate.getTime());
        case "contact_name":
          return direction * getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id));
        default:
          return 0;
      }
    });
    return filtered;
  }, [appointments, opportunities, contacts, contactNotes, staleNotesSort, staleNotesRepFilter, contactsWithFutureAppointments]);

  // View 2: No Tasks Assigned - Open opportunities with past appointments but no tasks
  const noTasksData = useMemo(() => {
    const now = new Date();
    const results: Array<{
      opportunity: DBOpportunity;
      contact: DBContact | undefined;
      latestAppointment: DBAppointment | undefined;
    }> = [];

    // Get open opportunities
    const openOpportunities = opportunities.filter(o => o.status?.toLowerCase() === "open");
    openOpportunities.forEach(opportunity => {
      if (!opportunity.contact_id) return;

      // Check if contact has any future appointments - if so, skip (they have upcoming follow-up)
      const hasFutureAppointment = appointments.some(a => 
        a.contact_id === opportunity.contact_id && 
        a.appointment_status?.toLowerCase() !== "cancelled" && 
        a.start_time && 
        new Date(a.start_time) >= now
      );
      if (hasFutureAppointment) return;

      // Check if this opportunity has any past appointments
      const oppAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id && a.appointment_status?.toLowerCase() !== "cancelled" && a.start_time && new Date(a.start_time) < now);
      if (oppAppointments.length === 0) return;

      // Check if any tasks exist for this contact in ghl_tasks
      const contactTasks = ghlTasks.filter(t => t.contact_id === opportunity.contact_id);
      if (contactTasks.length > 0) return;
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
      const latestAppointment = oppAppointments.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime())[0];
      results.push({
        opportunity,
        contact,
        latestAppointment
      });
    });

    // Apply rep filter (using opportunity assigned_to or contact assigned_to)
    let filtered = results;
    if (noTasksRepFilter !== "all") {
      filtered = results.filter(r => r.opportunity.assigned_to === noTasksRepFilter || r.contact?.assigned_to === noTasksRepFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = noTasksSort.direction === "asc" ? 1 : -1;
      switch (noTasksSort.field) {
        case "appointment_date":
          const aDate = a.latestAppointment?.start_time ? new Date(a.latestAppointment.start_time).getTime() : 0;
          const bDate = b.latestAppointment?.start_time ? new Date(b.latestAppointment.start_time).getTime() : 0;
          return direction * (aDate - bDate);
        case "contact_name":
          return direction * getContactName(a.opportunity.contact_id).localeCompare(getContactName(b.opportunity.contact_id));
        default:
          return 0;
      }
    });
    return filtered;
  }, [opportunities, appointments, contacts, ghlTasks, noTasksSort, noTasksRepFilter]);

  // View 3: Past Confirmed - Appointments still marked as confirmed OR pipeline stage is "appointment confirmed" and date has passed
  const pastConfirmedData = useMemo(() => {
    const now = new Date();
    const results: Array<{
      appointment: DBAppointment;
      opportunity: DBOpportunity | undefined;
      contact: DBContact | undefined;
      daysPast: number;
    }> = [];
    appointments.forEach(appointment => {
      if (!appointment.start_time) return;
      const appointmentDate = new Date(appointment.start_time);
      if (appointmentDate >= now) return; // Only past appointments

      const appointmentStatus = appointment.appointment_status?.toLowerCase();
      const opportunity = appointment.contact_id ? opportunities.find(o => o.contact_id === appointment.contact_id) : undefined;
      const pipelineStage = opportunity?.stage_name?.toLowerCase();

      // Include if: appointment status is "confirmed" OR pipeline stage contains "appointment" and "confirmed"
      const isAppointmentConfirmed = appointmentStatus === "confirmed";
      const isPipelineStageAppointmentConfirmed = pipelineStage?.includes("appointment") && pipelineStage?.includes("confirmed");
      if (isAppointmentConfirmed || isPipelineStageAppointmentConfirmed) {
        const contact = appointment.contact_id ? findContactByIdOrGhlId(contacts, undefined, appointment.contact_id) : undefined;
        const daysPast = Math.floor((now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));
        results.push({
          appointment,
          opportunity,
          contact,
          daysPast
        });
      }
    });

    // Apply rep filter
    let filtered = results;
    if (pastConfirmedRepFilter !== "all") {
      filtered = results.filter(r => r.appointment.assigned_user_id === pastConfirmedRepFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = pastConfirmedSort.direction === "asc" ? 1 : -1;
      switch (pastConfirmedSort.field) {
        case "appointment_date":
          return direction * (new Date(a.appointment.start_time!).getTime() - new Date(b.appointment.start_time!).getTime());
        case "contact_name":
          return direction * getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id));
        case "opportunity_name":
          const aName = a.opportunity?.name || "";
          const bName = b.opportunity?.name || "";
          return direction * aName.localeCompare(bName);
        default:
          return 0;
      }
    });
    return filtered;
  }, [appointments, opportunities, contacts, pastConfirmedSort, pastConfirmedRepFilter]);

  // Needs Attention Data - Open opportunities with NO appointments ever AND (stale/no notes OR expired/no tasks)
  const needsAttentionData = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const now = new Date();
    const results: Array<{
      opportunity: DBOpportunity;
      contact: DBContact | undefined;
      hasStaleOrNoNotes: boolean;
      hasExpiredOrNoTasks: boolean;
      latestNoteDate: Date | null;
      earliestOverdueDate: Date | null;
    }> = [];

    // Filter open opportunities only
    const openOpportunities = opportunities.filter(o => o.status?.toLowerCase() === "open");
    openOpportunities.forEach(opportunity => {
      if (!opportunity.contact_id) return;

      // MUST HAVE: Check for NO appointments ever (not even cancelled)
      const contactAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id);
      if (contactAppointments.length > 0) return; // Skip if any appointments exist

      // Check notes condition
      const contactNotesList = contactNotes.filter(n => n.contact_id === opportunity.contact_id);
      const latestNoteDate = getLatestNoteDate(opportunity.contact_id);
      const hasStaleOrNoNotes = contactNotesList.length === 0 || latestNoteDate !== null && latestNoteDate < sevenDaysAgo;

      // Check tasks condition - from ghl_tasks only
      const contactGhlTasks = ghlTasks.filter(t => t.contact_id === opportunity.contact_id && !t.completed);
      const hasNoTasks = contactGhlTasks.length === 0;
      const overdueTasks = contactGhlTasks.filter(t => t.due_date && new Date(t.due_date) < now);
      const hasOverdueTasks = overdueTasks.length > 0;
      const hasExpiredOrNoTasks = hasNoTasks || hasOverdueTasks;

      // MUST HAVE one of: stale notes OR expired/no tasks
      if (!hasStaleOrNoNotes && !hasExpiredOrNoTasks) return;
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);

      // Find earliest overdue task date
      let earliestOverdueDate: Date | null = null;
      if (hasOverdueTasks) {
        const dates = overdueTasks.map(t => new Date(t.due_date!)).sort((a, b) => a.getTime() - b.getTime());
        earliestOverdueDate = dates[0] || null;
      }
      results.push({
        opportunity,
        contact,
        hasStaleOrNoNotes,
        hasExpiredOrNoTasks,
        latestNoteDate,
        earliestOverdueDate
      });
    });

    // Apply rep filter
    let filtered = results;
    if (needsAttentionRepFilter !== "all") {
      filtered = results.filter(r => r.opportunity.assigned_to === needsAttentionRepFilter || r.contact?.assigned_to === needsAttentionRepFilter);
    }

    // Sort by monetary value descending
    return filtered.sort((a, b) => (b.opportunity.monetary_value || 0) - (a.opportunity.monetary_value || 0));
  }, [opportunities, appointments, contacts, contactNotes, tasks, ghlTasks, needsAttentionRepFilter]);
  const toggleSort = (view: "stale" | "noTasks" | "pastConfirmed", field: SortField) => {
    if (view === "stale") {
      setStaleNotesSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
      }));
    } else if (view === "noTasks") {
      setNoTasksSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
      }));
    } else {
      setPastConfirmedSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
      }));
    }
  };
  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await fetchGhlTasks();
      onDataRefresh?.();
      toast.success("Data refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute section order: Close to Sale first (order 0), Cold last (order 99), others by count descending
  const sectionOrder = useMemo(() => {
    const middleSections = [
      { id: 'missingScope', count: missingScopeData.length },
      { id: 'staleNew', count: staleNewCounts.total },
      { id: 'tasksHelper', count: taskCounts.total },
      { id: 'staleNotes', count: staleNotesData.length },
      { id: 'noTasks', count: noTasksData.length },
      { id: 'pastConfirmed', count: pastConfirmedData.length },
    ].sort((a, b) => b.count - a.count);

    const order: Record<string, number> = { closeToSale: 0 };
    middleSections.forEach((section, index) => {
      order[section.id] = index + 1;
    });
    order['needsAttention'] = 99; // Cold always last
    return order;
  }, [missingScopeData.length, staleNewCounts.total, taskCounts.total, staleNotesData.length, noTasksData.length, pastConfirmedData.length]);
  return <div className="space-y-3">
      {/* Header with Refresh Button */}
      

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add a note for {noteDialogContactName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Enter your note..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={isCreatingNote || !noteText.trim()}>
              {isCreatingNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create a task for {taskDialogOpportunity?.name || "this opportunity"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea id="task-notes" value={taskNotes} onChange={e => setTaskNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(user => <SelectItem key={user.ghl_id} value={user.ghl_id}>
                      {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown"}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-date">Due Date</Label>
                <Input id="task-date" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-time">Due Time (PST)</Label>
                <Input id="task-time" type="time" value={taskDueTime} onChange={e => setTaskDueTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreatingTask || !taskTitle.trim()}>
              {isCreatingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Dialog */}
      <Dialog open={scopeDialogOpen} onOpenChange={setScopeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Scope of Work</DialogTitle>
            <DialogDescription>
              Add scope of work for {scopeDialogContactName}
              {scopeDialogOpportunity?.name && ` - ${scopeDialogOpportunity.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <p className="text-sm text-muted-foreground">
                {getAddress(scopeDialogContactId)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope-text">Scope of Work</Label>
              <Textarea id="scope-text" placeholder="Enter scope of work..." value={scopeText} onChange={e => setScopeText(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScopeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveScope} disabled={isSavingScope || !scopeText.trim()}>
              {isSavingScope ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flex layout for sections - ordered by item count */}
      <div className="flex flex-wrap gap-3">
        {/* Close to Sale View - Always First */}
        <Collapsible open={closeToSaleOpen} onOpenChange={setCloseToSaleOpen} className={`w-full ${closeToSaleOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.closeToSale }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        Close to Sale
                        {closeToSaleData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="secondary" className="text-xs">
                            {closeToSaleData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        Close to Sale, Important, or Second Appointment stages
                      </CardDescription>
                    </div>
                  </div>
                  {closeToSaleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <Select value={closeToSaleRepFilter} onValueChange={setCloseToSaleRepFilter}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {closeToSaleData.length > 0 && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); exportCloseToSaleCSV(); }} className="gap-1.5">
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                  )}
                </div>

                {closeToSaleData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">All close-to-sale opportunities are handled</span>
                  </div> : <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "opportunity", direction: prev.field === "opportunity" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Opportunity
                              {closeToSaleSort.field === "opportunity" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "address", direction: prev.field === "address" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Address / Scope
                              {closeToSaleSort.field === "address" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "rep", direction: prev.field === "rep" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Assigned Rep
                              {closeToSaleSort.field === "rep" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "value", direction: prev.field === "value" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Value
                              {closeToSaleSort.field === "value" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "note_date", direction: prev.field === "note_date" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              <StickyNote className="h-3.5 w-3.5" />
                              Latest Note
                              {closeToSaleSort.field === "note_date" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "task_date", direction: prev.field === "task_date" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              <ListChecks className="h-3.5 w-3.5" />
                              Latest Task
                              {closeToSaleSort.field === "task_date" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setCloseToSaleSort(prev => ({ field: "appt_date", direction: prev.field === "appt_date" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Last Appt
                              {closeToSaleSort.field === "appt_date" && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closeToSaleData.map(opp => {
                          const latestNote = opp.contact_id ? getLatestNote(opp.contact_id) : null;
                          const latestTask = opp.contact_id ? getLatestTask(opp.contact_id) : null;
                          const latestAppt = opp.contact_id ? getLatestAppointment(opp.contact_id) : null;
                          const noteText = latestNote?.body 
                            ? latestNote.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
                            : null;

                          return <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(opp)}>
                              <TableCell className="font-medium">{opp.name || "Unnamed"}</TableCell>
                              <TableCell className="max-w-[250px]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="truncate">{getAddress(opp.contact_id)}</span>
                                  <span className="text-xs text-muted-foreground truncate">{getScope(opp.contact_id) || "-"}</span>
                                </div>
                              </TableCell>
                              <TableCell>{getUserName(opp.assigned_to)}</TableCell>
                              <TableCell className="font-medium text-green-600">
                                {formatCurrency(opp.monetary_value)}
                              </TableCell>
                              <TableCell className="text-sm min-w-[200px]">
                                {latestNote ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">
                                      {latestNote.ghl_date_added ? new Date(latestNote.ghl_date_added).toLocaleDateString() : "-"}
                                    </span>
                                    {noteText && (
                                      <span className="text-xs text-muted-foreground/70 whitespace-pre-wrap break-words">
                                        {noteText}
                                      </span>
                                    )}
                                  </div>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-sm min-w-[180px]">
                                {latestTask ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">
                                      {latestTask.due_date ? new Date(latestTask.due_date).toLocaleDateString() : "-"}
                                    </span>
                                    <span className="text-xs text-muted-foreground/70 whitespace-pre-wrap break-words">
                                      {latestTask.title}
                                    </span>
                                  </div>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {latestAppt?.start_time ? (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(latestAppt.start_time).toLocaleDateString()}
                                  </span>
                                ) : "-"}
                              </TableCell>
                            </TableRow>;
                        })}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Missing Scope of Work */}
        <Collapsible open={missingScopeOpen} onOpenChange={setMissingScopeOpen} className={`w-full ${missingScopeOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.missingScope }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        Missing Scope
                        {missingScopeData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="destructive" className="text-xs">
                            {missingScopeData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        Won or close-to-sale opportunities without scope of work
                      </CardDescription>
                    </div>
                  </div>
                  {missingScopeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {/* Filter */}
                <div className="flex items-center gap-4 mb-4">
                  <Select value={missingScopeRepFilter} onValueChange={setMissingScopeRepFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {missingScopeData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">All opportunities have scope of work defined</span>
                  </div> : <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Opportunity</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Status/Stage</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingScopeData.map(opp => {
                      const isWon = opp.status?.toLowerCase() === "won";
                      return <TableRow key={opp.id}>
                              <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => onOpenOpportunity(opp)}>
                                {opp.name || "Unnamed"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {getAddress(opp.contact_id)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isWon ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}>
                                  {isWon ? "Won" : opp.stage_name || "Unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell>{getUserName(opp.assigned_to)}</TableCell>
                              <TableCell className="font-medium text-green-600 text-right">
                                {formatCurrency(opp.monetary_value)}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleOpenScopeDialog(opp)}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Scope
                                </Button>
                              </TableCell>
                            </TableRow>;
                    })}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stale Opportunities (No Future Appts/Tasks) */}
        <Collapsible open={staleNewOpen} onOpenChange={setStaleNewOpen} className={`w-full ${staleNewOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.staleNew }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap text-base">
                        Stale Opportunities
                        {staleNewCounts.total === 0 ? (
                          <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="secondary" className="text-xs">
                              {staleNewCounts.total}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`cursor-pointer hover:opacity-80 text-xs ${staleNewCounts.newCount > 0 ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStaleNewStageFilter("__new_stages__");
                                setStaleNewSourceFilter("all");
                                setStaleNewRepFilter("all");
                                setStaleNewOpen(true);
                              }}
                            >
                              {staleNewCounts.newCount} New
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`cursor-pointer hover:opacity-80 text-xs ${staleNewCounts.otherCount > 0 ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "text-muted-foreground"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStaleNewStageFilter("__other_stages__");
                                setStaleNewSourceFilter("all");
                                setStaleNewRepFilter("all");
                                setStaleNewOpen(true);
                              }}
                            >
                              {staleNewCounts.otherCount} Other
                            </Badge>
                          </>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        No future appointment or task scheduled
                      </CardDescription>
                    </div>
                  </div>
                  {staleNewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <Select value={staleNewStageFilter} onValueChange={setStaleNewStageFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages (excl. QB)</SelectItem>
                      <SelectItem value="__new_stages__">New Stages Only</SelectItem>
                      <SelectItem value="__other_stages__">Other Stages Only</SelectItem>
                      {staleFilterOptions.stages.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={staleNewSourceFilter} onValueChange={setStaleNewSourceFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {staleFilterOptions.sources.map(source => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={staleNewRepFilter} onValueChange={setStaleNewRepFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {staleFilterOptions.reps.map(rep => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(staleNewStageFilter !== "all" || staleNewSourceFilter !== "all" || staleNewRepFilter !== "all") && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setStaleNewStageFilter("all");
                        setStaleNewSourceFilter("all");
                        setStaleNewRepFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                {staleNewData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">No stale opportunities found</span>
                  </div> : <div className="rounded-md border overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "name", direction: prev.field === "name" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Opportunity
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "address", direction: prev.field === "address" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Address
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "stage", direction: prev.field === "stage" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Pipeline Stage
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "source", direction: prev.field === "source" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Source
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "rep", direction: prev.field === "rep" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Assigned Rep
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => setStaleNewSort(prev => ({ field: "value", direction: prev.field === "value" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1 justify-end">
                              Value
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setStaleNewSort(prev => ({ field: "date_added", direction: prev.field === "date_added" && prev.direction === "asc" ? "desc" : "asc" }))}
                          >
                            <div className="flex items-center gap-1">
                              Date Added
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead>Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staleNewData.map(opp => {
                          const isNewStage = opp.stage_name?.toLowerCase().includes("new");
                          return (
                            <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(opp)}>
                              <TableCell className="font-medium">{opp.name || "Unnamed"}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {getAddress(opp.contact_id)}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={isNewStage 
                                    ? "bg-blue-500/10 text-blue-700 border-blue-500/30" 
                                    : "bg-orange-500/10 text-orange-700 border-orange-500/30"
                                  }
                                >
                                  {opp.stage_name || "Unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {getContactSource(opp.contact_id) || "-"}
                              </TableCell>
                            <TableCell>{getUserName(opp.assigned_to)}</TableCell>
                              <TableCell className="font-medium text-green-600 text-right">
                                {formatCurrency(opp.monetary_value)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {opp.ghl_date_added ? format(new Date(opp.ghl_date_added), "MMM d, yyyy") : "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {opp.ghl_date_added ? Math.floor((Date.now() - new Date(opp.ghl_date_added).getTime()) / (1000 * 60 * 60 * 24)) : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tasks Helper */}
        <Collapsible open={tasksHelperOpen} onOpenChange={setTasksHelperOpen} className={`w-full ${tasksHelperOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.tasksHelper }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <CheckSquare className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap text-base">
                        Tasks Helper
                        {taskCounts.total === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <>
                            <Badge variant="secondary" className="text-xs">
                              {taskCounts.total}
                            </Badge>
                            <Badge variant="outline" className={`cursor-pointer hover:opacity-80 text-xs ${taskCounts.pastDue > 0 ? "bg-red-500/10 text-red-600 border-red-500/30" : "text-muted-foreground"}`} onClick={e => {
                          e.stopPropagation();
                          setTasksDueDateFilter("past_due");
                          setTasksHelperOpen(true);
                        }}>
                              {taskCounts.pastDue} past due
                            </Badge>
                            <Badge variant="outline" className={`cursor-pointer hover:opacity-80 text-xs ${taskCounts.today > 0 ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "text-muted-foreground"}`} onClick={e => {
                          e.stopPropagation();
                          setTasksDueDateFilter("today");
                          setTasksHelperOpen(true);
                        }}>
                              {taskCounts.today} today
                            </Badge>
                            <Badge variant="outline" className={`cursor-pointer hover:opacity-80 text-xs ${taskCounts.tomorrow > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "text-muted-foreground"}`} onClick={e => {
                          e.stopPropagation();
                          setTasksDueDateFilter("tomorrow");
                          setTasksHelperOpen(true);
                        }}>
                              {taskCounts.tomorrow} tomorrow
                            </Badge>
                            <Badge variant="outline" className="cursor-pointer hover:opacity-80 text-muted-foreground text-xs hidden sm:inline-flex" onClick={e => {
                          e.stopPropagation();
                          setTasksDueDateFilter("future");
                          setTasksHelperOpen(true);
                        }}>
                              {taskCounts.future} future
                            </Badge>
                          </>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        GHL tasks - click to view opportunity
                      </CardDescription>
                    </div>
                  </div>
                  {tasksHelperOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <Button variant="outline" size="sm" onClick={fetchGhlTasks} disabled={isLoadingTasks}>
                    {isLoadingTasks ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Refresh
                  </Button>
                  <Select value={tasksAssigneeFilter} onValueChange={setTasksAssigneeFilter}>
                    <SelectTrigger className="w-[160px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {uniqueTaskAssignees.map(a => <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={tasksDueDateFilter} onValueChange={v => setTasksDueDateFilter(v as DueDateFilter)}>
                    <SelectTrigger className="w-[180px]">
                      <Clock className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Due Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Due Dates</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                      <SelectItem value="today">Due: Today</SelectItem>
                      <SelectItem value="tomorrow">Due: Tomorrow</SelectItem>
                      <SelectItem value="future">Due: Future</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoadingTasks && ghlTasks.length === 0 ? <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading tasks from GHL...</span>
                  </div> : filteredGhlTasks.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">All tasks are handled</span>
                  </div> : <div className="space-y-3">
                    {filteredGhlTasks.map(task => {
                  const overdue = isTaskOverdue(task.due_date);
                  const contactName = getContactName(task.contact_id);
                  const opportunity = getOpportunityForContact(task.contact_id);
                  return <div key={task.id} className={`border rounded-lg p-4 transition-colors cursor-pointer hover:bg-muted/50 ${overdue ? "bg-destructive/5 border-destructive/30" : "bg-card border-border/50"}`} onClick={() => handleTaskClick(task)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{task.title}</span>
                                {overdue && <Badge variant="destructive" className="text-xs">
                                    Overdue
                                  </Badge>}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTaskDueDate(task.due_date)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {getUserName(task.assigned_to)}
                                </span>
                              </div>
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">​</span>{" "}
                                {opportunity && <>
                                    <span className="text-muted-foreground ml-3 mx-0">Opp:</span>{" "}
                                    <span className="font-medium">{opportunity.name || "Unnamed"}</span>
                                  </>}
                              </div>
                              {task.body && <p className="text-sm text-muted-foreground mt-2 italic line-clamp-2">
                                  {stripHtml(task.body)}
                                </p>}
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>;
                })}
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Needs Attention (Cold) View */}
        <Collapsible open={needsAttentionOpen} onOpenChange={setNeedsAttentionOpen} className={`w-full ${needsAttentionOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.needsAttention }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Snowflake className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        Needs Attention (Cold)
                        {needsAttentionData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="secondary" className="text-xs">
                            {needsAttentionData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        No appointments ever + stale notes or expired tasks
                      </CardDescription>
                    </div>
                  </div>
                  {needsAttentionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Select value={needsAttentionRepFilter} onValueChange={v => {
                  setNeedsAttentionRepFilter(v);
                  setNeedsAttentionPage(1);
                }}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {needsAttentionData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">No cold opportunities needing attention</span>
                  </div> : <>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contact</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Pipeline Stage</TableHead>
                            <TableHead>Warnings</TableHead>
                            <TableHead>Assigned Rep</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {needsAttentionData.slice((needsAttentionPage - 1) * NEEDS_ATTENTION_PAGE_SIZE, needsAttentionPage * NEEDS_ATTENTION_PAGE_SIZE).map(row => {
                        return <TableRow key={row.opportunity.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(row.opportunity)}>
                                  <TableCell className="font-medium">
                                    {getContactName(row.opportunity.contact_id)}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {getAddress(row.opportunity.contact_id)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{row.opportunity.stage_name || "Unknown"}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-500/30 text-xs">
                                        No Appts
                                      </Badge>
                                      {row.hasStaleOrNoNotes && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                                          {row.latestNoteDate ? "Stale Notes" : "No Notes"}
                                        </Badge>}
                                      {row.hasExpiredOrNoTasks && <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30 text-xs">
                                          {row.earliestOverdueDate ? "Overdue Tasks" : "No Tasks"}
                                        </Badge>}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {getUserName(row.opportunity.assigned_to || row.contact?.assigned_to)}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(row.opportunity.monetary_value)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button variant="outline" size="sm" onClick={e => {
                                e.stopPropagation();
                                handleOpenNoteDialog(row.opportunity.contact_id!, getContactName(row.opportunity.contact_id));
                              }}>
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={e => {
                                e.stopPropagation();
                                handleOpenTaskDialog(row.opportunity, row.opportunity.contact_id, getContactName(row.opportunity.contact_id));
                              }}>
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>;
                      })}
                        </TableBody>
                      </Table>
                    </div>
                    {needsAttentionData.length > NEEDS_ATTENTION_PAGE_SIZE && <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-muted-foreground">
                          Showing {(needsAttentionPage - 1) * NEEDS_ATTENTION_PAGE_SIZE + 1}-
                          {Math.min(needsAttentionPage * NEEDS_ATTENTION_PAGE_SIZE, needsAttentionData.length)} of{" "}
                          {needsAttentionData.length}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setNeedsAttentionPage(p => Math.max(1, p - 1))} disabled={needsAttentionPage === 1}>
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setNeedsAttentionPage(p => Math.min(Math.ceil(needsAttentionData.length / NEEDS_ATTENTION_PAGE_SIZE), p + 1))} disabled={needsAttentionPage >= Math.ceil(needsAttentionData.length / NEEDS_ATTENTION_PAGE_SIZE)}>
                            Next
                          </Button>
                        </div>
                      </div>}
                  </>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stale Notes View */}
        <Collapsible open={staleNotesOpen} onOpenChange={setStaleNotesOpen} className={`w-full ${staleNotesOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.staleNotes }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        Stale Notes
                        {staleNotesData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="secondary" className="text-xs">
                            {staleNotesData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        Notes before appointment or no notes exist
                      </CardDescription>
                    </div>
                  </div>
                  {staleNotesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Select value={staleNotesRepFilter} onValueChange={setStaleNotesRepFilter}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {staleNotesData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">All appointments have recent notes</span>
                  </div> : <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("stale", "contact_name")}>
                              Contact <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("stale", "appointment_date")}>
                              Appointment <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("stale", "last_note_date")}>
                              Last Note <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>Pipeline Stage</TableHead>
                          <TableHead>Assigned Rep</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staleNotesData.map(row => {
                      const isOld = row.daysSinceNote !== null && row.daysSinceNote > 7;
                      return <TableRow key={row.appointment.id} className={`cursor-pointer hover:bg-muted/50 ${isOld || row.daysSinceNote === null ? "bg-red-50 dark:bg-red-950/20" : ""}`} onClick={() => onOpenOpportunity(row.opportunity)}>
                              <TableCell className="font-medium">
                                {getContactName(row.appointment.contact_id)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {row.appointment.start_time ? format(new Date(row.appointment.start_time), "MMM d, yyyy h:mm a") : "No date"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {row.lastNoteDate ? <span className={isOld ? "text-red-600 font-medium" : ""}>
                                    {formatDistanceToNow(row.lastNoteDate, {
                              addSuffix: true
                            })}
                                  </span> : <Badge variant="destructive">No notes</Badge>}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{row.opportunity.stage_name || "Unknown"}</Badge>
                              </TableCell>
                              <TableCell>{getUserName(row.opportunity.assigned_to)}</TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(row.opportunity.monetary_value)}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={e => {
                            e.stopPropagation();
                            handleOpenNoteDialog(row.appointment.contact_id!, getContactName(row.appointment.contact_id));
                          }}>
                                  <FileText className="h-4 w-4 mr-1" />
                                  Add Note
                                </Button>
                              </TableCell>
                            </TableRow>;
                    })}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* No Tasks View */}
        <Collapsible open={noTasksOpen} onOpenChange={setNoTasksOpen} className={`w-full ${noTasksOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.noTasks }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        No Tasks - Post Appt
                        {noTasksData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="secondary" className="text-xs">
                            {noTasksData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        Past appointments but no tasks created
                      </CardDescription>
                    </div>
                  </div>
                  {noTasksOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Select value={noTasksRepFilter} onValueChange={setNoTasksRepFilter}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {noTasksData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">All open opportunities have tasks assigned</span>
                  </div> : <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("noTasks", "contact_name")}>
                              Contact <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("noTasks", "appointment_date")}>
                              Last Appointment <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>Pipeline Stage</TableHead>
                          <TableHead>Assigned Rep</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {noTasksData.map(row => <TableRow key={row.opportunity.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(row.opportunity)}>
                            <TableCell className="font-medium">{getContactName(row.opportunity.contact_id)}</TableCell>
                            <TableCell>{row.opportunity.name || "Unnamed"}</TableCell>
                            <TableCell>
                              {row.latestAppointment?.start_time ? <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(row.latestAppointment.start_time), "MMM d, yyyy")}
                                </div> : "No date"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.opportunity.stage_name || "Unknown"}</Badge>
                            </TableCell>
                            <TableCell>
                              {getUserName(row.opportunity.assigned_to || row.contact?.assigned_to)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(row.opportunity.monetary_value)}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={e => {
                          e.stopPropagation();
                          handleOpenTaskDialog(row.opportunity, row.opportunity.contact_id, getContactName(row.opportunity.contact_id));
                        }}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Task
                              </Button>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Past Confirmed Appointments View */}
        <Collapsible open={pastConfirmedOpen} onOpenChange={setPastConfirmedOpen} className={`w-full ${pastConfirmedOpen ? "" : "lg:w-[calc(50%-0.375rem)]"}`} style={{ order: sectionOrder.pastConfirmed }}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        Past Confirmed
                        {pastConfirmedData.length === 0 ? <Badge className="text-xs bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            All set!
                          </Badge> : <Badge variant="secondary" className="text-xs">
                            {pastConfirmedData.length}
                          </Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">
                        Past appointments still "Confirmed"
                      </CardDescription>
                    </div>
                  </div>
                  {pastConfirmedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Select value={pastConfirmedRepFilter} onValueChange={setPastConfirmedRepFilter}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {pastConfirmedData.length === 0 ? <div className="text-center py-8 flex flex-col items-center gap-2">
                    <PartyPopper className="h-8 w-8 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Nothing to update!</span>
                    <span className="text-muted-foreground text-sm">No past appointments requiring updates</span>
                  </div> : <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("pastConfirmed", "opportunity_name")}>
                              Opportunity <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort("pastConfirmed", "appointment_date")}>
                              Appointment Date <ArrowUpDown className="h-3 w-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead>Days Past</TableHead>
                          <TableHead>Assigned Rep</TableHead>
                          <TableHead>Pipeline Stage</TableHead>
                          <TableHead>Appt Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastConfirmedData.map(row => <TableRow key={row.appointment.id} className={`cursor-pointer hover:bg-muted/50 ${row.daysPast > 7 ? "bg-red-50 dark:bg-red-950/20" : ""}`} onClick={() => row.opportunity && onOpenOpportunity(row.opportunity)}>
                            <TableCell className="font-medium">{row.opportunity?.name || "No opportunity"}</TableCell>
                            <TableCell>{row.appointment.title || "No title"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {row.appointment.start_time ? format(new Date(row.appointment.start_time), "MMM d, yyyy h:mm a") : "No date"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.daysPast > 7 ? "destructive" : "secondary"}>
                                {row.daysPast} {row.daysPast === 1 ? "day" : "days"} ago
                              </Badge>
                            </TableCell>
                            <TableCell>{getUserName(row.appointment.assigned_user_id)}</TableCell>
                            <TableCell>
                              {row.opportunity ? <Select value="" onValueChange={value => handleUpdatePipelineStage(row.opportunity!, value)} disabled={updatingPipelineStageId === row.opportunity.id}>
                                  <SelectTrigger className="w-[160px]" onClick={e => e.stopPropagation()}>
                                    {updatingPipelineStageId === row.opportunity.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder={row.opportunity.stage_name || "Set stage"} />}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableStages.map(stage => <SelectItem key={stage} value={stage}>
                                        {stage}
                                      </SelectItem>)}
                                  </SelectContent>
                                </Select> : <span className="text-muted-foreground text-sm">-</span>}
                            </TableCell>
                            <TableCell>
                              <Select value={row.appointment.appointment_status?.toLowerCase() || ""} onValueChange={value => handleUpdateAppointmentStatus(row.appointment.id, value)} disabled={updatingAppointmentId === row.appointment.id}>
                                <SelectTrigger className="w-[130px]" onClick={e => e.stopPropagation()}>
                                  {updatingAppointmentId === row.appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="showed">Showed</SelectItem>
                                  <SelectItem value="noshow">No Show</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>;
}