import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, CheckSquare, FileText, User, Calendar, MapPin } from "lucide-react";

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
}

interface DBContactNote {
  id: string;
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
  user_id: string | null;
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
  filteredTasks: DBTask[];
  filteredNotes: DBContactNote[];
  contacts: DBContact[];
  users: DBUser[];
  onOpportunityClick?: (opportunity: DBOpportunity) => void;
}

const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
};

const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: { id: string }) => f.id === fieldId);
  return field?.value || null;
};

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

export function ActivitySheet({
  open,
  onOpenChange,
  editedOpportunities,
  filteredTasks,
  filteredNotes,
  contacts,
  users,
  onOpportunityClick,
}: ActivitySheetProps) {
  const totalActivity = editedOpportunities.length + filteredTasks.length + filteredNotes.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            Activity in Date Range
            <Badge variant="secondary" className="text-sm">
              {totalActivity} items
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="opportunities" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="opportunities" className="gap-1 text-xs">
              <DollarSign className="h-3 w-3" />
              Opps ({editedOpportunities.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 text-xs">
              <CheckSquare className="h-3 w-3" />
              Tasks ({filteredTasks.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
              Notes ({filteredNotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pr-4">
                {editedOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No opportunities updated in this period
                  </p>
                ) : (
                  editedOpportunities
                    .sort((a, b) => new Date(b.ghl_date_updated || 0).getTime() - new Date(a.ghl_date_updated || 0).getTime())
                    .map((opp) => {
                      const contact = contacts.find(c => c.ghl_id === opp.contact_id);
                      const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                      return (
                        <Card 
                          key={opp.id} 
                          className={`border-border/50 ${onOpportunityClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                          onClick={() => onOpportunityClick?.(opp)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate capitalize">
                                  {opp.name?.toLowerCase() || "Unnamed"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getContactName(contact)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="font-semibold text-emerald-400 text-sm">
                                  {formatCurrency(opp.monetary_value)}
                                </span>
                                <Badge variant="outline" className={`text-[10px] ${getStatusColor(opp.status)}`}>
                                  {opp.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{address || "No address"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{getUserName(opp.assigned_to, users)}</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground/70">
                              Updated: {formatDate(opp.ghl_date_updated)}
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
                {filteredTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No tasks created in this period
                  </p>
                ) : (
                  filteredTasks
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((task) => {
                      const contact = contacts.find(c => c.ghl_id === task.contact_id);
                      return (
                        <Card key={task.id} className="border-border/50">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{task.title}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getContactName(contact)}
                                </p>
                              </div>
                              <Badge variant={task.completed ? "default" : "secondary"} className="text-[10px] shrink-0">
                                {task.completed ? "Done" : "Pending"}
                              </Badge>
                            </div>
                            {task.body && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{task.body}</p>
                            )}
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
                            <div className="text-[10px] text-muted-foreground/70">
                              Created: {formatDate(task.created_at)}
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
                {filteredNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">
                    No notes created in this period
                  </p>
                ) : (
                  filteredNotes
                    .sort((a, b) => new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime())
                    .map((note) => {
                      const contact = contacts.find(c => c.ghl_id === note.contact_id);
                      return (
                        <Card key={note.id} className="border-border/50">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm">{getContactName(contact)}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <User className="h-3 w-3" />
                                <span>{getUserName(note.user_id, users)}</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                              {note.body || "(No content)"}
                            </p>
                            <div className="text-[10px] text-muted-foreground/70">
                              Added: {formatDate(note.ghl_date_added)}
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
