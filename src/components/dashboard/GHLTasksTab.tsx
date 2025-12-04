import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Clock, User, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GHLTask {
  id: string;
  title: string;
  body: string | null;
  dueDate: string | null;
  completed: boolean;
  contactId: string;
  assignedTo?: string;
}

interface Opportunity {
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
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface GHLTasksTabProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  users: GHLUser[];
  onOpenOpportunity: (opportunity: Opportunity) => void;
}

// Calculate PST/PDT offset for a given UTC date
const getPSTOffset = (utcDate: Date): number => {
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10));
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9));
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8;
};

export const GHLTasksTab = ({ opportunities, contacts, users, onOpenOpportunity }: GHLTasksTabProps) => {
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-all-ghl-tasks');
      
      if (error) {
        console.error('Error fetching GHL tasks:', error);
        toast.error('Failed to fetch tasks from GHL');
        return;
      }
      
      if (data?.tasks) {
        setTasks(data.tasks);
        toast.success(`Loaded ${data.tasks.length} tasks from GHL`);
      }
    } catch (err) {
      console.error('Failed to fetch GHL tasks:', err);
      toast.error('Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const getUserName = (userId: string | undefined) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.ghl_id === userId);
    if (user) {
      return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || "Unknown";
    }
    return "Unknown";
  };

  const getContactName = (contactId: string) => {
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (contact) {
      return contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || "Unknown";
    }
    return "Unknown Contact";
  };

  const getOpportunityForContact = (contactId: string) => {
    return opportunities.find(o => o.contact_id === contactId);
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

  // Get unique assignees from tasks
  const uniqueAssignees = useMemo(() => {
    const assigneeIds = new Set(tasks.map(t => t.assignedTo).filter(Boolean));
    return Array.from(assigneeIds).map(id => ({
      id: id!,
      name: getUserName(id!)
    }));
  }, [tasks, users]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.completed);
    
    if (assigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assignedTo === assigneeFilter);
    }
    
    // Sort by due date, earliest first, nulls last
    return filtered.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, assigneeFilter]);

  const handleTaskClick = (task: GHLTask) => {
    const opportunity = getOpportunityForContact(task.contactId);
    if (opportunity) {
      onOpenOpportunity(opportunity);
    } else {
      toast.error("No opportunity found for this contact");
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">GHL Tasks (Live)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredTasks.length} pending tasks from GoHighLevel
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchTasks} 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
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
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading tasks from GHL...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending tasks found
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const overdue = isOverdue(task.dueDate);
              const contactName = getContactName(task.contactId);
              const opportunity = getOpportunityForContact(task.contactId);

              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                    overdue 
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-card border-border/50"
                  }`}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{task.title}</span>
                        {overdue && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDueDate(task.dueDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getUserName(task.assignedTo)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Contact:</span>{" "}
                        <span className="font-medium">{contactName}</span>
                        {opportunity && (
                          <>
                            <span className="text-muted-foreground ml-3">Opp:</span>{" "}
                            <span className="font-medium">{opportunity.name || "Unnamed"}</span>
                          </>
                        )}
                      </div>
                      {task.body && (
                        <p className="text-sm text-muted-foreground mt-2 italic line-clamp-2">
                          {task.body}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
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
