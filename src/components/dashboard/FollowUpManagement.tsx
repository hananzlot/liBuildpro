import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp, ArrowUpDown, Calendar, User, Clock, Plus, FileText, Loader2, RefreshCw, ExternalLink, CheckSquare, TrendingUp, Snowflake } from "lucide-react";
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
interface DBOpportunity {
  id: string;
  ghl_id: string;
  contact_id: string | null;
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
  opportunity_id: string;
  contact_id: string | null;
  title: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
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
type DueDateFilter = 'all' | 'past_due' | 'today_tomorrow' | 'after_tomorrow';

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
type SortField = 'appointment_date' | 'last_note_date' | 'contact_name' | 'opportunity_name';
type SortDirection = 'asc' | 'desc';
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
  const [staleNotesOpen, setStaleNotesOpen] = useState(false);
  const [noTasksOpen, setNoTasksOpen] = useState(false);
  const [pastConfirmedOpen, setPastConfirmedOpen] = useState(false);
  const [tasksHelperOpen, setTasksHelperOpen] = useState(false);
  const [closeToSaleOpen, setCloseToSaleOpen] = useState(false);
  const [closeToSaleRepFilter, setCloseToSaleRepFilter] = useState<string>('all');
  const [needsAttentionOpen, setNeedsAttentionOpen] = useState(false);
  const [needsAttentionRepFilter, setNeedsAttentionRepFilter] = useState<string>('all');
  const [needsAttentionPage, setNeedsAttentionPage] = useState(1);
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
    field: 'appointment_date',
    direction: 'desc'
  });
  const [noTasksSort, setNoTasksSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: 'appointment_date',
    direction: 'desc'
  });
  const [pastConfirmedSort, setPastConfirmedSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: 'appointment_date',
    direction: 'desc'
  });
  const [staleNotesRepFilter, setStaleNotesRepFilter] = useState<string>('all');
  const [noTasksRepFilter, setNoTasksRepFilter] = useState<string>('all');
  const [pastConfirmedRepFilter, setPastConfirmedRepFilter] = useState<string>('all');

  // Note Dialog State
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDialogContactId, setNoteDialogContactId] = useState<string | null>(null);
  const [noteDialogContactName, setNoteDialogContactName] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Task Dialog State
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogOpportunity, setTaskDialogOpportunity] = useState<DBOpportunity | null>(null);
  const [taskDialogContactId, setTaskDialogContactId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('09:00');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Appointment Status Update State
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [updatingPipelineStageId, setUpdatingPipelineStageId] = useState<string | null>(null);

  // Helper functions
  const getUserName = (userId: string | null): string => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.ghl_id === userId);
    return user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unknown';
  };
  const getContactName = (contactId: string | null): string => {
    if (!contactId) return 'Unknown Contact';
    const contact = contacts.find(c => c.ghl_id === contactId);
    return contact?.contact_name || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Unknown Contact';
  };
  const getOpportunityForAppointment = (contactId: string | null): DBOpportunity | undefined => {
    if (!contactId) return undefined;
    return opportunities.find(o => o.contact_id === contactId && o.status?.toLowerCase() === 'open');
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

  // Fetch GHL Tasks
  const fetchGhlTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const {
        data,
        error
      } = await supabase.from('ghl_tasks').select('*').eq('completed', false).order('due_date', {
        ascending: true
      });
      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to fetch tasks');
        return;
      }
      setGhlTasks(data || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      toast.error('Failed to fetch tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  };
  useEffect(() => {
    fetchGhlTasks();
  }, []);

  // Get unique assignees from GHL tasks
  const uniqueTaskAssignees = useMemo(() => {
    const assigneeIds = new Set(ghlTasks.map(t => t.assigned_to).filter(Boolean));
    return Array.from(assigneeIds).map(id => ({
      id: id!,
      name: getUserName(id!)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ghlTasks, users]);

  // Get opportunity for a contact (for tasks)
  const getOpportunityForContact = (contactId: string): DBOpportunity | undefined => {
    return opportunities.find(o => o.contact_id === contactId);
  };

  // Format due date for tasks in PST
  const formatTaskDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const date = new Date(dueDate);
    // Use toLocaleString with America/Los_Angeles timezone for accurate PST/PDT conversion
    const pstDateString = date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return pstDateString + " PST";
  };
  const isTaskOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Calculate task counts by category
  const taskCounts = useMemo(() => {
    let baseTasks = ghlTasks.filter(t => !t.completed);

    // Filter out tasks where the associated opportunity is lost
    baseTasks = baseTasks.filter(t => {
      const opportunity = getOpportunityForContact(t.contact_id);
      if (!opportunity) return true;
      return opportunity.status?.toLowerCase() !== 'lost';
    });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const pastDue = baseTasks.filter(t => t.due_date && new Date(t.due_date) < today).length;
    const todayTomorrow = baseTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate < dayAfterTomorrow;
    }).length;
    const afterTomorrow = baseTasks.filter(t => t.due_date && new Date(t.due_date) >= dayAfterTomorrow).length;
    return {
      pastDue,
      todayTomorrow,
      afterTomorrow,
      total: baseTasks.length
    };
  }, [ghlTasks, opportunities]);

  // Filter GHL tasks
  const filteredGhlTasks = useMemo(() => {
    let filtered = ghlTasks.filter(t => !t.completed);

    // Filter out tasks where the associated opportunity is lost
    filtered = filtered.filter(t => {
      const opportunity = getOpportunityForContact(t.contact_id);
      if (!opportunity) return true;
      return opportunity.status?.toLowerCase() !== 'lost';
    });

    // Assignee filter
    if (tasksAssigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assigned_to === tasksAssigneeFilter);
    }

    // Due date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    if (tasksDueDateFilter === 'past_due') {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < today;
      });
    } else if (tasksDueDateFilter === 'today_tomorrow') {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate >= today && dueDate < dayAfterTomorrow;
      });
    } else if (tasksDueDateFilter === 'after_tomorrow') {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) >= dayAfterTomorrow;
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
    setNoteText('');
    setNoteDialogOpen(true);
  };
  const handleCreateNote = async () => {
    if (!noteDialogContactId || !noteText.trim()) return;
    setIsCreatingNote(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-contact-note', {
        body: {
          contactId: noteDialogContactId,
          body: noteText.trim()
        }
      });
      if (error) throw error;
      toast.success('Note created successfully');
      setNoteDialogOpen(false);
      setNoteText('');
      onDataRefresh?.();
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Failed to create note');
    } finally {
      setIsCreatingNote(false);
    }
  };
  const handleOpenTaskDialog = (opportunity: DBOpportunity, contactId: string | null, contactName: string) => {
    setTaskDialogOpportunity(opportunity);
    setTaskDialogContactId(contactId);
    setTaskTitle(`Follow up: ${contactName}`);
    setTaskNotes('');
    setTaskAssignee(opportunity.assigned_to || '');
    setTaskDueDate('');
    setTaskDueTime('09:00');
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
        const [year, month, day] = taskDueDate.split('-').map(Number);
        const [hours, minutes] = taskDueTime.split(':').map(Number);
        const utcHours = hours - pstOffset;
        const date = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, 0));
        dueDateTime = date.toISOString();
      }

      // Get location_id from contact
      const contact = contacts.find(c => c.ghl_id === taskDialogContactId);
      const locationId = contact?.location_id || DEFAULT_LOCATION_ID;

      // Insert into Supabase first
      const {
        data: insertedTask,
        error: insertError
      } = await supabase.from('tasks').insert({
        opportunity_id: taskDialogOpportunity.ghl_id,
        contact_id: taskDialogContactId,
        title: taskTitle.trim(),
        notes: taskNotes.trim() || null,
        assigned_to: taskAssignee === 'unassigned' ? null : taskAssignee || null,
        due_date: dueDateTime,
        status: 'pending',
        location_id: locationId
      }).select().single();
      if (insertError) throw insertError;

      // Sync to GHL
      const {
        error: ghlError
      } = await supabase.functions.invoke('create-ghl-task', {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateTime,
          assignedTo: taskAssignee === 'unassigned' ? null : taskAssignee || null,
          contactId: taskDialogContactId,
          supabaseTaskId: insertedTask.id
        }
      });
      if (ghlError) {
        console.error('GHL sync error:', ghlError);
        // Task was created locally, just warn about GHL sync
        toast.warning('Task created locally but GHL sync failed');
      } else {
        toast.success('Task created successfully');
      }
      setTaskDialogOpen(false);
      onDataRefresh?.();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };
  const handleUpdateAppointmentStatus = async (appointmentGhlId: string, newStatus: string) => {
    setUpdatingAppointmentId(appointmentGhlId);
    try {
      // Update in GHL
      const {
        error: ghlError
      } = await supabase.functions.invoke('update-ghl-appointment', {
        body: {
          ghl_id: appointmentGhlId,
          appointment_status: newStatus
        }
      });
      if (ghlError) throw ghlError;

      // Update in Supabase
      const {
        error: dbError
      } = await supabase.from('appointments').update({
        appointment_status: newStatus
      }).eq('ghl_id', appointmentGhlId);
      if (dbError) throw dbError;
      toast.success(`Appointment marked as "${newStatus}"`);
      onDataRefresh?.();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment status');
    } finally {
      setUpdatingAppointmentId(null);
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
      toast.error('Invalid stage selected');
      return;
    }
    setUpdatingPipelineStageId(opportunity.ghl_id);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('update-ghl-opportunity', {
        body: {
          ghl_id: opportunity.ghl_id,
          status: opportunity.status,
          stage_name: newStageName,
          pipeline_stage_id: stageInfo.stageId,
          monetary_value: opportunity.monetary_value,
          assigned_to: opportunity.assigned_to
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Pipeline stage updated to "${newStageName}"`);
      onDataRefresh?.();
    } catch (error) {
      console.error('Error updating pipeline stage:', error);
      toast.error('Failed to update pipeline stage');
    } finally {
      setUpdatingPipelineStageId(null);
    }
  };

  // Helper to get address from contact custom_fields
  const getAddress = (contactId: string | null): string => {
    if (!contactId) return 'No address';
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (!contact?.custom_fields) return 'No address';
    const customFields = contact.custom_fields as Array<{
      id: string;
      value: string;
    }>;
    const addressField = customFields.find(f => f.id === 'b7oTVsUQrLgZt84bHpCn');
    return addressField?.value || 'No address';
  };

  // Helper to get scope from contact custom_fields
  const getScope = (contactId: string | null): string => {
    if (!contactId) return '';
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (!contact?.custom_fields) return '';
    const customFields = contact.custom_fields as Array<{
      id: string;
      value: string;
    }>;
    const scopeField = customFields.find(f => f.id === 'KwQRtJT0aMSHnq3mwR68');
    return scopeField?.value || '';
  };

  // Close to Sale Data - opportunities with pipeline stage containing "close to sale", "important", or "second appointment"
  const closeToSaleData = useMemo(() => {
    const results = opportunities.filter(o => {
      const stageName = o.stage_name?.toLowerCase() || '';
      const isCloseToSale = stageName.includes('close') && stageName.includes('sale');
      const isImportant = stageName === 'important';
      const isSecondAppointment = stageName.includes('second') && stageName.includes('appointment');
      return (isCloseToSale || isImportant || isSecondAppointment) && o.status?.toLowerCase() === 'open';
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
    if (closeToSaleRepFilter !== 'all') {
      unique = unique.filter(o => o.assigned_to === closeToSaleRepFilter);
    }

    // Sort by monetary value descending
    return unique.sort((a, b) => (b.monetary_value || 0) - (a.monetary_value || 0));
  }, [opportunities, closeToSaleRepFilter]);
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
      if (appointment.appointment_status?.toLowerCase() === 'cancelled') return;
      const appointmentDate = new Date(appointment.start_time);

      // Only include past appointments
      if (appointmentDate >= now) return;
      const opportunity = getOpportunityForAppointment(appointment.contact_id);
      if (!opportunity) return;
      const lastNoteDate = getLatestNoteDate(appointment.contact_id);

      // Include if no notes exist OR last note is before appointment
      if (lastNoteDate === null || lastNoteDate < appointmentDate) {
        const contact = contacts.find(c => c.ghl_id === appointment.contact_id);
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

    // Apply rep filter
    let filtered = results;
    if (staleNotesRepFilter !== 'all') {
      filtered = results.filter(r => r.appointment.assigned_user_id === staleNotesRepFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = staleNotesSort.direction === 'asc' ? 1 : -1;
      switch (staleNotesSort.field) {
        case 'appointment_date':
          return direction * (new Date(a.appointment.start_time!).getTime() - new Date(b.appointment.start_time!).getTime());
        case 'last_note_date':
          if (!a.lastNoteDate && !b.lastNoteDate) return 0;
          if (!a.lastNoteDate) return direction;
          if (!b.lastNoteDate) return -direction;
          return direction * (a.lastNoteDate.getTime() - b.lastNoteDate.getTime());
        case 'contact_name':
          return direction * getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id));
        default:
          return 0;
      }
    });
    return filtered;
  }, [appointments, opportunities, contacts, contactNotes, staleNotesSort, staleNotesRepFilter]);

  // View 2: No Tasks Assigned - Open opportunities with past appointments but no tasks
  const noTasksData = useMemo(() => {
    const now = new Date();
    const results: Array<{
      opportunity: DBOpportunity;
      contact: DBContact | undefined;
      latestAppointment: DBAppointment | undefined;
    }> = [];

    // Get open opportunities
    const openOpportunities = opportunities.filter(o => o.status?.toLowerCase() === 'open');
    openOpportunities.forEach(opportunity => {
      if (!opportunity.contact_id) return;

      // Check if this opportunity has any past appointments (exclude future appointments)
      const oppAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id && a.appointment_status?.toLowerCase() !== 'cancelled' && a.start_time && new Date(a.start_time) < now);
      if (oppAppointments.length === 0) return;

      // Check if any tasks exist for this opportunity
      const oppTasks = tasks.filter(t => t.opportunity_id === opportunity.ghl_id);
      if (oppTasks.length > 0) return;
      const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
      const latestAppointment = oppAppointments.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime())[0];
      results.push({
        opportunity,
        contact,
        latestAppointment
      });
    });

    // Apply rep filter (using opportunity assigned_to or contact assigned_to)
    let filtered = results;
    if (noTasksRepFilter !== 'all') {
      filtered = results.filter(r => r.opportunity.assigned_to === noTasksRepFilter || r.contact?.assigned_to === noTasksRepFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = noTasksSort.direction === 'asc' ? 1 : -1;
      switch (noTasksSort.field) {
        case 'appointment_date':
          const aDate = a.latestAppointment?.start_time ? new Date(a.latestAppointment.start_time).getTime() : 0;
          const bDate = b.latestAppointment?.start_time ? new Date(b.latestAppointment.start_time).getTime() : 0;
          return direction * (aDate - bDate);
        case 'contact_name':
          return direction * getContactName(a.opportunity.contact_id).localeCompare(getContactName(b.opportunity.contact_id));
        default:
          return 0;
      }
    });
    return filtered;
  }, [opportunities, appointments, contacts, tasks, noTasksSort, noTasksRepFilter]);

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
      const isAppointmentConfirmed = appointmentStatus === 'confirmed';
      const isPipelineStageAppointmentConfirmed = pipelineStage?.includes('appointment') && pipelineStage?.includes('confirmed');
      if (isAppointmentConfirmed || isPipelineStageAppointmentConfirmed) {
        const contact = appointment.contact_id ? contacts.find(c => c.ghl_id === appointment.contact_id) : undefined;
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
    if (pastConfirmedRepFilter !== 'all') {
      filtered = results.filter(r => r.appointment.assigned_user_id === pastConfirmedRepFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const direction = pastConfirmedSort.direction === 'asc' ? 1 : -1;
      switch (pastConfirmedSort.field) {
        case 'appointment_date':
          return direction * (new Date(a.appointment.start_time!).getTime() - new Date(b.appointment.start_time!).getTime());
        case 'contact_name':
          return direction * getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id));
        case 'opportunity_name':
          const aName = a.opportunity?.name || '';
          const bName = b.opportunity?.name || '';
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
    const openOpportunities = opportunities.filter(o => o.status?.toLowerCase() === 'open');
    
    openOpportunities.forEach(opportunity => {
      if (!opportunity.contact_id) return;
      
      // MUST HAVE: Check for NO appointments ever (not even cancelled)
      const contactAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id);
      if (contactAppointments.length > 0) return; // Skip if any appointments exist
      
      // Check notes condition
      const contactNotesList = contactNotes.filter(n => n.contact_id === opportunity.contact_id);
      const latestNoteDate = getLatestNoteDate(opportunity.contact_id);
      const hasStaleOrNoNotes = contactNotesList.length === 0 || (latestNoteDate !== null && latestNoteDate < sevenDaysAgo);
      
      // Check tasks condition - from both tasks table AND ghl_tasks
      const oppTasks = tasks.filter(t => t.opportunity_id === opportunity.ghl_id);
      const contactGhlTasks = ghlTasks.filter(t => t.contact_id === opportunity.contact_id && !t.completed);
      const allRelatedTasks = [...oppTasks.map(t => ({ due_date: t.due_date })), ...contactGhlTasks.map(t => ({ due_date: t.due_date }))];
      
      const hasNoTasks = allRelatedTasks.length === 0;
      const overdueTasks = allRelatedTasks.filter(t => t.due_date && new Date(t.due_date) < now);
      const hasOverdueTasks = overdueTasks.length > 0;
      const hasExpiredOrNoTasks = hasNoTasks || hasOverdueTasks;
      
      // MUST HAVE one of: stale notes OR expired/no tasks
      if (!hasStaleOrNoNotes && !hasExpiredOrNoTasks) return;
      
      const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
      
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
    if (needsAttentionRepFilter !== 'all') {
      filtered = results.filter(r => 
        r.opportunity.assigned_to === needsAttentionRepFilter || 
        r.contact?.assigned_to === needsAttentionRepFilter
      );
    }
    
    // Sort by monetary value descending
    return filtered.sort((a, b) => (b.opportunity.monetary_value || 0) - (a.opportunity.monetary_value || 0));
  }, [opportunities, appointments, contacts, contactNotes, tasks, ghlTasks, needsAttentionRepFilter]);

  const toggleSort = (view: 'stale' | 'noTasks' | 'pastConfirmed', field: SortField) => {
    if (view === 'stale') {
      setStaleNotesSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
    } else if (view === 'noTasks') {
      setNoTasksSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
    } else {
      setPastConfirmedSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
    }
  };
  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  return <div className="space-y-3">
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
            <DialogDescription>
              Create a task for {taskDialogOpportunity?.name || 'this opportunity'}
            </DialogDescription>
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
                      {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'}
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

      {/* Grid layout for sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Close to Sale View */}
        <Collapsible open={closeToSaleOpen} onOpenChange={setCloseToSaleOpen} className={closeToSaleOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{closeToSaleData.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">Close to Sale, Important, or Second Appointment stages</CardDescription>
                    </div>
                  </div>
                  {closeToSaleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Select value={closeToSaleRepFilter} onValueChange={setCloseToSaleRepFilter}>
                  <SelectTrigger className="w-[200px]">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {closeToSaleData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  No opportunities close to sale
                </div> : <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Pipeline Stage</TableHead>
                        <TableHead>Assigned Rep</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closeToSaleData.map(opp => {
                    return <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(opp)}>
                            <TableCell className="font-medium">
                              {opp.name || 'Unnamed'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {getAddress(opp.contact_id)}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {getScope(opp.contact_id) || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                {opp.stage_name || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>{getUserName(opp.assigned_to)}</TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(opp.monetary_value)}
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

        {/* Tasks Helper */}
        <Collapsible open={tasksHelperOpen} onOpenChange={setTasksHelperOpen} className={tasksHelperOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{taskCounts.total}</Badge>
                        <Badge variant="outline" className={`cursor-pointer hover:opacity-80 text-xs ${taskCounts.pastDue > 0 ? "bg-red-500/10 text-red-600 border-red-500/30" : "text-muted-foreground"}`} onClick={e => {
                        e.stopPropagation();
                        setTasksDueDateFilter('past_due');
                        setTasksHelperOpen(true);
                      }}>
                          {taskCounts.pastDue} past due
                        </Badge>
                        <Badge variant="outline" className={`cursor-pointer hover:opacity-80 text-xs ${taskCounts.todayTomorrow > 0 ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "text-muted-foreground"}`} onClick={e => {
                        e.stopPropagation();
                        setTasksDueDateFilter('today_tomorrow');
                        setTasksHelperOpen(true);
                      }}>
                          {taskCounts.todayTomorrow} today/tomorrow
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer hover:opacity-80 text-muted-foreground text-xs hidden sm:inline-flex" onClick={e => {
                        e.stopPropagation();
                        setTasksDueDateFilter('after_tomorrow');
                        setTasksHelperOpen(true);
                      }}>
                          {taskCounts.afterTomorrow} after
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">GHL tasks - click to view opportunity</CardDescription>
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
                    {uniqueTaskAssignees.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
                    <SelectItem value="today_tomorrow">Due: Today & Tomorrow</SelectItem>
                    <SelectItem value="after_tomorrow">Due: After Tomorrow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoadingTasks && ghlTasks.length === 0 ? <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading tasks from GHL...</span>
                </div> : filteredGhlTasks.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  No pending tasks found
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
                              {overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
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
                                {task.body.replace(/<[^>]*>/g, '')}
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
        <Collapsible open={needsAttentionOpen} onOpenChange={setNeedsAttentionOpen} className={needsAttentionOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{needsAttentionData.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">No appointments ever + stale notes or expired tasks</CardDescription>
                    </div>
                  </div>
                  {needsAttentionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Select value={needsAttentionRepFilter} onValueChange={(v) => { setNeedsAttentionRepFilter(v); setNeedsAttentionPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {needsAttentionData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                    No cold opportunities needing attention
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
                          {needsAttentionData
                            .slice((needsAttentionPage - 1) * NEEDS_ATTENTION_PAGE_SIZE, needsAttentionPage * NEEDS_ATTENTION_PAGE_SIZE)
                            .map(row => {
                            return <TableRow key={row.opportunity.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenOpportunity(row.opportunity)}>
                                <TableCell className="font-medium">
                                  {getContactName(row.opportunity.contact_id)}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {getAddress(row.opportunity.contact_id)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{row.opportunity.stage_name || 'Unknown'}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-500/30 text-xs">No Appts</Badge>
                                    {row.hasStaleOrNoNotes && (
                                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                                        {row.latestNoteDate ? 'Stale Notes' : 'No Notes'}
                                      </Badge>
                                    )}
                                    {row.hasExpiredOrNoTasks && (
                                      <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30 text-xs">
                                        {row.earliestOverdueDate ? 'Overdue Tasks' : 'No Tasks'}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{getUserName(row.opportunity.assigned_to || row.contact?.assigned_to)}</TableCell>
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
                    {needsAttentionData.length > NEEDS_ATTENTION_PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-muted-foreground">
                          Showing {((needsAttentionPage - 1) * NEEDS_ATTENTION_PAGE_SIZE) + 1}-{Math.min(needsAttentionPage * NEEDS_ATTENTION_PAGE_SIZE, needsAttentionData.length)} of {needsAttentionData.length}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNeedsAttentionPage(p => Math.max(1, p - 1))}
                            disabled={needsAttentionPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNeedsAttentionPage(p => Math.min(Math.ceil(needsAttentionData.length / NEEDS_ATTENTION_PAGE_SIZE), p + 1))}
                            disabled={needsAttentionPage >= Math.ceil(needsAttentionData.length / NEEDS_ATTENTION_PAGE_SIZE)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stale Notes View */}
        <Collapsible open={staleNotesOpen} onOpenChange={setStaleNotesOpen} className={staleNotesOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{staleNotesData.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">Notes before appointment or no notes exist</CardDescription>
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
                    {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {staleNotesData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  No appointments needing note updates
                </div> : <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('stale', 'contact_name')}>
                            Contact <ArrowUpDown className="h-3 w-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('stale', 'appointment_date')}>
                            Appointment <ArrowUpDown className="h-3 w-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('stale', 'last_note_date')}>
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
                    return <TableRow key={row.appointment.id} className={`cursor-pointer hover:bg-muted/50 ${isOld || row.daysSinceNote === null ? 'bg-red-50 dark:bg-red-950/20' : ''}`} onClick={() => onOpenOpportunity(row.opportunity)}>
                            <TableCell className="font-medium">
                              {getContactName(row.appointment.contact_id)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {row.appointment.start_time ? format(new Date(row.appointment.start_time), 'MMM d, yyyy h:mm a') : 'No date'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.lastNoteDate ? <span className={isOld ? 'text-red-600 font-medium' : ''}>
                                  {formatDistanceToNow(row.lastNoteDate, {
                            addSuffix: true
                          })}
                                </span> : <Badge variant="destructive">No notes</Badge>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.opportunity.stage_name || 'Unknown'}</Badge>
                            </TableCell>
                            <TableCell>{getUserName(row.appointment.assigned_user_id)}</TableCell>
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
        <Collapsible open={noTasksOpen} onOpenChange={setNoTasksOpen} className={noTasksOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{noTasksData.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">Past appointments but no tasks created</CardDescription>
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
                    {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {noTasksData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  All open opportunities have tasks assigned
                </div> : <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('noTasks', 'contact_name')}>
                            Contact <ArrowUpDown className="h-3 w-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('noTasks', 'appointment_date')}>
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
                          <TableCell className="font-medium">
                            {getContactName(row.opportunity.contact_id)}
                          </TableCell>
                          <TableCell>{row.opportunity.name || 'Unnamed'}</TableCell>
                          <TableCell>
                            {row.latestAppointment?.start_time ? <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(row.latestAppointment.start_time), 'MMM d, yyyy')}
                              </div> : 'No date'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.opportunity.stage_name || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>{getUserName(row.opportunity.assigned_to || row.contact?.assigned_to)}</TableCell>
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
        <Collapsible open={pastConfirmedOpen} onOpenChange={setPastConfirmedOpen} className={pastConfirmedOpen ? "lg:col-span-2" : ""}>
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
                        <Badge variant="secondary" className="text-xs">{pastConfirmedData.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs hidden sm:block">Past appointments still "Confirmed"</CardDescription>
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
                    {uniqueReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {pastConfirmedData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  No past appointments requiring status or stage update
                </div> : <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('pastConfirmed', 'opportunity_name')}>
                            Opportunity <ArrowUpDown className="h-3 w-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('pastConfirmed', 'appointment_date')}>
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
                      {pastConfirmedData.map(row => <TableRow key={row.appointment.id} className={`cursor-pointer hover:bg-muted/50 ${row.daysPast > 7 ? 'bg-red-50 dark:bg-red-950/20' : ''}`} onClick={() => row.opportunity && onOpenOpportunity(row.opportunity)}>
                          <TableCell className="font-medium">
                            {row.opportunity?.name || 'No opportunity'}
                          </TableCell>
                          <TableCell>{row.appointment.title || 'No title'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {row.appointment.start_time ? format(new Date(row.appointment.start_time), 'MMM d, yyyy h:mm a') : 'No date'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.daysPast > 7 ? 'destructive' : 'secondary'}>
                              {row.daysPast} {row.daysPast === 1 ? 'day' : 'days'} ago
                            </Badge>
                          </TableCell>
                          <TableCell>{getUserName(row.appointment.assigned_user_id)}</TableCell>
                          <TableCell>
                            {row.opportunity ? <Select value="" onValueChange={value => handleUpdatePipelineStage(row.opportunity!, value)} disabled={updatingPipelineStageId === row.opportunity.ghl_id}>
                                <SelectTrigger className="w-[160px]" onClick={e => e.stopPropagation()}>
                                  {updatingPipelineStageId === row.opportunity.ghl_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder={row.opportunity.stage_name || 'Set stage'} />}
                                </SelectTrigger>
                                <SelectContent>
                                  {availableStages.map(stage => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                                </SelectContent>
                              </Select> : <span className="text-muted-foreground text-sm">-</span>}
                          </TableCell>
                          <TableCell>
                            <Select value={row.appointment.appointment_status?.toLowerCase() || ''} onValueChange={value => handleUpdateAppointmentStatus(row.appointment.ghl_id, value)} disabled={updatingAppointmentId === row.appointment.ghl_id}>
                              <SelectTrigger className="w-[130px]" onClick={e => e.stopPropagation()}>
                                {updatingAppointmentId === row.appointment.ghl_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
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