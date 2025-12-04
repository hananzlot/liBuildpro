import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DollarSign, User, Target, Calendar, Clock, FileText, MapPin, Phone, Mail, Briefcase, Megaphone, Pencil, Save, X, Loader2, MessageSquare, RefreshCw, Send, CheckSquare, Plus, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Helper to get PST/PDT offset in hours
const getPSTOffset = (date: Date): number => {
  const year = date.getFullYear();
  const dstStart = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()), 2);
  const dstEnd = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()), 2);
  const isDST = date >= dstStart && date < dstEnd;
  return isDST ? 7 : 8;
};

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i'
};

// Strip HTML tags from text
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};
interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
}
interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
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
  location_id?: string;
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
  attachments?: any[];
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
  messages?: Message[];
}
interface ContactNote {
  id: string;
  body: string;
  userId: string | null;
  dateAdded: string;
}
interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  ghl_id: string | null;
}
interface OpportunityDetailSheetProps {
  opportunity: Opportunity | null;
  appointments: Appointment[];
  contacts: Contact[];
  users: GHLUser[];
  conversations?: Conversation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allOpportunities?: Opportunity[];
}
const OPPORTUNITY_STATUSES = ["open", "won", "lost", "abandoned"];
const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
};
export function OpportunityDetailSheet({
  opportunity,
  appointments,
  contacts,
  users,
  conversations = [],
  open,
  onOpenChange,
  allOpportunities = []
}: OpportunityDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedStatus, setEditedStatus] = useState<string>("");
  const [editedStage, setEditedStage] = useState<string>("");
  const [editedMonetaryValue, setEditedMonetaryValue] = useState<string>("");
  const [editedAssignedTo, setEditedAssignedTo] = useState<string>("");

  // Real-time conversation fetching
  const [liveConversations, setLiveConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Contact notes
  const [contactNotesList, setContactNotesList] = useState<ContactNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("09:00");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null);
  const [isUpdatingTaskStatus, setIsUpdatingTaskStatus] = useState<string | null>(null);

  // Fetch conversations and notes from GHL when sheet opens
  useEffect(() => {
    if (open && opportunity?.contact_id) {
      // Fetch conversations
      const fetchConversations = async () => {
        setIsLoadingConversations(true);
        try {
          const {
            data,
            error
          } = await supabase.functions.invoke('fetch-contact-conversations', {
            body: {
              contact_id: opportunity.contact_id
            }
          });
          if (error) {
            console.error('Error fetching conversations:', error);
          } else if (data?.conversations) {
            setLiveConversations(data.conversations);
          }
        } catch (err) {
          console.error('Failed to fetch conversations:', err);
        } finally {
          setIsLoadingConversations(false);
        }
      };

      // Fetch contact notes
      const fetchNotes = async () => {
        setIsLoadingNotes(true);
        try {
          const {
            data,
            error
          } = await supabase.functions.invoke('fetch-contact-notes', {
            body: {
              contact_id: opportunity.contact_id
            }
          });
          if (error) {
            console.error('Error fetching notes:', error);
          } else if (data?.notes) {
            setContactNotesList(data.notes);
          }
        } catch (err) {
          console.error('Failed to fetch notes:', err);
        } finally {
          setIsLoadingNotes(false);
        }
      };
      // Fetch tasks from Supabase
      const fetchTasks = async () => {
        setIsLoadingTasks(true);
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('opportunity_id', opportunity.ghl_id)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Error fetching tasks:', error);
          } else if (data) {
            setTasks(data);
          }
        } catch (err) {
          console.error('Failed to fetch tasks:', err);
        } finally {
          setIsLoadingTasks(false);
        }
      };

      fetchConversations();
      fetchNotes();
      fetchTasks();
    } else {
      setLiveConversations([]);
      setContactNotesList([]);
      setTasks([]);
    }
  }, [open, opportunity?.contact_id, opportunity?.ghl_id]);
  const handleRefreshConversations = async () => {
    if (!opportunity?.contact_id) return;
    setIsLoadingConversations(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('fetch-contact-conversations', {
        body: {
          contact_id: opportunity.contact_id
        }
      });
      if (error) {
        toast.error('Failed to refresh conversations');
      } else if (data?.conversations) {
        setLiveConversations(data.conversations);
        toast.success(`Found ${data.conversations.length} conversations`);
      }
    } catch (err) {
      toast.error('Failed to refresh conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  };
  const handleCreateNote = async () => {
    if (!opportunity?.contact_id || !newNoteText.trim()) return;
    setIsCreatingNote(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-contact-note', {
        body: {
          contactId: opportunity.contact_id,
          body: newNoteText.trim()
        }
      });
      if (error) {
        toast.error('Failed to create note');
        console.error('Error creating note:', error);
      } else if (data?.success) {
        toast.success('Note created');
        setNewNoteText('');

        // Refresh notes list
        const {
          data: refreshData
        } = await supabase.functions.invoke('fetch-contact-notes', {
          body: {
            contact_id: opportunity.contact_id
          }
        });
        if (refreshData?.notes) {
          setContactNotesList(refreshData.notes);
        }
      }
    } catch (err) {
      toast.error('Failed to create note');
      console.error('Failed to create note:', err);
    } finally {
      setIsCreatingNote(false);
    }
  };

  const openTaskDialog = () => {
    const contact = contacts.find(c => c.ghl_id === opportunity?.contact_id);
    const contactName = contact?.contact_name || 
      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "";
    setTaskTitle(`Follow up: ${opportunity?.name || contactName || "Opportunity"}`);
    setTaskNotes("");
    setTaskAssignee(opportunity?.assigned_to || "__unassigned__");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!opportunity || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsCreatingTask(true);
    try {
      const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
      const locationId = contact?.location_id || "pVeFrqvtYWNIPRIi0Fmr";

      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;
      
      // Combine date and time, treating input as PST
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        const pstDateTimeStr = `${taskDueDate}T${timeStr}:00`;
        const localDate = new Date(pstDateTimeStr);
        const pstOffset = getPSTOffset(localDate);
        const utcDate = new Date(localDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      // Insert into Supabase
      const { data: insertedTask, error } = await supabase.from("tasks").insert({
        opportunity_id: opportunity.ghl_id,
        contact_id: opportunity.contact_id,
        title: taskTitle.trim(),
        notes: taskNotes.trim() || null,
        assigned_to: assignedToValue,
        due_date: dueDateValue,
        location_id: locationId,
        status: "pending"
      }).select().single();

      if (error) throw error;

      // Sync to GHL
      try {
        const ghlResponse = await supabase.functions.invoke('create-ghl-task', {
          body: {
            title: taskTitle.trim(),
            body: taskNotes.trim() || null,
            dueDate: dueDateValue,
            assignedTo: assignedToValue,
            contactId: opportunity.contact_id,
            supabaseTaskId: insertedTask?.id
          }
        });

        if (ghlResponse.error) {
          console.error('GHL sync error:', ghlResponse.error);
          toast.success("Task created locally (GHL sync failed)");
        } else {
          toast.success("Task created and synced to GHL");
        }
      } catch (ghlError) {
        console.error('GHL sync error:', ghlError);
        toast.success("Task created locally (GHL sync failed)");
      }

      // Refresh tasks list
      const { data: refreshedTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('opportunity_id', opportunity.ghl_id)
        .order('created_at', { ascending: false });
      
      if (refreshedTasks) {
        setTasks(refreshedTasks);
      }

      setTaskDialogOpen(false);
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

  const openEditTaskDialog = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskNotes(task.notes || "");
    setTaskAssignee(task.assigned_to || "__unassigned__");
    if (task.due_date) {
      // Convert UTC to PST for display
      const utcDate = new Date(task.due_date);
      const pstOffset = getPSTOffset(utcDate);
      const pstDate = new Date(utcDate.getTime() - pstOffset * 60 * 60 * 1000);
      setTaskDueDate(pstDate.toISOString().split('T')[0]);
      setTaskDueTime(pstDate.toISOString().split('T')[1].substring(0, 5));
    } else {
      setTaskDueDate("");
      setTaskDueTime("09:00");
    }
    setTaskDialogOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsCreatingTask(true);
    try {
      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;
      
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        // Treat input as PST: parse as UTC then add PST offset to get actual UTC
        const pstOffset = getPSTOffset(new Date(`${taskDueDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${taskDueDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          title: taskTitle.trim(),
          notes: taskNotes.trim() || null,
          assigned_to: assignedToValue,
          due_date: dueDateValue,
        })
        .eq("id", editingTask.id);

      if (error) throw error;

      // Sync to GHL if we have the GHL task ID
      if (editingTask.ghl_id && opportunity?.contact_id) {
        try {
          const ghlResponse = await supabase.functions.invoke('update-ghl-task', {
            body: {
              contactId: opportunity.contact_id,
              taskId: editingTask.ghl_id,
              title: taskTitle.trim(),
              body: taskNotes.trim() || null,
              dueDate: dueDateValue,
              assignedTo: assignedToValue
            }
          });
          
          if (ghlResponse.error) {
            console.error('GHL update error:', ghlResponse.error);
            toast.success("Task updated locally (GHL sync failed)");
          } else {
            toast.success("Task updated");
          }
        } catch (ghlErr) {
          console.error('Failed to update in GHL:', ghlErr);
          toast.success("Task updated locally (GHL sync failed)");
        }
      } else {
        toast.success("Task updated");
      }

      // Refresh tasks list
      const { data: refreshedTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('opportunity_id', opportunity?.ghl_id)
        .order('created_at', { ascending: false });
      
      if (refreshedTasks) setTasks(refreshedTasks);

      setTaskDialogOpen(false);
      setEditingTask(null);
      setTaskTitle("");
      setTaskNotes("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskDueTime("");
    } catch (err) {
      console.error("Error updating task:", err);
      toast.error("Failed to update task");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsDeletingTask(taskId);
    try {
      // Find the task to get its GHL ID and contact ID
      const taskToDelete = tasks.find(t => t.id === taskId);
      
      // Delete from Supabase first
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      
      // Delete from GHL if we have the GHL task ID
      if (taskToDelete?.ghl_id && opportunity?.contact_id) {
        try {
          const ghlResponse = await supabase.functions.invoke('delete-ghl-task', {
            body: {
              contactId: opportunity.contact_id,
              taskId: taskToDelete.ghl_id
            }
          });
          
          if (ghlResponse.error) {
            console.error('GHL delete error:', ghlResponse.error);
            // Don't fail the whole operation, task is already deleted from Supabase
          }
        } catch (ghlErr) {
          console.error('Failed to delete from GHL:', ghlErr);
        }
      }
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success("Task deleted");
    } catch (err) {
      console.error("Error deleting task:", err);
      toast.error("Failed to delete task");
    } finally {
      setIsDeletingTask(null);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    setIsUpdatingTaskStatus(task.id);
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const isCompleted = newStatus === 'completed';
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id);
      
      if (error) throw error;
      
      // Sync completion status to GHL
      if (task.ghl_id && opportunity?.contact_id) {
        try {
          await supabase.functions.invoke('update-ghl-task', {
            body: {
              contactId: opportunity.contact_id,
              taskId: task.ghl_id,
              completed: isCompleted
            }
          });
        } catch (ghlErr) {
          console.error('Failed to sync status to GHL:', ghlErr);
        }
      }
      
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      toast.success(newStatus === 'completed' ? "Task completed" : "Task reopened");
    } catch (err) {
      console.error("Error updating task status:", err);
      toast.error("Failed to update task status");
    } finally {
      setIsUpdatingTaskStatus(null);
    }
  };

  const stageMap = new Map<string, string>();
  const currentPipelineId = opportunity?.pipeline_id;
  allOpportunities.forEach(o => {
    // Only include stages from the same pipeline
    if (o.stage_name && o.pipeline_stage_id && o.pipeline_id === currentPipelineId) {
      stageMap.set(o.stage_name, o.pipeline_stage_id);
    }
  });
  const availableStages = Array.from(stageMap.keys()).sort();
  const handleEditClick = () => {
    setEditedStatus(opportunity?.status?.toLowerCase() || "open");
    setEditedStage(opportunity?.stage_name || "");
    setEditedMonetaryValue(opportunity?.monetary_value?.toString() || "0");
    setEditedAssignedTo(opportunity?.assigned_to || "__unassigned__");
    setIsEditing(true);
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedStatus("");
    setEditedStage("");
    setEditedMonetaryValue("");
    setEditedAssignedTo("");
  };
  const handleSave = async () => {
    if (!opportunity) return;
    setIsSaving(true);
    try {
      // Get the pipeline_stage_id for the selected stage
      const pipeline_stage_id = stageMap.get(editedStage) || opportunity.pipeline_stage_id;
      const monetaryValue = parseFloat(editedMonetaryValue) || 0;

      // Call edge function to update GHL first, then Supabase
      const {
        data,
        error
      } = await supabase.functions.invoke('update-ghl-opportunity', {
        body: {
          ghl_id: opportunity.ghl_id,
          status: editedStatus,
          stage_name: editedStage,
          pipeline_stage_id: pipeline_stage_id,
          monetary_value: monetaryValue,
          assigned_to: editedAssignedTo === "__unassigned__" ? null : editedAssignedTo
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Opportunity updated in GHL and database");
      setIsEditing(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
    } catch (error) {
      console.error("Error updating opportunity:", error);
      toast.error("Failed to update opportunity in GHL");
    } finally {
      setIsSaving(false);
    }
  };
  if (!opportunity) return null;
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };
  const getAppointmentStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
      case 'no_show':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'showed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };
  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };
  const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
  const relatedAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id);
  const assignedUser = users.find(u => u.ghl_id === opportunity.assigned_to);
  const contactName = contact?.contact_name || (contact?.first_name && contact?.last_name ? `${contact.first_name} ${contact.last_name}` : contact?.first_name || contact?.last_name || 'Unknown');
  const userName = assignedUser?.name || (assignedUser?.first_name && assignedUser?.last_name ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned');
  const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const contactNotes = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.NOTES);
  return <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-sm font-medium text-muted-foreground">
                Opportunity Details
              </SheetTitle>
              {!isEditing ? <div className="flex items-center gap-2">
                  
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditClick}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div> : <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} disabled={isSaving}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="icon" className="h-7 w-7" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>}
            </div>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Contact Section - Now at the top with opportunity value */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
              <div className="flex flex-col">
                <span className="font-bold capitalize">{opportunity.name?.toLowerCase() || 'Unnamed Opportunity'}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {userName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openTaskDialog}>
                  <Plus className="h-3 w-3 mr-1" />
                  Task
                </Button>
                {isEditing ? <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-emerald-400">$</span>
                    <Input type="number" value={editedMonetaryValue} onChange={e => setEditedMonetaryValue(e.target.value)} className="text-lg font-bold h-8 w-28" min="0" step="100" />
                  </div> : <div className="text-lg font-bold text-emerald-400">
                    {formatCurrency(opportunity.monetary_value)}
                  </div>}
              </div>
            </div>
            <div className="p-3 space-y-2">
              
              <div className="grid gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact?.phone || <span className="italic text-muted-foreground/60">No phone</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact?.email || <span className="italic text-muted-foreground/60">No email</span>}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{address || <span className="italic text-muted-foreground/60">No address</span>}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Pipeline</div>
              <div className="font-medium truncate">{opportunity.pipeline_name || '-'}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Stage</div>
              {isEditing ? <Select value={editedStage} onValueChange={setEditedStage}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStages.map(stage => <SelectItem key={stage} value={stage} className="text-xs">
                        {stage}
                      </SelectItem>)}
                  </SelectContent>
                </Select> : <div className="font-medium truncate">{opportunity.stage_name || '-'}</div>}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Status</div>
              {isEditing ? <Select value={editedStatus} onValueChange={setEditedStatus}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_STATUSES.map(status => <SelectItem key={status} value={status} className="text-xs capitalize">
                        {status}
                      </SelectItem>)}
                  </SelectContent>
                </Select> : <Badge variant="outline" className={`text-xs ${getStatusColor(opportunity.status)}`}>
                  {opportunity.status || 'Unknown'}
                </Badge>}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Created</div>
              <div className="font-medium truncate">{formatDate(opportunity.ghl_date_added)}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              {isEditing ? <Select value={editedAssignedTo} onValueChange={setEditedAssignedTo}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__" className="text-xs">Unassigned</SelectItem>
                    {users.map(user => {
                  const name = user.name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || user.email || 'Unknown');
                  return <SelectItem key={user.ghl_id} value={user.ghl_id} className="text-xs">
                          {name}
                        </SelectItem>;
                })}
                  </SelectContent>
                </Select> : <div className="font-medium truncate">{userName}</div>}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
                <Megaphone className="h-3 w-3" />
                Source
              </div>
              <div className="font-medium truncate">{contact?.source || 'No source'}</div>
            </div>
          </div>

          {/* Scope of Work */}
          {scopeOfWork && <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scope of Work</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
              </div>
            </div>}

          {/* Notes/Comments */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes & Comments {contactNotesList.length > 0 && `(${contactNotesList.length})`}
                </span>
              </div>
              {isLoadingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
              {/* Timeline Notes from GHL */}
              {contactNotesList.length > 0 && <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">Activity Notes</div>
                  {contactNotesList.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).map(note => {
                const noteUser = users.find(u => u.ghl_id === note.userId);
                const noteUserName = noteUser?.name || (noteUser?.first_name && noteUser?.last_name ? `${noteUser.first_name} ${noteUser.last_name}` : 'Unknown');
                return <div key={note.id} className="bg-muted/30 rounded p-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{noteUserName}</span>
                            <span>{new Date(note.dateAdded).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{stripHtml(note.body)}</p>
                        </div>;
              })}
                </div>}

              {/* Contact Custom Field Notes */}
              {contactNotes && <div className={contactNotesList.length > 0 ? "border-t pt-3" : ""}>
                  <div className="text-xs text-muted-foreground mb-1">Custom Field Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
                </div>}
              
              {/* Appointment Notes */}
              {relatedAppointments.filter(a => a.notes).length > 0 && <div className={contactNotes || contactNotesList.length > 0 ? "border-t pt-3" : ""}>
                  <div className="text-xs text-muted-foreground mb-2">Appointment Notes</div>
                  <div className="space-y-2">
                    {relatedAppointments.filter(a => a.notes).map(appt => <div key={appt.ghl_id} className="bg-muted/30 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-1">{appt.title || 'Appointment'}</div>
                        <p className="text-sm whitespace-pre-wrap">{appt.notes}</p>
                      </div>)}
                  </div>
                </div>}
              
              {!contactNotes && contactNotesList.length === 0 && relatedAppointments.filter(a => a.notes).length === 0 && <p className="text-sm text-muted-foreground/60 italic">
                  {isLoadingNotes ? 'Loading notes...' : 'No notes or comments yet'}
                </p>}
            </div>
            
            {/* Add New Note Form */}
            <div className="border-t p-3">
              <Textarea placeholder="Add a note..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} className="min-h-[60px] text-sm resize-none mb-2" disabled={isCreatingNote} />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateNote} disabled={isCreatingNote || !newNoteText.trim()}>
                  {isCreatingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Add Note
                </Button>
              </div>
            </div>
          </div>

          {/* Conversations - fetched live from GHL */}
          {(() => {
          const formatConvDate = (dateStr: string | null | number) => {
            if (!dateStr) return '';
            const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
            return date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
          };
          const getTypeIcon = (type: string | null) => {
            switch (type?.toLowerCase()) {
              case 'type_sms':
              case 'sms':
                return '💬';
              case 'type_email':
              case 'email':
                return '📧';
              case 'type_call':
              case 'call':
                return '📞';
              case 'type_facebook':
              case 'facebook':
                return '📘';
              case 'type_instagram':
              case 'instagram':
                return '📸';
              default:
                return '💬';
            }
          };

          // Flatten all messages from all conversations and sort by date
          const allMessages = liveConversations.flatMap(conv => (conv.messages || []).map(msg => ({
            ...msg,
            conversationType: conv.type
          }))).sort((a, b) => {
            const dateA = new Date(a.dateAdded).getTime();
            const dateB = new Date(b.dateAdded).getTime();
            return dateB - dateA; // Most recent first
          });
          return <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Conversation History {allMessages.length > 0 && `(${allMessages.length} messages)`}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleRefreshConversations} disabled={isLoadingConversations}>
                    <RefreshCw className={`h-3 w-3 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                
                {isLoadingConversations ? <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading conversation history...</span>
                  </div> : allMessages.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                    No conversation history found
                  </div> : <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                    {allMessages.slice(0, 50).map(msg => <div key={msg.id} className={`flex flex-col ${msg.direction === 'inbound' ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.direction === 'inbound' ? 'bg-muted/60 text-foreground' : 'bg-primary/20 text-foreground'}`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body || '(No content)'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <span>{getTypeIcon(msg.type)}</span>
                          <span>{msg.direction === 'inbound' ? 'Received' : 'Sent'}</span>
                          <span>•</span>
                          <span>{formatConvDate(msg.dateAdded)}</span>
                        </div>
                      </div>)}
                    {allMessages.length > 50 && <div className="text-center text-xs text-muted-foreground py-2">
                        Showing 50 of {allMessages.length} messages
                      </div>}
                  </div>}
              </div>;
        })()}

          {/* Related Appointments - Always show */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Appointment History ({relatedAppointments.length})
              </span>
            </div>
            {relatedAppointments.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                No appointments found
              </div> : <div className="divide-y max-h-60 overflow-y-auto">
                {relatedAppointments.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime()).map(appt => <div key={appt.ghl_id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{appt.title || 'Untitled'}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${getAppointmentStatusColor(appt.appointment_status)}`}>
                        {appt.appointment_status || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(appt.start_time)}
                    </div>
                    {appt.notes && <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded whitespace-pre-wrap">
                        {appt.notes}
                      </div>}
                  </div>)}
              </div>}
          </div>

          {/* Tasks History */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tasks ({tasks.length})
              </span>
              {isLoadingTasks && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {tasks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                {isLoadingTasks ? 'Loading tasks...' : 'No tasks created yet'}
              </div>
            ) : (
              <div className="divide-y max-h-60 overflow-y-auto">
                {tasks.map(task => {
                  const taskUser = users.find(u => u.ghl_id === task.assigned_to);
                  const taskUserName = taskUser?.name || (taskUser?.first_name && taskUser?.last_name 
                    ? `${taskUser.first_name} ${taskUser.last_name}` 
                    : 'Unassigned');
                  return (
                    <div key={task.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleToggleTaskStatus(task)}
                            disabled={isUpdatingTaskStatus === task.id}
                          >
                            {isUpdatingTaskStatus === task.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : task.status === 'completed' ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <div className="h-3 w-3 rounded-sm border border-muted-foreground" />
                            )}
                          </Button>
                          <span className={`font-medium text-sm truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEditTaskDialog(task)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={isDeletingTask === task.id}
                          >
                            {isDeletingTask === task.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-7">
                        <span>{taskUserName}</span>
                        {task.due_date && (
                          <>
                            <span>•</span>
                            <span>Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}</span>
                          </>
                        )}
                      </div>
                      {task.notes && (
                        <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/30 rounded whitespace-pre-wrap ml-7">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Updated: {formatDate(opportunity.ghl_date_updated)}</span>
          </div>
        </div>
      </SheetContent>

      {/* Create/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => {
        setTaskDialogOpen(open);
        if (!open) {
          setEditingTask(null);
          setTaskTitle("");
          setTaskNotes("");
          setTaskAssignee("");
          setTaskDueDate("");
          setTaskDueTime("09:00");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {editingTask ? 'Edit Task' : 'Create Task'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oppTaskTitle">Task Title</Label>
              <Input
                id="oppTaskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppTaskNotes">Notes</Label>
              <Textarea
                id="oppTaskNotes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Add notes for this task..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppTaskAssignee">Assign To</Label>
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
                  id="oppTaskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  id="oppTaskDueTime"
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
            <Button 
              onClick={editingTask ? handleUpdateTask : handleCreateTask} 
              disabled={isCreatingTask}
            >
              {isCreatingTask 
                ? (editingTask ? "Saving..." : "Creating...") 
                : (editingTask ? "Save Changes" : "Create Task")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>;
}