import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Check, Clock, User, Building, Phone, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  opportunity_id: string;
  ghl_id: string | null;
  created_at: string;
}

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  contact_id: string | null;
  monetary_value: number | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  custom_fields: any;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface TasksTrackerProps {
  tasks: Task[];
  opportunities: Opportunity[];
  contacts: Contact[];
  users: GHLUser[];
  onTaskUpdated: () => void;
}

// Calculate PST/PDT offset for a given UTC date
const getPSTOffset = (utcDate: Date): number => {
  // DST in US: second Sunday of March to first Sunday of November
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10)); // 2 AM PST = 10 AM UTC
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9)); // 2 AM PDT = 9 AM UTC
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8; // PDT is UTC-7, PST is UTC-8
};

export const TasksTracker = ({ tasks, opportunities, contacts, users, onTaskUpdated }: TasksTrackerProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const getOpportunity = (opportunityId: string) => {
    return opportunities.find(o => o.ghl_id === opportunityId || o.id === opportunityId);
  };

  const getContact = (contactId: string | null) => {
    if (!contactId) return null;
    return contacts.find(c => c.ghl_id === contactId);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.ghl_id === userId);
    if (user) {
      return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || "Unknown";
    }
    return "Unknown";
  };

  const getAddress = (contact: Contact | null) => {
    if (!contact?.custom_fields) return null;
    const fields = Array.isArray(contact.custom_fields) ? contact.custom_fields : [];
    const addressField = fields.find((f: any) => f.id === "b7oTVsUQrLgZt84bHpCn");
    return addressField?.value || null;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const utcDate = new Date(dueDate);
    const pstOffset = getPSTOffset(utcDate);
    const pstDate = new Date(utcDate.getTime() - pstOffset * 60 * 60 * 1000);
    return format(pstDate, "MMM d, yyyy 'at' h:mm a") + " PST";
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const uniqueAssignees = useMemo(() => {
    const assigneeIds = new Set(tasks.map(t => t.assigned_to).filter(Boolean));
    return Array.from(assigneeIds).map(id => ({
      id: id!,
      name: getUserName(id!)
    }));
  }, [tasks, users]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && task.assigned_to !== assigneeFilter) return false;
      return true;
    }).sort((a, b) => {
      // Sort by due date, earliest first, nulls last
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks, statusFilter, assigneeFilter]);

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (error) throw error;

      // Sync to GHL if we have a ghl_id
      if (task.ghl_id && task.contact_id) {
        try {
          await supabase.functions.invoke("update-ghl-task", {
            body: {
              contactId: task.contact_id,
              taskId: task.ghl_id,
              completed: newStatus === "completed"
            }
          });
        } catch (ghlError) {
          console.error("Failed to sync status to GHL:", ghlError);
        }
      }

      toast.success(`Task marked as ${newStatus}`);
      onTaskUpdated();
    } catch (err) {
      toast.error("Failed to update task status");
      console.error(err);
    }
  };

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Task Tracker</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingCount} pending · {completedCount} completed
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {uniqueAssignees.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tasks found matching filters
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const opportunity = getOpportunity(task.opportunity_id);
              const contact = getContact(opportunity?.contact_id || task.contact_id);
              const isExpanded = expandedTasks.has(task.id);
              const overdue = task.status === "pending" && isOverdue(task.due_date);

              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    task.status === "completed" 
                      ? "bg-muted/30 border-border/30" 
                      : overdue 
                        ? "bg-destructive/5 border-destructive/30"
                        : "bg-card border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => handleToggleStatus(task)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        {overdue && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                        {task.status === "completed" && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Done
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDueDate(task.due_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getUserName(task.assigned_to)}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          {task.notes}
                        </p>
                      )}
                      
                      {/* Expandable Opportunity Details */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => toggleExpanded(task.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show Opportunity Details
                          </>
                        )}
                      </Button>

                      {isExpanded && opportunity && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-2 text-sm">
                          <div className="font-medium">{opportunity.name || "Unnamed Opportunity"}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                            <div>
                              <span className="text-xs uppercase tracking-wide">Value</span>
                              <div className="font-medium text-foreground">{formatCurrency(opportunity.monetary_value)}</div>
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-wide">Stage</span>
                              <div className="font-medium text-foreground">{opportunity.stage_name || "N/A"}</div>
                            </div>
                            {opportunity.pipeline_name && (
                              <div className="sm:col-span-2">
                                <span className="text-xs uppercase tracking-wide">Pipeline</span>
                                <div className="font-medium text-foreground">{opportunity.pipeline_name}</div>
                              </div>
                            )}
                          </div>
                          
                          {contact && (
                            <div className="pt-2 border-t border-border/50">
                              <div className="font-medium mb-1">
                                {contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || "Unknown Contact"}
                              </div>
                              <div className="space-y-1 text-muted-foreground">
                                {contact.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </div>
                                )}
                                {contact.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {contact.email}
                                  </div>
                                )}
                                {getAddress(contact) && (
                                  <div className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {getAddress(contact)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
