import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, FileText, User, Calendar, MapPin, History, ArrowRight, Clock, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { DBOpportunityEdit, DBTaskEdit, DBNoteEdit, DBAppointmentEdit } from "@/hooks/useGHLContacts";

interface DBOpportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  monetary_value: number | null;
  status: string | null;
  stage_name: string | null;
  contact_id: string | null;
  assigned_to: string | null;
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
  ghl_date_updated?: string | null;
  updated_at?: string;
  entered_by?: string | null;
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
  created_at: string;
  entered_by: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
}

interface DBContactNote {
  id: string;
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
  user_id: string | null;
  entered_by: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
}

interface DBProfile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
}

interface DBContact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  custom_fields?: unknown;
}

interface DBUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

// Unified activity item for display
interface ActivityItem {
  id: string;
  type: "creation" | "edit";
  date: string;
  editedBy: string | null;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedOpportunities: DBOpportunity[];
  allOpportunities?: DBOpportunity[];
  filteredAppointments: DBAppointment[];
  filteredTasks: DBTask[];
  filteredNotes: DBContactNote[];
  filteredOpportunityEdits: DBOpportunityEdit[];
  filteredTaskEdits: DBTaskEdit[];
  filteredNoteEdits: DBNoteEdit[];
  filteredAppointmentEdits: DBAppointmentEdit[];
  contacts: DBContact[];
  users: DBUser[];
  profiles: DBProfile[];
  onOpportunityClick?: (opportunity: DBOpportunity) => void;
  onAppointmentClick?: (appointment: DBAppointment) => void;
  onTaskClick?: (opportunity: DBOpportunity, task: DBTask) => void;
  defaultTab?: "edits" | "appointments" | "tasks" | "notes";
}

const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
  SCOPE_OF_WORK: "KwQRtJT0aMSHnq3mwR68",
};

const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: { id: string }) => f.id === fieldId);
  return field?.value || null;
};

interface DBOpportunityExtended extends DBOpportunity {
  contact?: DBContact;
  address?: string | null;
  scopeOfWork?: string | null;
}

const getContactName = (contact: DBContact | undefined): string => {
  if (!contact) return "Unknown";
  return contact.contact_name || 
    `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || 
    "Unknown";
};

const getUserName = (userId: string | null, users: DBUser[]): string => {
  if (!userId) return "Unassigned";
  const user = users.find(u => u.ghl_id === userId);
  if (!user) return "Unknown";
  return user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown";
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCurrency = (value: number | null): string => {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
};

// Strip HTML tags from content (GHL notes often contain HTML)
const stripHtml = (html: string | null): string => {
  if (!html) return "";
  // Remove HTML tags and decode common entities
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
};

const getStatusColor = (status: string | null): string => {
  switch (status?.toLowerCase()) {
    case "won":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "lost":
    case "abandoned":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "open":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
};

const getAppointmentStatusColor = (status: string | null): string => {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "showed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "noshow":
    case "no show":
    case "cancelled":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
};
const getCreatorName = (enteredBy: string | null, profiles: DBProfile[]): string | null => {
  if (!enteredBy) return null;
  const profile = profiles.find(p => p.id === enteredBy);
  return profile?.full_name || profile?.email?.split('@')[0] || null;
};

const getFieldDisplayName = (fieldName: string): string => {
  const fieldNames: Record<string, string> = {
    status: "Status",
    stage_name: "Stage",
    pipeline_name: "Pipeline",
    monetary_value: "Value",
    assigned_to: "Assigned To",
    assigned_user_id: "Assigned To",
    address: "Address",
    scope_of_work: "Scope of Work",
    source: "Source",
    phone: "Phone",
    completed: "Status",
    title: "Title",
    body: "Description",
    due_date: "Due Date",
    start_time: "Start Time",
    end_time: "End Time",
    appointment_status: "Appt Status",
    salesperson_confirmed: "Rep Confirmed",
    notes: "Notes",
  };
  return fieldNames[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const formatFieldValue = (fieldName: string, value: string | null, users: DBUser[], profiles?: DBProfile[]): string => {
  if (value === null || value === undefined || value === "") return "(empty)";
  
  // Boolean fields
  if (fieldName === "completed") {
    return value === "true" ? "Done" : "Pending";
  }
  
  if (fieldName === "salesperson_confirmed") {
    return value === "true" ? "Confirmed" : "Not Confirmed";
  }
  
  // Monetary values
  if (fieldName === "monetary_value") {
    const num = parseFloat(value);
    return isNaN(num) ? value : formatCurrency(num);
  }
  
  // User assignments (GHL user IDs)
  if (fieldName === "assigned_to" || fieldName === "assigned_user_id") {
    return getUserName(value, users);
  }
  
  // Profile references (Supabase user IDs) - like edited_by, entered_by
  if (fieldName === "edited_by" || fieldName === "entered_by") {
    if (profiles) {
      const profile = profiles.find(p => p.id === value);
      if (profile) {
        return profile.full_name || profile.email?.split('@')[0] || value;
      }
    }
    return value;
  }
  
  // Date/time fields
  if (fieldName === "due_date" || fieldName === "start_time" || fieldName === "end_time") {
    try {
      return formatDate(value);
    } catch {
      return value;
    }
  }
  
  // Strip HTML from body/notes fields
  if (fieldName === "body" || fieldName === "notes") {
    const stripped = stripHtml(value);
    return stripped.length > 50 ? stripped.substring(0, 50) + "..." : stripped;
  }
  
  return value;
};

export function ActivitySheet({
  open,
  onOpenChange,
  editedOpportunities,
  allOpportunities = [],
  filteredAppointments,
  filteredTasks,
  filteredNotes,
  filteredOpportunityEdits,
  filteredTaskEdits,
  filteredNoteEdits,
  filteredAppointmentEdits,
  contacts,
  users,
  profiles,
  onOpportunityClick,
  onAppointmentClick,
  onTaskClick,
  defaultTab = "edits",
}: ActivitySheetProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleHistoryExpanded = (recordId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  // Sync activeTab when defaultTab changes (from parent)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Get unique creators from tasks, notes, and edits (both entered_by and edited_by)
  const availableCreators = useMemo(() => {
    const creatorIds = new Set<string>();
    filteredTasks.forEach(t => { 
      if (t.entered_by) creatorIds.add(t.entered_by);
    });
    filteredTaskEdits.forEach(e => { if (e.edited_by) creatorIds.add(e.edited_by); });
    filteredNotes.forEach(n => { 
      if (n.entered_by) creatorIds.add(n.entered_by);
    });
    filteredNoteEdits.forEach(e => { if (e.edited_by) creatorIds.add(e.edited_by); });
    filteredOpportunityEdits.forEach(e => { if (e.edited_by) creatorIds.add(e.edited_by); });
    filteredAppointmentEdits.forEach(e => { if (e.edited_by) creatorIds.add(e.edited_by); });
    return profiles.filter(p => creatorIds.has(p.id));
  }, [filteredTasks, filteredTaskEdits, filteredNotes, filteredNoteEdits, filteredOpportunityEdits, filteredAppointmentEdits, profiles]);

  // Build task activity items: each task creation + each edit is a separate item
  const taskActivityItems = useMemo(() => {
    const items: Array<{ task: DBTask; activity: ActivityItem }> = [];
    
    // Add task creations (only if entered_by exists for in-app)
    filteredTasks.forEach(task => {
      if (task.entered_by) {
        items.push({
          task,
          activity: {
            id: `task-create-${task.id}`,
            type: "creation",
            date: task.created_at,
            editedBy: task.entered_by,
          }
        });
      }
    });
    
    // Add each task edit as a separate item
    filteredTaskEdits.forEach(edit => {
      const task = filteredTasks.find(t => t.ghl_id === edit.task_ghl_id);
      if (task && edit.edited_by) {
        items.push({
          task,
          activity: {
            id: `task-edit-${edit.id}`,
            type: "edit",
            date: edit.edited_at || "",
            editedBy: edit.edited_by,
            fieldName: edit.field_name,
            oldValue: edit.old_value,
            newValue: edit.new_value,
          }
        });
      }
    });
    
    // Filter by inAppOnly (already filtered since we require entered_by/edited_by)
    // Filter by creator
    let filtered = items;
    if (creatorFilter !== "all") {
      filtered = items.filter(i => i.activity.editedBy === creatorFilter);
    }
    
    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.activity.date).getTime() - new Date(a.activity.date).getTime());
  }, [filteredTasks, filteredTaskEdits, creatorFilter]);

  // Build note activity items: each note creation + each edit is a separate item
  const noteActivityItems = useMemo(() => {
    const items: Array<{ note: DBContactNote; activity: ActivityItem }> = [];
    
    // Add note creations (only if entered_by exists for in-app)
    filteredNotes.forEach(note => {
      if (note.entered_by) {
        items.push({
          note,
          activity: {
            id: `note-create-${note.id}`,
            type: "creation",
            date: note.ghl_date_added || "",
            editedBy: note.entered_by,
          }
        });
      }
    });
    
    // Add each note edit as a separate item
    filteredNoteEdits.forEach(edit => {
      const note = filteredNotes.find(n => n.ghl_id === edit.note_ghl_id);
      if (note && edit.edited_by) {
        items.push({
          note,
          activity: {
            id: `note-edit-${edit.id}`,
            type: "edit",
            date: edit.edited_at || "",
            editedBy: edit.edited_by,
            fieldName: edit.field_name,
            oldValue: edit.old_value,
            newValue: edit.new_value,
          }
        });
      }
    });
    
    // Filter by creator
    let filtered = items;
    if (creatorFilter !== "all") {
      filtered = items.filter(i => i.activity.editedBy === creatorFilter);
    }
    
    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.activity.date).getTime() - new Date(a.activity.date).getTime());
  }, [filteredNotes, filteredNoteEdits, creatorFilter]);

  // Build appointment activity items: each appointment creation + each edit is a separate item
  const appointmentActivityItems = useMemo(() => {
    const items: Array<{ appointment: DBAppointment; activity: ActivityItem }> = [];
    
    // Add appointment creations (only if entered_by exists for in-app)
    filteredAppointments.forEach(appt => {
      if (appt.entered_by) {
        items.push({
          appointment: appt,
          activity: {
            id: `appt-create-${appt.id}`,
            type: "creation",
            date: appt.ghl_date_updated || appt.updated_at || "",
            editedBy: appt.entered_by,
          }
        });
      }
    });
    
    // Add each appointment edit as a separate item
    filteredAppointmentEdits.forEach(edit => {
      const appt = filteredAppointments.find(a => a.ghl_id === edit.appointment_ghl_id);
      if (appt && edit.edited_by) {
        items.push({
          appointment: appt,
          activity: {
            id: `appt-edit-${edit.id}`,
            type: "edit",
            date: edit.edited_at || "",
            editedBy: edit.edited_by,
            fieldName: edit.field_name,
            oldValue: edit.old_value,
            newValue: edit.new_value,
          }
        });
      }
    });
    
    // Filter by creator
    let filtered = items;
    if (creatorFilter !== "all") {
      filtered = items.filter(i => i.activity.editedBy === creatorFilter);
    }
    
    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.activity.date).getTime() - new Date(a.activity.date).getTime());
  }, [filteredAppointments, filteredAppointmentEdits, creatorFilter]);

  const displayedEdits = useMemo(() => {
    // Opportunity edits are always in-app (they have edited_by)
    if (creatorFilter === "all") return filteredOpportunityEdits;
    return filteredOpportunityEdits.filter(e => e.edited_by === creatorFilter);
  }, [filteredOpportunityEdits, creatorFilter]);

  // Group task edits by task ghl_id for "View full history"
  const taskEditsMap = useMemo(() => {
    const map = new Map<string, DBTaskEdit[]>();
    filteredTaskEdits.forEach(edit => {
      if (!map.has(edit.task_ghl_id)) {
        map.set(edit.task_ghl_id, []);
      }
      map.get(edit.task_ghl_id)!.push(edit);
    });
    // Sort each array by date ascending (chronological)
    map.forEach(edits => {
      edits.sort((a, b) => new Date(a.edited_at || 0).getTime() - new Date(b.edited_at || 0).getTime());
    });
    return map;
  }, [filteredTaskEdits]);

  // Group note edits by note ghl_id for "View full history"
  const noteEditsMap = useMemo(() => {
    const map = new Map<string, DBNoteEdit[]>();
    filteredNoteEdits.forEach(edit => {
      if (!map.has(edit.note_ghl_id)) {
        map.set(edit.note_ghl_id, []);
      }
      map.get(edit.note_ghl_id)!.push(edit);
    });
    // Sort each array by date ascending (chronological)
    map.forEach(edits => {
      edits.sort((a, b) => new Date(a.edited_at || 0).getTime() - new Date(b.edited_at || 0).getTime());
    });
    return map;
  }, [filteredNoteEdits]);

  // Group appointment edits by appointment ghl_id for "View full history"
  const appointmentEditsMap = useMemo(() => {
    const map = new Map<string, DBAppointmentEdit[]>();
    filteredAppointmentEdits.forEach(edit => {
      if (!map.has(edit.appointment_ghl_id)) {
        map.set(edit.appointment_ghl_id, []);
      }
      map.get(edit.appointment_ghl_id)!.push(edit);
    });
    // Sort each array by date ascending (chronological)
    map.forEach(edits => {
      edits.sort((a, b) => new Date(a.edited_at || 0).getTime() - new Date(b.edited_at || 0).getTime());
    });
    return map;
  }, [filteredAppointmentEdits]);

  // Group edits by opportunity for better display
  const groupedEdits = useMemo(() => {
    const groups = new Map<string, DBOpportunityEdit[]>();
    displayedEdits.forEach(edit => {
      const key = edit.opportunity_ghl_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(edit);
    });
    // Sort each group by edited_at desc
    groups.forEach((edits) => {
      edits.sort((a, b) => 
        new Date(b.edited_at || 0).getTime() - new Date(a.edited_at || 0).getTime()
      );
    });
    // Convert to array and sort by most recent edit
    return Array.from(groups.entries())
      .map(([oppGhlId, edits]) => ({ oppGhlId, edits }))
      .sort((a, b) => 
        new Date(b.edits[0]?.edited_at || 0).getTime() - 
        new Date(a.edits[0]?.edited_at || 0).getTime()
      );
  }, [displayedEdits]);

  const totalActivity = displayedEdits.length + taskActivityItems.length + noteActivityItems.length + appointmentActivityItems.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              Activity in Date Range
              <Badge variant="secondary" className="text-sm">
                {totalActivity} items
              </Badge>
            </SheetTitle>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {availableCreators.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Creator:</span>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="All creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All creators</SelectItem>
                    {availableCreators.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email?.split('@')[0] || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {expandedHistory.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setExpandedHistory(new Set())}
              >
                <ChevronsUpDown className="h-3 w-3" />
                Collapse All ({expandedHistory.size})
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="edits" className="gap-1 text-xs">
              <History className="h-3 w-3" />
              Edits ({displayedEdits.length})
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Appts ({appointmentActivityItems.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 text-xs">
              <CheckSquare className="h-3 w-3" />
              Tasks ({taskActivityItems.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
              Notes ({noteActivityItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edits" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-3 pr-4">
                {groupedEdits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No field edits recorded in this period
                  </p>
                ) : (
                  groupedEdits.map(({ oppGhlId, edits }) => {
                    const opportunity = editedOpportunities.find(o => o.ghl_id === oppGhlId);
                    const contact = opportunity?.contact_id 
                      ? contacts.find(c => c.ghl_id === opportunity.contact_id) 
                      : edits[0]?.contact_ghl_id 
                        ? contacts.find(c => c.ghl_id === edits[0].contact_ghl_id)
                        : undefined;
                    const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                    
                    return (
                      <Card 
                        key={oppGhlId} 
                        className={`border-border/50 ${opportunity && onOpportunityClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                        onClick={() => opportunity && onOpportunityClick?.(opportunity)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate capitalize">
                                {getContactName(contact)}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address || "No address"}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {edits.length} edit{edits.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          
                          <div className="bg-muted/50 rounded p-2 space-y-2">
                            {edits.map((edit, idx) => {
                              const editorName = getCreatorName(edit.edited_by, profiles);
                              return (
                                <div key={edit.id} className={`${idx > 0 ? 'border-t border-border/30 pt-2' : ''}`}>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-primary">
                                      {getFieldDisplayName(edit.field_name)}
                                    </span>
                                    <span className="text-muted-foreground line-through">
                                      {formatFieldValue(edit.field_name, edit.old_value, users, profiles)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-foreground font-medium">
                                      {formatFieldValue(edit.field_name, edit.new_value, users, profiles)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 mt-1">
                                    <span>{formatDate(edit.edited_at)}</span>
                                    {editorName && (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        By: {editorName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="appointments" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pr-4">
                {appointmentActivityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No appointment activity in this period
                  </p>
                ) : (
                  appointmentActivityItems.map(({ appointment: appt, activity }) => {
                    const contact = contacts.find(c => c.ghl_id === appt.contact_id);
                    const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                    const actorName = getCreatorName(activity.editedBy, profiles);
                    return (
                      <Card 
                        key={activity.id} 
                        className={`border-border/50 ${onAppointmentClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                        onClick={() => onAppointmentClick?.(appt)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate capitalize">
                                {getContactName(contact)}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address || "No address"}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span className="truncate">{appt.title || "Untitled appointment"}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${activity.type === "creation" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                                {activity.type === "creation" ? "Created" : "Edited"}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${getAppointmentStatusColor(appt.appointment_status)}`}>
                                {appt.appointment_status || "Unknown"}
                              </Badge>
                            </div>
                          </div>
                          {activity.type === "edit" && activity.fieldName && (
                            <div className="bg-muted/50 rounded p-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-primary">
                                  {getFieldDisplayName(activity.fieldName)}
                                </span>
                                <span className="text-muted-foreground line-through">
                                  {formatFieldValue(activity.fieldName, activity.oldValue || null, users, profiles)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-foreground font-medium">
                                  {formatFieldValue(activity.fieldName, activity.newValue || null, users, profiles)}
                                </span>
                              </div>
                            </div>
                          )}
                          {/* View full history button */}
                          {(() => {
                            const allApptEdits = appointmentEditsMap.get(appt.ghl_id) || [];
                            if (allApptEdits.length > 0) {
                              const isExpanded = expandedHistory.has(`appt-${appt.ghl_id}`);
                              return (
                                <div className="mt-2">
                                  <button
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryExpanded(`appt-${appt.ghl_id}`);
                                    }}
                                  >
                                    <History className="h-3 w-3" />
                                    {isExpanded ? "Hide history" : `View full history (${allApptEdits.length} edits)`}
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 space-y-2 border-l-2 border-primary/30 pl-3">
                                      {allApptEdits.map((edit) => {
                                        const editorName = getCreatorName(edit.edited_by, profiles);
                                        return (
                                          <div key={edit.id} className="text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-primary">
                                                {getFieldDisplayName(edit.field_name)}:
                                              </span>
                                              <span className="text-muted-foreground line-through">
                                                {formatFieldValue(edit.field_name, edit.old_value, users, profiles)}
                                              </span>
                                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <span className="text-foreground font-medium">
                                                {formatFieldValue(edit.field_name, edit.new_value, users, profiles)}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 mt-0.5">
                                              <span>{formatDate(edit.edited_at)}</span>
                                              {editorName && <span>By: {editorName}</span>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{getUserName(appt.assigned_user_id, users)}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground/70">
                              {appt.start_time ? `Scheduled: ${formatDate(appt.start_time)}` : "No date"}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                            <span>{formatDate(activity.date)}</span>
                            {actorName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {activity.type === "creation" ? "Created by" : "Edited by"}: {actorName}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pr-4">
                {taskActivityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    {creatorFilter !== "all" 
                      ? "No task activity by this creator" 
                      : "No task activity in this period"}
                  </p>
                ) : (
                  taskActivityItems.map(({ task, activity }) => {
                    const contact = contacts.find(c => c.ghl_id === task.contact_id);
                    const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                    const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                    const relatedOpp = editedOpportunities.find(o => o.contact_id === task.contact_id) 
                      || allOpportunities.find(o => o.contact_id === task.contact_id);
                    const actorName = getCreatorName(activity.editedBy, profiles);
                    return (
                      <Card 
                        key={activity.id} 
                        className={`border-border/50 ${relatedOpp && (onTaskClick || onOpportunityClick) ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                        onClick={() => {
                          if (relatedOpp) {
                            if (onTaskClick) {
                              onTaskClick(relatedOpp, task);
                            } else {
                              onOpportunityClick?.(relatedOpp);
                            }
                          }
                        }}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate capitalize">
                                {getContactName(contact)}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address || "No address"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span className="truncate">{scopeOfWork || "No scope"}</span>
                                {relatedOpp && (
                                  <span className="shrink-0 font-semibold text-emerald-400">
                                    {formatCurrency(relatedOpp.monetary_value)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${activity.type === "creation" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                                {activity.type === "creation" ? "Created" : "Edited"}
                              </Badge>
                              <Badge variant={task.completed ? "default" : "secondary"} className="text-[10px]">
                                {task.completed ? "Done" : "Pending"}
                              </Badge>
                            </div>
                          </div>
                          <div className="bg-muted/50 rounded p-2 mt-2">
                            <p className="text-xs font-medium">{task.title}</p>
                            {activity.type === "edit" && activity.fieldName && (
                              <div className="flex items-center gap-2 text-xs mt-1">
                                <span className="font-medium text-primary">
                                  {getFieldDisplayName(activity.fieldName)}:
                                </span>
                                <span className="text-muted-foreground line-through">
                                  {formatFieldValue(activity.fieldName, activity.oldValue || null, users, profiles)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-foreground font-medium">
                                  {formatFieldValue(activity.fieldName, activity.newValue || null, users, profiles)}
                                </span>
                              </div>
                            )}
                            {activity.type === "creation" && task.body && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{stripHtml(task.body)}</p>
                            )}
                          </div>
                          {/* View full history button */}
                          {(() => {
                            const allTaskEdits = taskEditsMap.get(task.ghl_id) || [];
                            if (allTaskEdits.length > 0) {
                              const isExpanded = expandedHistory.has(`task-${task.ghl_id}`);
                              return (
                                <div className="mt-2">
                                  <button
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryExpanded(`task-${task.ghl_id}`);
                                    }}
                                  >
                                    <History className="h-3 w-3" />
                                    {isExpanded ? "Hide history" : `View full history (${allTaskEdits.length} edits)`}
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 space-y-2 border-l-2 border-primary/30 pl-3">
                                      {allTaskEdits.map((edit, idx) => {
                                        const editorName = getCreatorName(edit.edited_by, profiles);
                                        return (
                                          <div key={edit.id} className="text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-primary">
                                                {getFieldDisplayName(edit.field_name)}:
                                              </span>
                                              <span className="text-muted-foreground line-through">
                                                {formatFieldValue(edit.field_name, edit.old_value, users, profiles)}
                                              </span>
                                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <span className="text-foreground font-medium">
                                                {formatFieldValue(edit.field_name, edit.new_value, users, profiles)}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 mt-0.5">
                                              <span>{formatDate(edit.edited_at)}</span>
                                              {editorName && <span>By: {editorName}</span>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{getUserName(task.assigned_to, users)}</span>
                            </div>
                            {task.due_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Due: {formatDate(task.due_date)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                            <span>{formatDate(activity.date)}</span>
                            {actorName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {activity.type === "creation" ? "Created by" : "Edited by"}: {actorName}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pr-4">
                {noteActivityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    {creatorFilter !== "all" 
                      ? "No note activity by this creator" 
                      : "No note activity in this period"}
                  </p>
                ) : (
                  noteActivityItems.map(({ note, activity }) => {
                    const contact = contacts.find(c => c.ghl_id === note.contact_id);
                    const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                    const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                    const relatedOpp = editedOpportunities.find(o => o.contact_id === note.contact_id)
                      || allOpportunities.find(o => o.contact_id === note.contact_id);
                    const actorName = getCreatorName(activity.editedBy, profiles);
                    return (
                      <Card 
                        key={activity.id} 
                        className={`border-border/50 ${relatedOpp && onOpportunityClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                        onClick={() => relatedOpp && onOpportunityClick?.(relatedOpp)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate capitalize">
                                {getContactName(contact)}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{address || "No address"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span className="truncate">{scopeOfWork || "No scope"}</span>
                                {relatedOpp && (
                                  <span className="shrink-0 font-semibold text-emerald-400">
                                    {formatCurrency(relatedOpp.monetary_value)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${activity.type === "creation" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                              {activity.type === "creation" ? "Created" : "Edited"}
                            </Badge>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            {activity.type === "edit" && activity.fieldName && (
                              <div className="flex items-center gap-2 text-xs mb-1">
                                <span className="font-medium text-primary">
                                  {getFieldDisplayName(activity.fieldName)}:
                                </span>
                                <span className="text-muted-foreground line-through truncate max-w-[100px]">
                                  {formatFieldValue(activity.fieldName, activity.oldValue || null, users, profiles)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-foreground font-medium truncate max-w-[100px]">
                                  {formatFieldValue(activity.fieldName, activity.newValue || null, users, profiles)}
                                </span>
                              </div>
                            )}
                            {activity.type === "creation" && (
                              <>
                                <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${expandedNotes.has(activity.id) ? '' : 'line-clamp-4'}`}>
                                  {stripHtml(note.body) || "(No content)"}
                                </p>
                                {stripHtml(note.body)?.length > 200 && (
                                  <div 
                                    className="flex items-center justify-center mt-2 text-xs text-primary cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNoteExpanded(activity.id);
                                    }}
                                  >
                                    {expandedNotes.has(activity.id) ? (
                                      <>
                                        <ChevronUp className="h-3 w-3 mr-1" />
                                        Show less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Show more
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {/* View full history button */}
                          {(() => {
                            const allNoteEdits = noteEditsMap.get(note.ghl_id) || [];
                            if (allNoteEdits.length > 0) {
                              const isExpanded = expandedHistory.has(`note-${note.ghl_id}`);
                              return (
                                <div className="mt-2">
                                  <button
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryExpanded(`note-${note.ghl_id}`);
                                    }}
                                  >
                                    <History className="h-3 w-3" />
                                    {isExpanded ? "Hide history" : `View full history (${allNoteEdits.length} edits)`}
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 space-y-2 border-l-2 border-primary/30 pl-3">
                                      {allNoteEdits.map((edit) => {
                                        const editorName = getCreatorName(edit.edited_by, profiles);
                                        return (
                                          <div key={edit.id} className="text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-primary">
                                                {getFieldDisplayName(edit.field_name)}:
                                              </span>
                                              <span className="text-muted-foreground line-through truncate max-w-[80px]">
                                                {formatFieldValue(edit.field_name, edit.old_value, users, profiles)}
                                              </span>
                                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <span className="text-foreground font-medium truncate max-w-[80px]">
                                                {formatFieldValue(edit.field_name, edit.new_value, users, profiles)}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 mt-0.5">
                                              <span>{formatDate(edit.edited_at)}</span>
                                              {editorName && <span>By: {editorName}</span>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                            <span>{formatDate(activity.date)}</span>
                            {actorName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {activity.type === "creation" ? "Created by" : "Edited by"}: {actorName}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
