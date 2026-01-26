import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppointmentEditDialog } from "./AppointmentEditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calendar,
  Clock,
  User,
  FileText,
  DollarSign,
  Target,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  RefreshCw,
  MessageSquare,
  CheckSquare,
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Trash2,
  PhoneCall,
  Copy,
  FileCheck,
  Eye,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripHtml, getAddressFromContact, CUSTOM_FIELD_IDS as SHARED_CUSTOM_FIELD_IDS, extractCustomField as sharedExtractCustomField, findContactByIdOrGhlId } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";

// Helper to get PST/PDT offset in hours
const getPSTOffset = (utcDate: Date): number => {
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + ((7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7), 10));
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + ((7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7), 9));
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8;
};

const APPOINTMENT_STATUSES = ["new", "confirmed", "cancelled", "no_show", "noshow", "showed"] as const;

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
  address?: string | null;
  salesperson_confirmed?: boolean;
  salesperson_confirmed_at?: string | null;
  location_id?: string;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_name: string | null;
  stage_name: string | null;
  contact_id: string | null;
  address?: string | null;
  scope_of_work?: string | null;
}

interface CustomField {
  id: string;
  value?: string;
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
  custom_fields?: CustomField[] | unknown;
  attributions?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Message {
  id: string;
  body: string;
  direction: string;
  status: string;
  type: string;
  dateAdded: string;
}

interface Conversation {
  ghl_id: string;
  type: string;
  messages: Message[];
  last_message_date: string;
}

interface ContactNote {
  id: string;
  ghl_id: string;
  body: string | null;
  user_id: string | null;
  ghl_date_added: string | null;
  entered_by: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  creator?: { full_name: string | null } | null;
}

interface Task {
  id: string;
  ghl_id: string;
  title: string;
  body?: string | null;
  notes?: string | null;
  due_date: string | null;
  completed?: boolean;
  status?: string;
  assigned_to: string | null;
}

interface AppointmentDetailSheetProps {
  appointment: Appointment | null;
  opportunities: Opportunity[];
  contacts: Contact[];
  users: GHLUser[];
  appointments?: Appointment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOpportunity?: (opportunity: Opportunity) => void;
  onRefresh?: () => void;
}

// Use shared CUSTOM_FIELD_IDS and extractCustomField from utils
const CUSTOM_FIELD_IDS = SHARED_CUSTOM_FIELD_IDS;
const extractCustomField = sharedExtractCustomField;

interface GHLCalendar {
  ghl_id: string;
  name: string | null;
  is_active: boolean | null;
  location_id?: string;
  team_members?: { userId: string }[] | null;
}

export function AppointmentDetailSheet({
  appointment,
  opportunities,
  contacts,
  users,
  appointments = [],
  open,
  onOpenChange,
  onOpenOpportunity,
  onRefresh,
}: AppointmentDetailSheetProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  
  // Estimates state
  const [estimates, setEstimates] = useState<{ id: string; estimate_number: number | null; status: string | null; total: number | null; created_at: string }[]>([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  
  // Collapsible section states - all collapsed by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Task creation state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("09:00");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Appointment editing state - now using shared dialog
  const [appointmentEditDialogOpen, setAppointmentEditDialogOpen] = useState(false);
  
  // Calendars state for appointment editing
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);

  // Delete state
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false);

  // Salesperson confirmation state
  const [salespersonConfirmed, setSalespersonConfirmed] = useState(false);
  const [isUpdatingSalespersonConfirmed, setIsUpdatingSalespersonConfirmed] = useState(false);
  
  // Direct status update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Local status state to reflect changes immediately in UI
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  
  // Salesperson assignment state
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);
  const [localAssignedUserId, setLocalAssignedUserId] = useState<string | null>(null);

  // Contact editing state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactAddress, setEditContactAddress] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Optimistic UI: immediately reflect saved contact fields while parent refetch runs
  const [optimisticContact, setOptimisticContact] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  } | null>(null);

  // Work scope editing state
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [editScopeValue, setEditScopeValue] = useState("");
  const [isSavingScope, setIsSavingScope] = useState(false);
  const [optimisticScope, setOptimisticScope] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const contact = appointment ? findContactByIdOrGhlId(contacts, appointment.contact_uuid, appointment.contact_id) : null;
  const relatedOpportunities = appointment ? opportunities.filter((o) => o.contact_id === appointment.contact_id) : [];
  const primaryOpportunity = relatedOpportunities[0];

  // Clear optimistic overrides once fresh props land (or when switching appointments)
  // NOTE: must be declared before any conditional returns to preserve hooks order.
  useEffect(() => {
    setOptimisticContact(null);
  }, [
    appointment?.contact_id,
    contact?.contact_name,
    contact?.first_name,
    contact?.last_name,
    contact?.phone,
    appointment?.address,
    primaryOpportunity?.address,
  ]);

  // Reset optimistic scope when opportunity changes
  useEffect(() => {
    setOptimisticScope(null);
  }, [primaryOpportunity?.ghl_id]);

  // Fetch conversations
  const fetchConversations = async () => {
    if (!appointment?.contact_id) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-contact-conversations", {
        body: { contact_id: appointment.contact_id },
      });
      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Fetch contact notes from database
  const fetchContactNotes = async () => {
    if (!appointment?.contact_id) return;
    setLoadingNotes(true);
    try {
      // Fetch from edge function to ensure latest from GHL
      const { data: ghlData, error: ghlError } = await supabase.functions.invoke("fetch-contact-notes", {
        body: { contact_id: appointment.contact_id },
      });
      if (ghlError) console.error("Error fetching from GHL:", ghlError);

      // Then fetch from database with creator info
      const { data, error } = await supabase
        .from("contact_notes")
        .select("*, creator:profiles!contact_notes_entered_by_fkey(full_name)")
        .eq("contact_id", appointment.contact_id)
        .order("ghl_date_added", { ascending: false });

      if (error) throw error;
      setContactNotes(data || []);
    } catch (error) {
      console.error("Error fetching contact notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Fetch tasks from ghl_tasks only
  const fetchTasks = async () => {
    if (!appointment?.contact_id) return;
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from("ghl_tasks")
        .select("*")
        .eq("contact_id", appointment.contact_id)
        .order("due_date", { ascending: true });

      if (error) throw error;

      const tasks: Task[] = (data || []).map((t) => ({
        id: t.id,
        ghl_id: t.ghl_id,
        title: t.title,
        body: t.body,
        due_date: t.due_date,
        completed: t.completed,
        status: t.completed ? "completed" : "pending",
        assigned_to: t.assigned_to,
      }));

      setTasks(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Fetch estimates for the contact
  const fetchEstimates = async () => {
    if (!contact?.id) return;
    setLoadingEstimates(true);
    try {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, status, total, created_at")
        .eq("contact_uuid", contact.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEstimates(data || []);
    } catch (error) {
      console.error("Error fetching estimates:", error);
    } finally {
      setLoadingEstimates(false);
    }
  };

  // Add new note
  const handleAddNote = async () => {
    if (!appointment?.contact_id || !newNoteBody.trim()) return;
    setIsAddingNote(true);
    try {
      const { error } = await supabase.functions.invoke("create-contact-note", {
        body: { contactId: appointment.contact_id, body: newNoteBody.trim(), enteredBy: user?.id || null },
      });
      if (error) throw error;
      toast.success("Note added successfully");
      setNewNoteBody("");
      setShowAddNote(false);
      fetchContactNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  // Toggle task completion
  const handleToggleTask = async (task: Task) => {
    if (task.ghl_id) {
      try {
        const newCompleted = !task.completed;
        const oldCompleted = task.completed;

        // Update ghl_tasks table with edit tracking
        const { error: dbError } = await supabase
          .from("ghl_tasks")
          .update({ 
            completed: newCompleted,
            edited_by: user?.id || null,
            edited_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        if (dbError) throw dbError;

        // Record edit in task_edits table
        await supabase.from("task_edits").insert({
          task_ghl_id: task.ghl_id,
          contact_ghl_id: appointment?.contact_id || null,
          field_name: "completed",
          old_value: String(oldCompleted),
          new_value: String(newCompleted),
          edited_by: user?.id || null,
          location_id: appointment?.location_id || null,
          company_id: companyId,
        });

        // Update GHL API
        const { error } = await supabase.functions.invoke("update-ghl-task", {
          body: {
            contactId: appointment?.contact_id,
            taskId: task.ghl_id,
            completed: newCompleted,
          },
        });
        if (error) throw error;

        // Update local state
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, completed: newCompleted, status: newCompleted ? "completed" : "pending" } : t,
          ),
        );
        queryClient.invalidateQueries({ queryKey: ["task_edits"] });
        toast.success(newCompleted ? "Task completed" : "Task reopened");
      } catch (error) {
        console.error("Error updating task:", error);
        toast.error("Failed to update task");
      }
    }
  };

  // Sync salesperson confirmed state, local status, and assigned user with appointment prop
  useEffect(() => {
    if (appointment) {
      setSalespersonConfirmed(appointment.salesperson_confirmed || false);
      setLocalStatus(appointment.appointment_status || null);
      setLocalAssignedUserId(appointment.assigned_user_id || null);
    }
  }, [appointment]);

  // Toggle salesperson confirmed
  const handleToggleSalespersonConfirmed = async () => {
    // Support both ghl_id and id (for Google/local appointments)
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;
    
    setIsUpdatingSalespersonConfirmed(true);
    const oldValue = salespersonConfirmed;
    try {
      const newValue = !salespersonConfirmed;
      
      // Use id (UUID) if available, otherwise fall back to ghl_id
      let query = supabase
        .from("appointments")
        .update({
          salesperson_confirmed: newValue,
          salesperson_confirmed_at: newValue ? new Date().toISOString() : null,
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        });
      
      if (appointment?.id) {
        query = query.eq("id", appointment.id);
      } else if (appointment?.ghl_id) {
        query = query.eq("ghl_id", appointment.ghl_id);
      }
      
      const { error } = await query;

      if (error) throw error;

      // Record edit in appointment_edits table (ghl_id may be null for local/Google appointments)
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appointment?.ghl_id || appointment?.id || "unknown",
        contact_ghl_id: appointment?.contact_id,
        field_name: "salesperson_confirmed",
        old_value: String(oldValue),
        new_value: String(newValue),
        edited_by: user?.id || null,
        location_id: appointment?.location_id,
        company_id: companyId,
      });

      setSalespersonConfirmed(newValue);
      // Force immediate refetch of all appointment-related queries
      await queryClient.invalidateQueries({ queryKey: ["appointments"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["appointment_edits"] });
      toast.success(newValue ? "Salesperson confirmed" : "Confirmation removed");
    } catch (error) {
      console.error("Error updating salesperson confirmation:", error);
      toast.error("Failed to update confirmation");
    } finally {
      setIsUpdatingSalespersonConfirmed(false);
    }
  };

  // Direct status update handler
  const handleUpdateStatusDirect = async (newStatus: string) => {
    if (!appointment?.ghl_id) return;
    setIsUpdatingStatus(true);
    try {
      // Update appointment (saves to Supabase, syncs to GHL if connected)
      const { error: ghlError } = await supabase.functions.invoke('update-ghl-appointment', {
        body: { ghl_id: appointment.ghl_id, appointment_status: newStatus }
      });
      if (ghlError) throw ghlError;

      // Update in Supabase with edit tracking
      const { error: dbError } = await supabase
        .from('appointments')
        .update({ 
          appointment_status: newStatus, 
          ghl_date_updated: new Date().toISOString(),
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        })
        .eq('ghl_id', appointment.ghl_id);
      if (dbError) throw dbError;

      // Update local status immediately so UI reflects change
      setLocalStatus(newStatus);
      
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`Status updated to ${newStatus}`);
      
      // Auto-refresh after update
      onRefresh?.();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Update assigned user directly from details card
  const handleUpdateAssigneeDirect = async (newAssignedUserId: string) => {
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;
    
    const effectiveUserId = newAssignedUserId === "__unassigned__" ? null : newAssignedUserId;
    
    setIsUpdatingAssignee(true);
    try {
      // Update via edge function (syncs to GHL if connected)
      if (appointment?.ghl_id) {
        const { error: ghlError } = await supabase.functions.invoke('update-ghl-appointment', {
          body: { ghl_id: appointment.ghl_id, assignedUserId: effectiveUserId }
        });
        if (ghlError) {
          console.warn("GHL sync failed, updating locally:", ghlError);
        }
      }

      // Update in Supabase with edit tracking
      let query = supabase
        .from('appointments')
        .update({ 
          assigned_user_id: effectiveUserId, 
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        });
      
      if (appointment?.id) {
        query = query.eq('id', appointment.id);
      } else if (appointment?.ghl_id) {
        query = query.eq('ghl_id', appointment.ghl_id);
      }
      
      const { error: dbError } = await query;
      if (dbError) throw dbError;

      // Update local state immediately so UI reflects change
      setLocalAssignedUserId(effectiveUserId);
      
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      const assignedUserName = effectiveUserId 
        ? users.find(u => u.ghl_id === effectiveUserId)?.name || 
          users.find(u => u.ghl_id === effectiveUserId)?.first_name || 
          "Assigned"
        : "Unassigned";
      toast.success(`Assigned to ${assignedUserName}`);
      
      onRefresh?.();
    } catch (error) {
      console.error('Error updating assigned user:', error);
      toast.error("Failed to update assignee");
    } finally {
      setIsUpdatingAssignee(false);
    }
  };

  // Open task dialog
  const contactNameFromData =
    contact?.contact_name ||
    (contact?.first_name && contact?.last_name
      ? `${contact.first_name} ${contact.last_name}`
      : contact?.first_name || contact?.last_name || "Unknown");

  const contactName = optimisticContact?.name ?? contactNameFromData;

  const openTaskDialog = () => {
    setTaskTitle(`Follow up: ${contactName || "Contact"}`);
    setTaskNotes("");
    setTaskAssignee(appointment?.assigned_user_id || "__unassigned__");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };

  // Create task
  const handleCreateTask = async () => {
    if (!appointment?.contact_id || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsCreatingTask(true);
    try {
      const locationId = "pVeFrqvtYWNIPRIi0Fmr";
      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;

      // Combine date and time, treating input as PST
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        const pstOffset = getPSTOffset(new Date(`${taskDueDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${taskDueDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      // Create task (saves to Supabase, syncs to GHL if connected)
      const ghlResponse = await supabase.functions.invoke("create-ghl-task", {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateValue,
          assignedTo: assignedToValue,
          contactId: appointment.contact_id,
          locationId: locationId,
          enteredBy: user?.id || null,
        },
      });

      if (ghlResponse.error) {
        console.error("Task creation error:", ghlResponse.error);
        toast.error("Failed to create task");
        return;
      }

      toast.success("Task created");

      // Refresh tasks list
      await fetchTasks();

      setTaskDialogOpen(false);
      setTaskTitle("");
      setTaskNotes("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskDueTime("09:00");
    } catch (err) {
      console.error("Error creating task:", err);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Open appointment edit dialog - now just sets state, dialog handles everything
  const openAppointmentEditDialog = () => {
    setAppointmentEditDialogOpen(true);
  };

  // Fetch calendars for the location scoped by company
  const fetchCalendars = async () => {
    if (!appointment?.location_id || !companyId) return;
    try {
      // Scope by company_id for tenant isolation
      const { data, error } = await supabase
        .from("ghl_calendars")
        .select("ghl_id, name, is_active, location_id, team_members")
        .eq("is_active", true)
        .eq("company_id", companyId);
      
      if (error) throw error;
      // Parse team_members from JSON if needed
      const calendarsWithTeam = (data || []).map(cal => ({
        ...cal,
        team_members: Array.isArray(cal.team_members) 
          ? (cal.team_members as unknown as { userId: string }[])
          : null
      }));
      setCalendars(calendarsWithTeam);
    } catch (error) {
      console.error("Error fetching calendars:", error);
    }
  };

  // Fetch data when sheet opens
  useEffect(() => {
    if (open && appointment?.contact_id) {
      fetchConversations();
      fetchContactNotes();
      fetchTasks();
      fetchCalendars();
    }
  }, [open, appointment?.contact_id, appointment?.location_id]);

  // Fetch estimates when contact changes
  useEffect(() => {
    if (open && contact?.id) {
      fetchEstimates();
    }
  }, [open, contact?.id]);

  if (!appointment) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "no_show":
      case "noshow":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "showed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "new":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-foreground border-border";
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Use local state for assigned user to reflect changes immediately
  const effectiveAssignedUserId = localAssignedUserId ?? appointment.assigned_user_id;
  const assignedUser = users.find((u) => u.ghl_id === effectiveAssignedUserId);

  const userName =
    assignedUser?.name ||
    (assignedUser?.first_name && assignedUser?.last_name
      ? `${assignedUser.first_name} ${assignedUser.last_name}`
      : "Unassigned");

  // Get address: first try contact custom_fields, then current appointment, then any other appointment for this contact, then opportunity address
  const contactAddress = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
  const currentAppointmentAddress = appointment?.address;
  const otherAppointmentAddress = appointment?.contact_id 
    ? appointments.find(a => a.contact_id === appointment.contact_id && a.address)?.address 
    : null;
  // Fallback to opportunity address if contact address is null
  const opportunityAddress = primaryOpportunity?.address || null;
  const address = contactAddress || currentAppointmentAddress || otherAppointmentAddress || opportunityAddress || null;
  const displayAddress = optimisticContact?.address ?? address;
  const displayPhone = optimisticContact?.phone ?? (contact?.phone || "");
  // Get scope from custom_fields, or fall back to attributions.utmContent for Location 2 contacts
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

  // Get all messages from all conversations, sorted by date
  const allMessages = conversations
    .flatMap((c) => c.messages)
    .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());

  const handleOpenOpportunity = (opp: Opportunity) => {
    if (onOpenOpportunity) {
      onOpenChange(false);
      setTimeout(() => onOpenOpportunity(opp), 150);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointment) return;
    setIsDeletingAppointment(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-ghl-appointment", {
        body: { 
          appointmentId: appointment.ghl_id,
          appointmentUuid: appointment.id, // Fallback for appointments without ghl_id
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Appointment deleted");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["today-appointments-count"] });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Failed to delete appointment");
    } finally {
      setIsDeletingAppointment(false);
    }
  };

  // Helper to toggle collapsible sections
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Helper to properly capitalize contact name
  const capitalizeContactName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Helper to format phone numbers: (XXX) XXX-XXXX
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "";
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");
    // Handle US numbers with country code
    const normalized = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
    if (normalized.length === 10) {
      return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }
    // Return original if not a standard 10-digit number
    return phone;
  };

  // Initialize contact edit fields when entering edit mode
  const startEditingContact = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContactName(contactName);
    setEditContactPhone(displayPhone);
    setEditContactEmail(contact?.email || "");
    setEditContactAddress(displayAddress || "");
    setIsEditingContact(true);
  };

  // Cancel editing contact
  const cancelEditingContact = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingContact(false);
  };

  // Save contact changes
  const handleSaveContact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact?.ghl_id && !contact?.id) {
      toast.error("Cannot update contact: missing ID");
      return;
    }

    setIsSavingContact(true);
    try {
      // Update contact name if changed
      const originalName = contactName;
      if (editContactName.trim() !== originalName) {
        // Split name into first and last name for the edge function
        const nameParts = editContactName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        const { error: nameError } = await supabase.functions.invoke("update-contact-name", {
          body: { 
            contactId: contact.ghl_id, 
            firstName,
            lastName,
            editedBy: user?.id || null,
            opportunityGhlId: primaryOpportunity?.ghl_id || null,
            companyId: companyId,
          },
        });
        if (nameError) throw nameError;
      }

      // Update phone if changed
      if (editContactPhone.trim() !== (contact?.phone || "")) {
        const { error: phoneError } = await supabase.functions.invoke("update-contact-phone", {
          body: { 
            contactId: contact.ghl_id, 
            phone: editContactPhone.trim() 
          },
        });
        if (phoneError) throw phoneError;
      }

      // Update email if changed
      if (editContactEmail.trim() !== (contact?.email || "")) {
        const { error: emailError } = await supabase.functions.invoke("update-contact-email", {
          body: { 
            contactId: contact.ghl_id,
            contactUuid: contact.id,
            email: editContactEmail.trim(),
            editedBy: user?.id || null,
            opportunityGhlId: primaryOpportunity?.ghl_id || null,
            companyId: companyId,
          },
        });
        if (emailError) throw emailError;
      }

      // Update address via opportunity if we have a primary opportunity
      if (editContactAddress.trim() !== (displayAddress || "") && primaryOpportunity) {
        const { error: addressError } = await supabase.functions.invoke("update-opportunity-address", {
          body: { 
            opportunityGhlId: primaryOpportunity.ghl_id, 
            address: editContactAddress.trim(),
            editedBy: user?.id || null,
          },
        });
        if (addressError) throw addressError;
      }

      // Immediately reflect new values in the sheet while Calendar refetch catches up
      setOptimisticContact({
        name: editContactName.trim(),
        phone: editContactPhone.trim(),
        email: editContactEmail.trim(),
        address: editContactAddress.trim(),
      });

      toast.success("Contact updated successfully");
      setIsEditingContact(false);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onRefresh?.();
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    } finally {
      setIsSavingContact(false);
    }
  };

  // Start editing work scope
  const startEditingScope = () => {
    setEditScopeValue(optimisticScope ?? primaryOpportunity?.scope_of_work ?? "");
    setIsEditingScope(true);
  };

  // Cancel editing work scope
  const cancelEditingScope = () => {
    setIsEditingScope(false);
    setEditScopeValue("");
  };

  // Save work scope
  const handleSaveScope = async () => {
    if (!primaryOpportunity?.ghl_id) return;
    setIsSavingScope(true);
    try {
      const { error } = await supabase.functions.invoke("update-opportunity-scope", {
        body: {
          opportunityGhlId: primaryOpportunity.ghl_id,
          scopeOfWork: editScopeValue.trim(),
          editedBy: user?.id || null,
          companyId: companyId,
        },
      });
      if (error) throw error;

      setOptimisticScope(editScopeValue.trim());
      setIsEditingScope(false);
      toast.success("Work scope updated");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onRefresh?.();
    } catch (error) {
      console.error("Error updating work scope:", error);
      toast.error("Failed to update work scope");
    } finally {
      setIsSavingScope(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto p-0">
        {/* Header - Contact Details Sticky */}
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <SheetHeader className="space-y-2">
            {/* Contact Details - Editable */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</span>
                </div>
                <div className="flex items-center gap-1">
                  {!isEditingContact ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={startEditingContact}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={cancelEditingContact}
                        disabled={isSavingContact}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleSaveContact}
                        disabled={isSavingContact}
                      >
                        {isSavingContact ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 grid gap-2 text-sm">
                {isEditingContact ? (
                  <>
                    {/* Edit Name */}
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Input
                        value={editContactName}
                        onChange={(e) => setEditContactName(e.target.value)}
                        placeholder="Contact name"
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {/* Edit Address */}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                      <Input
                        value={editContactAddress}
                        onChange={(e) => setEditContactAddress(e.target.value)}
                        placeholder="Address"
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {/* Edit Phone */}
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Input
                        value={editContactPhone}
                        onChange={(e) => setEditContactPhone(e.target.value)}
                        placeholder="Phone number"
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {/* Edit Email */}
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Input
                        type="email"
                        value={editContactEmail}
                        onChange={(e) => setEditContactEmail(e.target.value)}
                        placeholder="Email address"
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Display Name */}
                    <div className="text-base font-semibold text-foreground">
                      {capitalizeContactName(contactName)}
                    </div>
                    {/* Display Address */}
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{displayAddress || <span className="italic text-muted-foreground/60">No address</span>}</span>
                    </div>
                    {/* Display Phone */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {displayPhone ? (
                        <>
                          <a
                            href={`tel:${displayPhone}`}
                            className="text-primary hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatPhoneNumber(displayPhone)}
                          </a>
                          <button
                            className="text-muted-foreground hover:text-primary p-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(contact.phone!);
                              toast.success("Phone copied");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <span className="italic text-muted-foreground/60">No phone</span>
                      )}
                    </div>
                    {/* Display Email */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {(() => {
                        const displayEmail = optimisticContact?.email ?? contact?.email;
                        return displayEmail ? (
                          <>
                            <a
                              href={`mailto:${displayEmail}`}
                              target="_top"
                              rel="noreferrer"
                              className="text-primary hover:underline truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {displayEmail}
                            </a>
                            <button
                              className="text-muted-foreground hover:text-primary p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(displayEmail);
                                toast.success("Email copied");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <a
                              href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(displayEmail)}&body=${encodeURIComponent(`Dear ${(contact?.first_name || '').charAt(0).toUpperCase() + (contact?.first_name || '').slice(1).toLowerCase()} ${(contact?.last_name || '').charAt(0).toUpperCase() + (contact?.last_name || '').slice(1).toLowerCase()},${address ? `\n${address}` : ''}\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              (Gmail)
                            </a>
                          </>
                        ) : (
                          <span className="italic text-muted-foreground/60">No email</span>
                        );
                      })()}
                    </div>
                    {/* Display Source */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {contact?.source ? (
                          <span className="capitalize">{contact.source}</span>
                        ) : (
                          <span className="italic text-muted-foreground/60">No source</span>
                        )}
                      </span>
                    </div>

                  </>
                )}
              </div>
            </div>

          </SheetHeader>
        </div>

        {/* Scrollable Content - Opportunity, Appointment, Estimates */}
        <div className="p-4 space-y-4">
          {/* Opportunity Section */}
          {primaryOpportunity && (
            <div className="border rounded-lg overflow-hidden">
              <div 
                className={`bg-muted px-3 py-2 flex items-center justify-between border-b ${onOpenOpportunity ? "cursor-pointer hover:bg-muted/80 transition-colors" : ""}`}
                onClick={() => onOpenOpportunity?.(primaryOpportunity)}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opportunity</span>
                </div>
                {onOpenOpportunity && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div 
                className={`p-3 ${onOpenOpportunity ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
                onClick={() => onOpenOpportunity?.(primaryOpportunity)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground truncate">{primaryOpportunity.name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">{primaryOpportunity.pipeline_name}</p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">
                    {formatCurrency(primaryOpportunity.monetary_value)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge variant="outline" className="text-xs">
                    {primaryOpportunity.stage_name || "No Stage"}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      primaryOpportunity.status === "won" 
                        ? "bg-primary/20 text-primary border-primary/30"
                        : primaryOpportunity.status === "lost" || primaryOpportunity.status === "abandoned"
                        ? "bg-destructive/20 text-destructive border-destructive/30"
                        : "bg-secondary text-secondary-foreground border-border"
                    }`}
                  >
                    {(primaryOpportunity.status || "open").toUpperCase()}
                  </Badge>
                </div>
                {/* Work Scope - Always show, with inline editing */}
                <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-muted-foreground">Work Scope</p>
                        {!isEditingScope ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingScope();
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditingScope();
                              }}
                              disabled={isSavingScope}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-5 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveScope();
                              }}
                              disabled={isSavingScope}
                            >
                              {isSavingScope ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                      {isEditingScope ? (
                        <Textarea
                          value={editScopeValue}
                          onChange={(e) => setEditScopeValue(e.target.value)}
                          placeholder="Enter work scope..."
                          className="text-sm min-h-[60px]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className={`text-sm whitespace-pre-wrap ${
                          (optimisticScope ?? primaryOpportunity.scope_of_work) 
                            ? "text-foreground" 
                            : "text-muted-foreground/60 italic"
                        }`}>
                          {(optimisticScope ?? primaryOpportunity.scope_of_work) || "Missing - click to add"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appointment Info Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Appointment</span>
              </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAppointmentEditDialog}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this appointment? This will also remove it from GoHighLevel.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAppointment}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDeletingAppointment}
                        >
                          {isDeletingAppointment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <SheetTitle className="text-base font-semibold leading-tight">
                  {appointment.title || "Untitled Appointment"}
                </SheetTitle>
                {/* Date & Time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDateTime(appointment.start_time)}</span>
                  <span>→</span>
                  <span>{formatTime(appointment.end_time)}</span>
                </div>
                {/* Status badges + Sales Rep + Value on same line */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Customer Status - dropdown */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Customer:</span>
                    <Select
                      value={(localStatus || appointment.appointment_status) === 'noshow' ? 'no_show' : (localStatus || appointment.appointment_status || '')}
                      onValueChange={handleUpdateStatusDirect}
                      disabled={isUpdatingStatus}
                    >
                      <SelectTrigger className={`h-6 w-[100px] text-xs ${getStatusColor(localStatus || appointment.appointment_status)}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {APPOINTMENT_STATUSES.filter(s => s !== 'noshow').map((status) => (
                          <SelectItem key={status} value={status} className="text-xs">
                            {status === 'confirmed' ? 'Confirmed' : status === 'no_show' ? 'No Show' : status === 'new' ? 'New' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Sales Rep Confirmation - clickable toggle */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Rep:</span>
                    <button
                      onClick={handleToggleSalespersonConfirmed}
                      disabled={isUpdatingSalespersonConfirmed}
                      className={`h-6 px-2 rounded-md border text-xs inline-flex items-center gap-1 transition-colors ${
                        salespersonConfirmed 
                          ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" 
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      } ${isUpdatingSalespersonConfirmed ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {isUpdatingSalespersonConfirmed ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <PhoneCall className="h-3 w-3" />
                      )}
                      {salespersonConfirmed ? "Confirmed" : "Not Confirmed"}
                    </button>
                  </div>
                  
                  {/* Assigned Sales Rep - inline dropdown */}
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <Select
                      value={effectiveAssignedUserId || "__unassigned__"}
                      onValueChange={handleUpdateAssigneeDirect}
                      disabled={isUpdatingAssignee}
                    >
                      <SelectTrigger className="h-6 w-[120px] text-xs border-dashed">
                        {isUpdatingAssignee ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Assign..." />
                        )}
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="__unassigned__" className="text-xs">
                          Unassigned
                        </SelectItem>
                        {[...users]
                          .sort((a, b) => {
                            const nameA = (a.name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || "Unknown").toLowerCase();
                            const nameB = (b.name || `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email || "Unknown").toLowerCase();
                            return nameA.localeCompare(nameB);
                          })
                          .map((u) => (
                            <SelectItem key={u.ghl_id} value={u.ghl_id} className="text-xs">
                              {u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Unknown"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {primaryOpportunity && (
                    <>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-sm font-bold text-primary">
                        {formatCurrency(primaryOpportunity.monetary_value)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Estimates & Proposals Section */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimates & Proposals</span>
                  <Badge variant="secondary" className="text-xs">
                    {estimates.length}
                  </Badge>
                </div>
                {loadingEstimates && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="p-3">
                {estimates.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No estimates found</p>
                ) : (
                  <div className="space-y-2">
                    {estimates.map((est) => (
                      <div key={est.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            Estimate #{est.estimate_number || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(est.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">
                            {formatCurrency(est.total)}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs capitalize ${
                              est.status === "accepted" 
                                ? "bg-primary/20 text-primary border-primary/30"
                                : est.status === "declined" || est.status === "expired"
                                ? "bg-destructive/20 text-destructive border-destructive/30"
                                : "bg-secondary text-secondary-foreground border-border"
                            }`}
                          >
                            {est.status || "draft"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Scope of Work - Collapsible */}
          {scopeOfWork && (
            <Collapsible open={openSections.scope} onOpenChange={() => toggleSection('scope')}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 flex items-center justify-between border-b hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scope of Work</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.scope ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Appointment Notes - Collapsible */}
          {appointment.notes && (
            <Collapsible open={openSections.apptNotes} onOpenChange={() => toggleSection('apptNotes')}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 flex items-center justify-between border-b hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Appointment Notes
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.apptNotes ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Tasks Section - Collapsible */}
          <Collapsible open={openSections.tasks} onOpenChange={() => toggleSection('tasks')}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 flex items-center justify-between border-b hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</span>
                  <Badge variant="secondary" className="text-xs">
                    {tasks.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {loadingTasks && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openTaskDialog(); }}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.tasks ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y max-h-48 overflow-y-auto">
                  {tasks.length === 0 && !loadingTasks ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No tasks</div>
                  ) : (
                    tasks.map((task) => (
                      <div key={task.id} className="p-3 flex items-start gap-2">
                        <button
                          onClick={() => handleToggleTask(task)}
                          className={`mt-0.5 h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            task.completed || task.status === "completed"
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-muted-foreground/40 hover:border-primary"
                          }`}
                        >
                          {(task.completed || task.status === "completed") && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${task.completed || task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
                          >
                            {task.title}
                          </div>
                          {task.due_date && (
                            <div className="text-xs text-muted-foreground">Due: {formatDateShort(task.due_date)}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          GHL
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Contact Notes Section - Collapsible */}
          <Collapsible open={openSections.notes} onOpenChange={() => toggleSection('notes')}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 flex items-center justify-between border-b hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Activity Notes
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {contactNotes.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {loadingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setShowAddNote(!showAddNote); }}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); fetchContactNotes(); }}
                    disabled={loadingNotes}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingNotes ? "animate-spin" : ""}`} />
                  </Button>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.notes ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Add Note Form */}
                {showAddNote && (
                  <div className="p-3 border-b bg-muted/20">
                    <Textarea
                      placeholder="Add a note..."
                      value={newNoteBody}
                      onChange={(e) => setNewNoteBody(e.target.value)}
                      className="min-h-[60px] text-sm mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddNote(false);
                          setNewNoteBody("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleAddNote} disabled={isAddingNote || !newNoteBody.trim()}>
                        {isAddingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}

                <div className="divide-y max-h-48 overflow-y-auto">
                  {contactNotes.length === 0 && !loadingNotes ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No notes</div>
                  ) : (
                    contactNotes.map((note) => {
                      // Prefer entered_by (app user) over user_id (GHL user)
                      let noteUserName = note.creator?.full_name || null;
                      if (!noteUserName && note.user_id) {
                        const noteUser = users.find((u) => u.ghl_id === note.user_id);
                        noteUserName = noteUser?.name || 
                          (noteUser?.first_name && noteUser?.last_name
                            ? `${noteUser.first_name} ${noteUser.last_name}`
                            : null);
                      }
                      return (
                        <div key={note.id} className="p-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{noteUserName || "GHL User"}</span>
                            <span>{note.ghl_date_added ? formatDateShort(note.ghl_date_added) : "Unknown date"}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{stripHtml(note.body || "No content")}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Conversations Section - Collapsible */}
          <Collapsible open={openSections.conversations} onOpenChange={() => toggleSection('conversations')}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 flex items-center justify-between border-b hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversations</span>
                  <Badge variant="secondary" className="text-xs">
                    {allMessages.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {loadingConversations && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); fetchConversations(); }}
                    disabled={loadingConversations}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingConversations ? "animate-spin" : ""}`} />
                  </Button>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.conversations ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {allMessages.length === 0 && !loadingConversations ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No messages</div>
                  ) : (
                    allMessages.slice(-20).map((msg) => (
                      <div key={msg.id} className={`p-3 ${msg.direction === "outbound" ? "bg-primary/5" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {msg.direction === "outbound" ? (
                            <ArrowUpRight className="h-3 w-3 text-primary" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3 text-secondary-foreground" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {msg.type || "Message"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDateShort(msg.dateAdded)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.body || "(No content)"}</p>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Related Opportunities */}
          {relatedOpportunities.length > 1 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Other Opportunities ({relatedOpportunities.length - 1})
                </span>
              </div>
              <div className="divide-y">
                {relatedOpportunities.slice(1, 4).map((opp) => (
                  <div
                    key={opp.ghl_id}
                    className={`p-3 flex items-center justify-between gap-2 ${onOpenOpportunity ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
                    onClick={() => handleOpenOpportunity(opp)}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{opp.name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{opp.stage_name || "Unknown Stage"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary shrink-0">
                        {formatCurrency(opp.monetary_value)}
                      </span>
                      {onOpenOpportunity && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>

      {/* Task Creation Dialog */}
      <Dialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) {
            setTaskTitle("");
            setTaskNotes("");
            setTaskAssignee("");
            setTaskDueDate("");
            setTaskDueTime("09:00");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apptTaskTitle">Task Title</Label>
              <Input
                id="apptTaskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apptTaskNotes">Notes</Label>
              <Textarea
                id="apptTaskNotes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Add notes for this task..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apptTaskAssignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {[...users]
                    .sort((a, b) => {
                      const nameA = (
                        a.name ||
                        `${a.first_name || ""} ${a.last_name || ""}`.trim() ||
                        a.email ||
                        "Unknown"
                      ).toLowerCase();
                      const nameB = (
                        b.name ||
                        `${b.first_name || ""} ${b.last_name || ""}`.trim() ||
                        b.email ||
                        "Unknown"
                      ).toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map((user) => (
                      <SelectItem key={user.ghl_id} value={user.ghl_id}>
                        {user.name ||
                          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                          user.email ||
                          "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date & Time (PST) - Optional</Label>
              <div className="flex gap-2">
                <Input
                  id="apptTaskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  id="apptTaskDueTime"
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
            <Button onClick={handleCreateTask} disabled={isCreatingTask || !taskTitle.trim()}>
              {isCreatingTask ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Edit Dialog - using shared component */}
      <AppointmentEditDialog
        appointment={appointment}
        open={appointmentEditDialogOpen}
        onOpenChange={setAppointmentEditDialogOpen}
        users={users}
        calendars={calendars}
        contactId={appointment?.contact_id}
        locationId={appointment?.location_id}
        showCalendarSelect
        showRescheduleCheckbox
        onSuccess={() => {
          fetchContactNotes();
          onRefresh?.();
        }}
        onDelete={() => {
          onOpenChange(false);
        }}
      />
    </Sheet>
  );
}
