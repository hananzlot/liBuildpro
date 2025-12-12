import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, FileText, User, Calendar, MapPin, History, ArrowRight, Clock, ChevronDown, ChevronUp } from "lucide-react";

import type { DBOpportunityEdit } from "@/hooks/useGHLContacts";

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
}

interface DBContactNote {
  id: string;
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
  user_id: string | null;
  entered_by: string | null;
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

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedOpportunities: DBOpportunity[];
  filteredAppointments: DBAppointment[];
  filteredTasks: DBTask[];
  filteredNotes: DBContactNote[];
  filteredOpportunityEdits: DBOpportunityEdit[];
  contacts: DBContact[];
  users: DBUser[];
  profiles: DBProfile[];
  onOpportunityClick?: (opportunity: DBOpportunity) => void;
  onAppointmentClick?: (appointment: DBAppointment) => void;
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
    address: "Address",
    scope_of_work: "Scope of Work",
    source: "Source",
    phone: "Phone",
  };
  return fieldNames[fieldName] || fieldName;
};

const formatFieldValue = (fieldName: string, value: string | null, users: DBUser[]): string => {
  if (!value) return "(empty)";
  
  if (fieldName === "monetary_value") {
    const num = parseFloat(value);
    return isNaN(num) ? value : formatCurrency(num);
  }
  
  if (fieldName === "assigned_to") {
    return getUserName(value, users);
  }
  
  return value;
};

export function ActivitySheet({
  open,
  onOpenChange,
  editedOpportunities,
  filteredAppointments,
  filteredTasks,
  filteredNotes,
  filteredOpportunityEdits,
  contacts,
  users,
  profiles,
  onOpportunityClick,
  onAppointmentClick,
  defaultTab = "edits",
}: ActivitySheetProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

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

  // Sync activeTab when defaultTab changes (from parent)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Get unique creators from tasks, notes, and edits
  const availableCreators = useMemo(() => {
    const creatorIds = new Set<string>();
    filteredTasks.forEach(t => { if (t.entered_by) creatorIds.add(t.entered_by); });
    filteredNotes.forEach(n => { if (n.entered_by) creatorIds.add(n.entered_by); });
    filteredOpportunityEdits.forEach(e => { if (e.edited_by) creatorIds.add(e.edited_by); });
    return profiles.filter(p => creatorIds.has(p.id));
  }, [filteredTasks, filteredNotes, filteredOpportunityEdits, profiles]);

  // Filter tasks, notes, and edits by creator
  const displayedTasks = useMemo(() => {
    if (creatorFilter === "all") return filteredTasks;
    return filteredTasks.filter(t => t.entered_by === creatorFilter);
  }, [filteredTasks, creatorFilter]);

  const displayedNotes = useMemo(() => {
    if (creatorFilter === "all") return filteredNotes;
    return filteredNotes.filter(n => n.entered_by === creatorFilter);
  }, [filteredNotes, creatorFilter]);

  const displayedEdits = useMemo(() => {
    if (creatorFilter === "all") return filteredOpportunityEdits;
    return filteredOpportunityEdits.filter(e => e.edited_by === creatorFilter);
  }, [filteredOpportunityEdits, creatorFilter]);

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

  const totalActivity = editedOpportunities.length + displayedTasks.length + displayedNotes.length + displayedEdits.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              Activity in Date Range
              <Badge variant="secondary" className="text-sm">
                {totalActivity} items
              </Badge>
            </SheetTitle>
          </div>
          {availableCreators.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Filter by creator:</span>
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
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
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="edits" className="gap-1 text-xs">
              <History className="h-3 w-3" />
              Edits ({displayedEdits.length})
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Appts ({filteredAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 text-xs">
              <CheckSquare className="h-3 w-3" />
              Tasks ({displayedTasks.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
              Notes ({displayedNotes.length})
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
                                      {formatFieldValue(edit.field_name, edit.old_value, users)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-foreground font-medium">
                                      {formatFieldValue(edit.field_name, edit.new_value, users)}
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
                {filteredAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No appointments updated in this period
                  </p>
                ) : (
                  filteredAppointments
                    .sort((a, b) => {
                      const dateA = a.ghl_date_updated || a.updated_at || '0';
                      const dateB = b.ghl_date_updated || b.updated_at || '0';
                      return new Date(dateB).getTime() - new Date(dateA).getTime();
                    })
                    .map((appt) => {
                      const contact = contacts.find(c => c.ghl_id === appt.contact_id);
                      const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                      return (
                        <Card 
                          key={appt.id} 
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
                                <Badge variant="outline" className={`text-[10px] ${getAppointmentStatusColor(appt.appointment_status)}`}>
                                  {appt.appointment_status || "Unknown"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{getUserName(appt.assigned_user_id, users)}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground/70">
                                {appt.start_time ? `Scheduled: ${formatDate(appt.start_time)}` : "No date"}
                              </div>
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
                {displayedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    {creatorFilter !== "all" ? "No tasks by this creator" : "No tasks created in this period"}
                  </p>
                ) : (
                  displayedTasks
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((task) => {
                      const contact = contacts.find(c => c.ghl_id === task.contact_id);
                      const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                      const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                      // Find opportunity for this contact to get value
                      const relatedOpp = editedOpportunities.find(o => o.contact_id === task.contact_id);
                      return (
                        <Card 
                          key={task.id} 
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
                              <Badge variant={task.completed ? "default" : "secondary"} className="text-[10px] shrink-0">
                                {task.completed ? "Done" : "Pending"}
                              </Badge>
                            </div>
                            <div className="bg-muted/50 rounded p-2 mt-2">
                              <p className="text-xs font-medium">{task.title}</p>
                              {task.body && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.body}</p>
                              )}
                            </div>
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
                              <span>Created: {formatDate(task.created_at)}</span>
                              {getCreatorName(task.entered_by, profiles) && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  By: {getCreatorName(task.entered_by, profiles)}
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
                {displayedNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    {creatorFilter !== "all" ? "No notes by this creator" : "No notes created in this period"}
                  </p>
                ) : (
                  displayedNotes
                    .sort((a, b) => new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime())
                    .map((note) => {
                      const contact = contacts.find(c => c.ghl_id === note.contact_id);
                      const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                      const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                      // Find opportunity for this contact to get value and for click navigation
                      const relatedOpp = editedOpportunities.find(o => o.contact_id === note.contact_id);
                      // Prefer entered_by (app user) over user_id (GHL user)
                      const creatorName = getCreatorName(note.entered_by, profiles);
                      const displayUserName = creatorName || getUserName(note.user_id, users);
                      return (
                        <Card 
                          key={note.id} 
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
                              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <User className="h-3 w-3" />
                                <span>{displayUserName}</span>
                              </div>
                            </div>
                            <div 
                              className="bg-muted/50 rounded p-2 cursor-pointer hover:bg-muted/70 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNoteExpanded(note.id);
                              }}
                            >
                              <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${expandedNotes.has(note.id) ? '' : 'line-clamp-4'}`}>
                                {stripHtml(note.body) || "(No content)"}
                              </p>
                              {stripHtml(note.body)?.length > 200 && (
                                <div className="flex items-center justify-center mt-2 text-xs text-primary">
                                  {expandedNotes.has(note.id) ? (
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
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                              <span>Added: {formatDate(note.ghl_date_added)}</span>
                              {creatorName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                By: {creatorName}
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
