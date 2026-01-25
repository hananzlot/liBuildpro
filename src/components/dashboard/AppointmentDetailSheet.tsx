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
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Trash2,
  PhoneCall,
  Copy,
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

  const queryClient = useQueryClient();

  const contact = appointment ? findContactByIdOrGhlId(contacts, appointment.contact_uuid, appointment.contact_id) : null;
  const relatedOpportunities = appointment ? opportunities.filter((o) => o.contact_id === appointment.contact_id) : [];
  const primaryOpportunity = relatedOpportunities[0];

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

  // Sync salesperson confirmed state and local status with appointment prop
  useEffect(() => {
    if (appointment) {
      setSalespersonConfirmed(appointment.salesperson_confirmed || false);
      setLocalStatus(appointment.appointment_status || null);
    }
  }, [appointment]);

  // Toggle salesperson confirmed
  const handleToggleSalespersonConfirmed = async () => {
    if (!appointment?.ghl_id) return;
    setIsUpdatingSalespersonConfirmed(true);
    const oldValue = salespersonConfirmed;
    try {
      const newValue = !salespersonConfirmed;
      const { error } = await supabase
        .from("appointments")
        .update({
          salesperson_confirmed: newValue,
          salesperson_confirmed_at: newValue ? new Date().toISOString() : null,
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        })
        .eq("ghl_id", appointment.ghl_id);

      if (error) throw error;

      // Record edit in appointment_edits table
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appointment.ghl_id,
        contact_ghl_id: appointment.contact_id,
        field_name: "salesperson_confirmed",
        old_value: String(oldValue),
        new_value: String(newValue),
        edited_by: user?.id || null,
        location_id: appointment.location_id,
        company_id: companyId,
      });

      setSalespersonConfirmed(newValue);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
      // Update in GHL
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

  // Open task dialog
  const contactName =
    contact?.contact_name ||
    (contact?.first_name && contact?.last_name
      ? `${contact.first_name} ${contact.last_name}`
      : contact?.first_name || contact?.last_name || "Unknown");

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

      // Create in GHL first
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
        console.error("GHL sync error:", ghlResponse.error);
        toast.error("Failed to create task in GHL");
        return;
      }

      toast.success("Task created and synced to GHL");

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

  const assignedUser = users.find((u) => u.ghl_id === appointment.assigned_user_id);

  const userName =
    assignedUser?.name ||
    (assignedUser?.first_name && assignedUser?.last_name
      ? `${assignedUser.first_name} ${assignedUser.last_name}`
      : "Unassigned");

  // Get address: first try contact custom_fields, then current appointment, then any other appointment for this contact
  const contactAddress = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
  const currentAppointmentAddress = appointment?.address;
  const otherAppointmentAddress = appointment?.contact_id 
    ? appointments.find(a => a.contact_id === appointment.contact_id && a.address)?.address 
    : null;
  const address = contactAddress || currentAppointmentAddress || otherAppointmentAddress || null;
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

  // Helper to properly capitalize contact name
  const capitalizeContactName = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto p-0">
        {/* Header - Contact Details First */}
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <SheetHeader className="space-y-2">
            {/* Contact Details - Clickable to open opportunity */}
            <div 
              className={`border rounded-lg overflow-hidden ${primaryOpportunity && onOpenOpportunity ? "cursor-pointer hover:bg-muted/20 transition-colors" : ""}`}
              onClick={() => primaryOpportunity && handleOpenOpportunity(primaryOpportunity)}
            >
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Details</span>
                </div>
                {primaryOpportunity && onOpenOpportunity && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>View Opportunity</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div className="p-3 grid gap-1.5 text-sm">
                <div className="font-medium text-foreground">
                  {capitalizeContactName(contactName)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {contact?.phone ? (
                    <>
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-primary hover:underline truncate"
                      >
                        {contact.phone}
                      </a>
                      <button
                        className="text-muted-foreground hover:text-primary p-0.5"
                        onClick={() => {
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
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {contact?.email ? (
                    <>
                      <a
                        href={`mailto:${contact.email}`}
                        target="_top"
                        rel="noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {contact.email}
                      </a>
                      <button
                        className="text-muted-foreground hover:text-primary p-0.5"
                        onClick={() => {
                          navigator.clipboard.writeText(contact.email!);
                          toast.success("Email copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}&body=${encodeURIComponent(`Dear ${(contact.first_name || '').charAt(0).toUpperCase() + (contact.first_name || '').slice(1).toLowerCase()} ${(contact.last_name || '').charAt(0).toUpperCase() + (contact.last_name || '').slice(1).toLowerCase()},${address ? `\n${address}` : ''}\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary text-xs"
                      >
                        (Gmail)
                      </a>
                    </>
                  ) : (
                    <span className="italic text-muted-foreground/60">No email</span>
                  )}
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{address || <span className="italic text-muted-foreground/60">No address</span>}</span>
                </div>
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
              </div>
            </div>

            {/* Appointment Info Section */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appointment</span>
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
                  <Badge
                    variant="outline"
                    className={`text-xs h-6 px-2 inline-flex items-center gap-1 ${salespersonConfirmed ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}
                  >
                    <PhoneCall className="h-3 w-3" />
                    {salespersonConfirmed ? "Rep Confirmed" : "Not Confirmed"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-xs font-medium">{userName}</span>
                  {primaryOpportunity && (
                    <>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {formatCurrency(primaryOpportunity.monetary_value)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Primary Opportunity Section */}
          {primaryOpportunity && (
            <div 
              className={`border rounded-lg overflow-hidden ${onOpenOpportunity ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
              onClick={() => onOpenOpportunity?.(primaryOpportunity)}
            >
              <div className="bg-emerald-500/10 px-3 py-2 flex items-center justify-between border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Opportunity</span>
                </div>
                {onOpenOpportunity && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{primaryOpportunity.name || "Untitled Opportunity"}</p>
                    <p className="text-xs text-muted-foreground">{primaryOpportunity.pipeline_name}</p>
                  </div>
                  <span className="text-lg font-bold text-emerald-500 shrink-0">
                    {formatCurrency(primaryOpportunity.monetary_value)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {primaryOpportunity.stage_name || "No Stage"}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      primaryOpportunity.status === "won" 
                        ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                        : primaryOpportunity.status === "lost" || primaryOpportunity.status === "abandoned"
                        ? "bg-red-500/20 text-red-500 border-red-500/30"
                        : "bg-blue-500/20 text-blue-500 border-blue-500/30"
                    }`}
                  >
                    {(primaryOpportunity.status || "open").toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Scope of Work */}
          {scopeOfWork && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scope of Work</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
              </div>
            </div>
          )}

          {/* Appointment Notes */}
          {appointment.notes && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Appointment Notes
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Tasks Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</span>
                <Badge variant="secondary" className="text-xs">
                  {tasks.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {loadingTasks && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openTaskDialog}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
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
          </div>

          {/* Contact Notes Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
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
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddNote(!showAddNote)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={fetchContactNotes}
                  disabled={loadingNotes}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingNotes ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

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
          </div>

          {/* Conversations Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
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
                  onClick={fetchConversations}
                  disabled={loadingConversations}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingConversations ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
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
                        <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
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
          </div>

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
                      <span className="text-sm font-semibold text-emerald-400 shrink-0">
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
