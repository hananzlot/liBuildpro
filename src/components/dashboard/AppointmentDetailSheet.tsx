import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, Clock, User, FileText, DollarSign, Target, MapPin, Phone, Mail, 
  Briefcase, RefreshCw, MessageSquare, CheckSquare, Plus, Loader2, ChevronRight,
  ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
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
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  custom_fields?: CustomField[] | unknown;
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
}

interface Task {
  id: string;
  ghl_id: string | null;
  title: string;
  body?: string | null;
  notes?: string | null;
  due_date: string | null;
  completed?: boolean;
  status?: string;
  assigned_to: string | null;
  source: 'app' | 'ghl';
}

interface AppointmentDetailSheetProps {
  appointment: Appointment | null;
  opportunities: Opportunity[];
  contacts: Contact[];
  users: GHLUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOpportunity?: (opportunity: Opportunity) => void;
}

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

function extractCustomField(customFields: unknown, fieldId: string): string | null {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: CustomField) => f.id === fieldId);
  return field?.value || null;
}

export function AppointmentDetailSheet({
  appointment,
  opportunities,
  contacts,
  users,
  open,
  onOpenChange,
  onOpenOpportunity,
}: AppointmentDetailSheetProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const contact = appointment ? contacts.find(c => c.ghl_id === appointment.contact_id) : null;
  const relatedOpportunities = appointment ? opportunities.filter(o => o.contact_id === appointment.contact_id) : [];
  const primaryOpportunity = relatedOpportunities[0];

  // Fetch conversations
  const fetchConversations = async () => {
    if (!appointment?.contact_id) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-contact-conversations', {
        body: { contact_id: appointment.contact_id }
      });
      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
      const { data: ghlData, error: ghlError } = await supabase.functions.invoke('fetch-contact-notes', {
        body: { contact_id: appointment.contact_id }
      });
      if (ghlError) console.error('Error fetching from GHL:', ghlError);

      // Then fetch from database
      const { data, error } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', appointment.contact_id)
        .order('ghl_date_added', { ascending: false });
      
      if (error) throw error;
      setContactNotes(data || []);
    } catch (error) {
      console.error('Error fetching contact notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Fetch tasks
  const fetchTasks = async () => {
    if (!appointment?.contact_id) return;
    setLoadingTasks(true);
    try {
      // Fetch from both tables
      const [appTasksResult, ghlTasksResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('contact_id', appointment.contact_id),
        supabase
          .from('ghl_tasks')
          .select('*')
          .eq('contact_id', appointment.contact_id)
      ]);

      const appTasks: Task[] = (appTasksResult.data || []).map(t => ({
        id: t.id,
        ghl_id: t.ghl_id,
        title: t.title,
        notes: t.notes,
        due_date: t.due_date,
        status: t.status,
        assigned_to: t.assigned_to,
        source: 'app' as const
      }));

      const ghlTasks: Task[] = (ghlTasksResult.data || []).map(t => ({
        id: t.id,
        ghl_id: t.ghl_id,
        title: t.title,
        body: t.body,
        due_date: t.due_date,
        completed: t.completed,
        assigned_to: t.assigned_to,
        source: 'ghl' as const
      }));

      // Merge and deduplicate by ghl_id
      const allTasks = [...appTasks, ...ghlTasks];
      const seen = new Set<string>();
      const uniqueTasks = allTasks.filter(t => {
        if (t.ghl_id && seen.has(t.ghl_id)) return false;
        if (t.ghl_id) seen.add(t.ghl_id);
        return true;
      });

      // Sort by due_date
      uniqueTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      setTasks(uniqueTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Add new note
  const handleAddNote = async () => {
    if (!appointment?.contact_id || !newNoteBody.trim()) return;
    setIsAddingNote(true);
    try {
      const { error } = await supabase.functions.invoke('create-contact-note', {
        body: { contactId: appointment.contact_id, body: newNoteBody.trim() }
      });
      if (error) throw error;
      toast.success('Note added successfully');
      setNewNoteBody('');
      setShowAddNote(false);
      fetchContactNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Toggle task completion
  const handleToggleTask = async (task: Task) => {
    if (task.source === 'ghl' && task.ghl_id) {
      try {
        const newCompleted = !task.completed;
        const { error } = await supabase.functions.invoke('update-ghl-task', {
          body: { 
            contactId: appointment?.contact_id,
            taskId: task.ghl_id, 
            completed: newCompleted 
          }
        });
        if (error) throw error;
        
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === task.id ? { ...t, completed: newCompleted } : t
        ));
        toast.success(newCompleted ? 'Task completed' : 'Task reopened');
      } catch (error) {
        console.error('Error updating task:', error);
        toast.error('Failed to update task');
      }
    }
  };

  // Fetch data when sheet opens
  useEffect(() => {
    if (open && appointment?.contact_id) {
      fetchConversations();
      fetchContactNotes();
      fetchTasks();
    }
  }, [open, appointment?.contact_id]);

  if (!appointment) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
      case 'no_show': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'showed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0,
    }).format(value);
  };

  const assignedUser = users.find(u => u.ghl_id === appointment.assigned_user_id);

  const contactName = contact?.contact_name || 
    (contact?.first_name && contact?.last_name 
      ? `${contact.first_name} ${contact.last_name}` 
      : contact?.first_name || contact?.last_name || 'Unknown');

  const userName = assignedUser?.name || 
    (assignedUser?.first_name && assignedUser?.last_name 
      ? `${assignedUser.first_name} ${assignedUser.last_name}` 
      : 'Unassigned');

  const address = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
  const scopeOfWork = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK) : null;

  // Get all messages from all conversations, sorted by date
  const allMessages = conversations
    .flatMap(c => c.messages)
    .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());

  const handleOpenOpportunity = (opp: Opportunity) => {
    if (onOpenOpportunity) {
      onOpenChange(false);
      setTimeout(() => onOpenOpportunity(opp), 150);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {appointment.title || 'Untitled Appointment'}
              </SheetTitle>
              <Badge variant="outline" className={`shrink-0 text-xs ${getStatusColor(appointment.appointment_status)}`}>
                {appointment.appointment_status || 'Unknown'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDateTime(appointment.start_time)}</span>
              <span>→</span>
              <span>{formatTime(appointment.end_time)}</span>
            </div>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Clickable Pipeline Status (if opportunity exists) */}
          {primaryOpportunity && (
            <div 
              className={`bg-primary/5 border border-primary/20 rounded-lg p-3 ${onOpenOpportunity ? 'cursor-pointer hover:bg-primary/10 transition-colors' : ''}`}
              onClick={() => handleOpenOpportunity(primaryOpportunity)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{primaryOpportunity.pipeline_name || 'Pipeline'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                    {primaryOpportunity.stage_name || 'Unknown'}
                  </Badge>
                  {onOpenOpportunity && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(primaryOpportunity.monetary_value)}
                </div>
                {onOpenOpportunity && (
                  <span className="text-xs text-muted-foreground">Click for full details</span>
                )}
              </div>
            </div>
          )}

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              <div className="font-medium truncate">{userName}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Contact</div>
              <div className="font-medium truncate">{contactName}</div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Details</span>
            </div>
            <div className="p-3 grid gap-1.5 text-sm text-muted-foreground">
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
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appointment Notes</span>
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
                <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
              </div>
              {loadingTasks && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
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
                        task.completed || task.status === 'completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-muted-foreground/40 hover:border-primary'
                      }`}
                    >
                      {(task.completed || task.status === 'completed') && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${task.completed || task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </div>
                      {task.due_date && (
                        <div className="text-xs text-muted-foreground">
                          Due: {formatDateShort(task.due_date)}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {task.source === 'ghl' ? 'GHL' : 'App'}
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
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Notes</span>
                <Badge variant="secondary" className="text-xs">{contactNotes.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {loadingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAddNote(!showAddNote)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={fetchContactNotes}
                  disabled={loadingNotes}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingNotes ? 'animate-spin' : ''}`} />
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
                    onClick={() => { setShowAddNote(false); setNewNoteBody(''); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={isAddingNote || !newNoteBody.trim()}
                  >
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
                contactNotes.map((note) => (
                  <div key={note.id} className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      {note.ghl_date_added ? formatDateShort(note.ghl_date_added) : 'Unknown date'}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.body || 'No content'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Conversations Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversations</span>
                <Badge variant="secondary" className="text-xs">{allMessages.length}</Badge>
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
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingConversations ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {allMessages.length === 0 && !loadingConversations ? (
                <div className="p-3 text-sm text-muted-foreground text-center">No messages</div>
              ) : (
                allMessages.slice(-20).map((msg) => (
                  <div key={msg.id} className={`p-3 ${msg.direction === 'outbound' ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {msg.direction === 'outbound' ? (
                        <ArrowUpRight className="h-3 w-3 text-primary" />
                      ) : (
                        <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {msg.type || 'Message'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(msg.dateAdded)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.body || '(No content)'}</p>
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
                    className={`p-3 flex items-center justify-between gap-2 ${onOpenOpportunity ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                    onClick={() => handleOpenOpportunity(opp)}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{opp.name || 'Unnamed'}</div>
                      <div className="text-xs text-muted-foreground">{opp.stage_name || 'Unknown Stage'}</div>
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
    </Sheet>
  );
}
