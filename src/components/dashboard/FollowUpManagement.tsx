import { useState, useMemo } from "react";
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp, ArrowUpDown, Calendar, User, Clock, Plus, FileText, Loader2 } from "lucide-react";
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
  pipeline_name: string | null;
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

type SortField = 'appointment_date' | 'last_note_date' | 'contact_name';
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
  onDataRefresh,
}: FollowUpManagementProps) {
  const [staleNotesOpen, setStaleNotesOpen] = useState(false);
  const [noTasksOpen, setNoTasksOpen] = useState(false);
  const [pastConfirmedOpen, setPastConfirmedOpen] = useState(false);
  const [staleNotesSort, setStaleNotesSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'appointment_date',
    direction: 'desc',
  });
  const [noTasksSort, setNoTasksSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'appointment_date',
    direction: 'desc',
  });
  const [pastConfirmedSort, setPastConfirmedSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'appointment_date',
    direction: 'desc',
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
      name: getUserName(id),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, users]);

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
      const { data, error } = await supabase.functions.invoke('create-contact-note', {
        body: {
          contactId: noteDialogContactId,
          body: noteText.trim(),
        },
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
      const { data: insertedTask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          opportunity_id: taskDialogOpportunity.ghl_id,
          contact_id: taskDialogContactId,
          title: taskTitle.trim(),
          notes: taskNotes.trim() || null,
          assigned_to: taskAssignee || null,
          due_date: dueDateTime,
          status: 'pending',
          location_id: locationId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Sync to GHL
      const { error: ghlError } = await supabase.functions.invoke('create-ghl-task', {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateTime,
          assignedTo: taskAssignee || null,
          contactId: taskDialogContactId,
          supabaseTaskId: insertedTask.id,
        },
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
      const { error: ghlError } = await supabase.functions.invoke('update-ghl-appointment', {
        body: {
          ghl_id: appointmentGhlId,
          appointment_status: newStatus,
        },
      });

      if (ghlError) throw ghlError;

      // Update in Supabase
      const { error: dbError } = await supabase
        .from('appointments')
        .update({ appointment_status: newStatus })
        .eq('ghl_id', appointmentGhlId);

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

  // View 1: Stale Notes - Appointments where last note is before appointment date
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
        const daysSinceNote = lastNoteDate 
          ? Math.floor((Date.now() - lastNoteDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        results.push({
          appointment,
          opportunity,
          contact,
          lastNoteDate,
          daysSinceNote,
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
          return direction * (getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id)));
        default:
          return 0;
      }
    });

    return filtered;
  }, [appointments, opportunities, contacts, contactNotes, staleNotesSort, staleNotesRepFilter]);

  // View 2: No Tasks Assigned - Open opportunities with appointments but no tasks
  const noTasksData = useMemo(() => {
    const results: Array<{
      opportunity: DBOpportunity;
      contact: DBContact | undefined;
      latestAppointment: DBAppointment | undefined;
    }> = [];

    // Get open opportunities
    const openOpportunities = opportunities.filter(o => o.status?.toLowerCase() === 'open');

    openOpportunities.forEach(opportunity => {
      if (!opportunity.contact_id) return;

      // Check if this opportunity has any appointments
      const oppAppointments = appointments.filter(a => 
        a.contact_id === opportunity.contact_id &&
        a.appointment_status?.toLowerCase() !== 'cancelled'
      );
      if (oppAppointments.length === 0) return;

      // Check if any tasks exist for this opportunity
      const oppTasks = tasks.filter(t => t.opportunity_id === opportunity.ghl_id);
      if (oppTasks.length > 0) return;

      const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
      const latestAppointment = oppAppointments.sort((a, b) => 
        new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime()
      )[0];

      results.push({
        opportunity,
        contact,
        latestAppointment,
      });
    });

    // Apply rep filter (using opportunity assigned_to or contact assigned_to)
    let filtered = results;
    if (noTasksRepFilter !== 'all') {
      filtered = results.filter(r => 
        r.opportunity.assigned_to === noTasksRepFilter || 
        r.contact?.assigned_to === noTasksRepFilter
      );
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
          return direction * (getContactName(a.opportunity.contact_id).localeCompare(getContactName(b.opportunity.contact_id)));
        default:
          return 0;
      }
    });

    return filtered;
  }, [opportunities, appointments, contacts, tasks, noTasksSort, noTasksRepFilter]);

  // View 3: Past Confirmed - Appointments still marked as confirmed but date has passed
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
      const status = appointment.appointment_status?.toLowerCase();
      
      // Only include if status is "confirmed" and date is in the past
      if (status === 'confirmed' && appointmentDate < now) {
        const opportunity = appointment.contact_id 
          ? opportunities.find(o => o.contact_id === appointment.contact_id)
          : undefined;
        const contact = appointment.contact_id
          ? contacts.find(c => c.ghl_id === appointment.contact_id)
          : undefined;
        const daysPast = Math.floor((now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));

        results.push({
          appointment,
          opportunity,
          contact,
          daysPast,
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
          return direction * (getContactName(a.appointment.contact_id).localeCompare(getContactName(b.appointment.contact_id)));
        default:
          return 0;
      }
    });

    return filtered;
  }, [appointments, opportunities, contacts, pastConfirmedSort, pastConfirmedRepFilter]);

  const toggleSort = (view: 'stale' | 'noTasks' | 'pastConfirmed', field: SortField) => {
    if (view === 'stale') {
      setStaleNotesSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      }));
    } else if (view === 'noTasks') {
      setNoTasksSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      }));
    } else {
      setPastConfirmedSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      }));
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add a note for {noteDialogContactName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
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
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.ghl_id} value={user.ghl_id}>
                      {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-date">Due Date</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-time">Due Time (PST)</Label>
                <Input
                  id="task-time"
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                />
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

      {/* Stale Notes View */}
      <Collapsible open={staleNotesOpen} onOpenChange={setStaleNotesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Stale Notes
                      <Badge variant="secondary">{staleNotesData.length}</Badge>
                    </CardTitle>
                    <CardDescription>Appointments where last note is before appointment date or no notes exist</CardDescription>
                  </div>
                </div>
                {staleNotesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                    {uniqueReps.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {staleNotesData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No appointments needing note updates
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
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
                      {staleNotesData.map((row) => {
                        const isOld = row.daysSinceNote !== null && row.daysSinceNote > 7;
                        return (
                          <TableRow
                            key={row.appointment.id}
                            className={`cursor-pointer hover:bg-muted/50 ${isOld || row.daysSinceNote === null ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                            onClick={() => onOpenOpportunity(row.opportunity)}
                          >
                            <TableCell className="font-medium">
                              {getContactName(row.appointment.contact_id)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {row.appointment.start_time 
                                  ? format(new Date(row.appointment.start_time), 'MMM d, yyyy h:mm a')
                                  : 'No date'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.lastNoteDate ? (
                                <span className={isOld ? 'text-red-600 font-medium' : ''}>
                                  {formatDistanceToNow(row.lastNoteDate, { addSuffix: true })}
                                </span>
                              ) : (
                                <Badge variant="destructive">No notes</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.opportunity.stage_name || 'Unknown'}</Badge>
                            </TableCell>
                            <TableCell>{getUserName(row.appointment.assigned_user_id)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(row.opportunity.monetary_value)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenNoteDialog(
                                    row.appointment.contact_id!,
                                    getContactName(row.appointment.contact_id)
                                  );
                                }}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Add Note
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* No Tasks View */}
      <Collapsible open={noTasksOpen} onOpenChange={setNoTasksOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      No Tasks Assigned
                      <Badge variant="secondary">{noTasksData.length}</Badge>
                    </CardTitle>
                    <CardDescription>Open opportunities with appointments but no tasks created</CardDescription>
                  </div>
                </div>
                {noTasksOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                    {uniqueReps.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {noTasksData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  All open opportunities have tasks assigned
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
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
                      {noTasksData.map((row) => (
                        <TableRow
                          key={row.opportunity.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onOpenOpportunity(row.opportunity)}
                        >
                          <TableCell className="font-medium">
                            {getContactName(row.opportunity.contact_id)}
                          </TableCell>
                          <TableCell>{row.opportunity.name || 'Unnamed'}</TableCell>
                          <TableCell>
                            {row.latestAppointment?.start_time ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(row.latestAppointment.start_time), 'MMM d, yyyy')}
                              </div>
                            ) : (
                              'No date'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.opportunity.stage_name || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>{getUserName(row.opportunity.assigned_to || row.contact?.assigned_to)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(row.opportunity.monetary_value)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTaskDialog(
                                  row.opportunity,
                                  row.opportunity.contact_id,
                                  getContactName(row.opportunity.contact_id)
                                );
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Task
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Past Confirmed Appointments View */}
      <Collapsible open={pastConfirmedOpen} onOpenChange={setPastConfirmedOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Past Confirmed Appointments
                      <Badge variant="secondary">{pastConfirmedData.length}</Badge>
                    </CardTitle>
                    <CardDescription>Appointments still marked as "Confirmed" but date has already passed</CardDescription>
                  </div>
                </div>
                {pastConfirmedOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                    {uniqueReps.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pastConfirmedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No past appointments still marked as confirmed
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleSort('pastConfirmed', 'contact_name')}>
                            Contact <ArrowUpDown className="h-3 w-3 ml-1" />
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
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Update Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastConfirmedData.map((row) => (
                        <TableRow
                          key={row.appointment.id}
                          className={`cursor-pointer hover:bg-muted/50 ${row.daysPast > 7 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                          onClick={() => row.opportunity && onOpenOpportunity(row.opportunity)}
                        >
                          <TableCell className="font-medium">
                            {getContactName(row.appointment.contact_id)}
                          </TableCell>
                          <TableCell>{row.appointment.title || 'No title'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {row.appointment.start_time 
                                ? format(new Date(row.appointment.start_time), 'MMM d, yyyy h:mm a')
                                : 'No date'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.daysPast > 7 ? 'destructive' : 'secondary'}>
                              {row.daysPast} {row.daysPast === 1 ? 'day' : 'days'} ago
                            </Badge>
                          </TableCell>
                          <TableCell>{getUserName(row.appointment.assigned_user_id)}</TableCell>
                          <TableCell>
                            {row.opportunity ? (
                              <Badge variant="outline">{row.opportunity.name || 'Unnamed'}</Badge>
                            ) : (
                              <span className="text-muted-foreground">No opportunity</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value=""
                              onValueChange={(value) => handleUpdateAppointmentStatus(row.appointment.ghl_id, value)}
                              disabled={updatingAppointmentId === row.appointment.ghl_id}
                            >
                              <SelectTrigger 
                                className="w-[130px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {updatingAppointmentId === row.appointment.ghl_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SelectValue placeholder="Set status" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="showed">Showed</SelectItem>
                                <SelectItem value="noshow">No Show</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
