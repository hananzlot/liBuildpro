import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Building2, 
  User, 
  DollarSign, 
  CheckSquare, 
  MessageSquare,
  Star,
  AlertCircle,
  Loader2,
  FolderOpen
} from "lucide-react";
import { FinanceSection } from "./FinanceSection";
import { DocumentsSection } from "./DocumentsSection";

interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  cell_phone: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  estimated_cost: number | null;
  total_pl: number | null;
  created_at: string;
  opportunity_id: string | null;
  location_id: string;
}

interface ProjectDetailSheetProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusColors: Record<string, string> = {
  "New Job": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In-Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "On-Hold": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Completed": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Cancelled": "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ProjectDetailSheet({ project, open, onOpenChange, onUpdate }: ProjectDetailSheetProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch full project details
  const { data: fullProject, isLoading } = useQuery({
    queryKey: ["project-detail", project?.id],
    queryFn: async () => {
      if (!project?.id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Fetch related data
  const { data: checklists = [] } = useQuery({
    queryKey: ["project-checklists", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("project_checklists")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["project-messages", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  const { data: feedback } = useQuery({
    queryKey: ["project-feedback", project?.id],
    queryFn: async () => {
      if (!project?.id) return null;
      const { data, error } = await supabase
        .from("project_feedback")
        .select("*")
        .eq("project_id", project.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!project?.id && open,
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (updates: Partial<typeof fullProject>) => {
      if (!project?.id) throw new Error("No project selected");
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project updated");
      queryClient.invalidateQueries({ queryKey: ["project-detail", project?.id] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Toggle checklist item
  const toggleChecklistMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("project_checklists")
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
  });

  if (!project) return null;

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "";
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");
    // Format as (XXX) XXX-XXXX if 10 digits, or +1 (XXX) XXX-XXXX if 11 digits starting with 1
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone; // Return original if doesn't match expected format
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const PROJECT_TYPES = [
    "Bathroom",
    "Kitchen", 
    "Backyard",
    "Pool",
    "ADU",
    "Full Remodel",
    "Room Addition",
    "Roofing",
    "Flooring",
    "Painting",
    "Landscaping",
    "HVAC",
    "Plumbing",
    "Electrical",
    "Windows & Doors",
    "Other"
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                #{project.project_number} - {project.project_name}
              </SheetTitle>
              <SheetDescription>
                {project.customer_first_name} {project.customer_last_name}
              </SheetDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`w-fit ${statusColors[fullProject?.project_status || project.project_status || "New Job"] || ""}`}
          >
            {fullProject?.project_status || project.project_status || "New Job"}
          </Badge>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FolderOpen className="h-3 w-3 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs">
              <CheckSquare className="h-3 w-3 mr-1" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              Feedback
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Project Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Project Name</Label>
                        <Input 
                          value={fullProject?.project_name || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ project_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select 
                          value={fullProject?.project_status || "New Job"}
                          onValueChange={(value) => updateProjectMutation.mutate({ project_status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="New Job">New Job</SelectItem>
                            <SelectItem value="In-Progress">In-Progress</SelectItem>
                            <SelectItem value="On-Hold">On-Hold</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Project Address</Label>
                      <Input 
                        value={fullProject?.project_address || ""} 
                        onChange={(e) => updateProjectMutation.mutate({ project_address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Project Type</Label>
                        <Select 
                          value={fullProject?.project_type || ""}
                          onValueChange={(value) => updateProjectMutation.mutate({ project_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {PROJECT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Project Manager</Label>
                        <Input 
                          value={fullProject?.project_manager || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ project_manager: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>First Name</Label>
                        <Input 
                          value={fullProject?.customer_first_name || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ customer_first_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Last Name</Label>
                        <Input 
                          value={fullProject?.customer_last_name || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ customer_last_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Cell Phone</Label>
                        <Input 
                          value={formatPhoneNumber(fullProject?.cell_phone)} 
                          onChange={(e) => updateProjectMutation.mutate({ cell_phone: e.target.value.replace(/\D/g, "") })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input 
                          value={fullProject?.customer_email || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ customer_email: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Salesperson Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sales Team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Primary Salesperson</Label>
                        <Input 
                          value={fullProject?.primary_salesperson || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ primary_salesperson: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Commission %</Label>
                        <Input 
                          type="number"
                          value={fullProject?.primary_commission_pct || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ primary_commission_pct: e.target.value ? Number(e.target.value) : null })}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Secondary Salesperson</Label>
                        <Input 
                          value={fullProject?.secondary_salesperson || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ secondary_salesperson: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Commission %</Label>
                        <Input 
                          type="number"
                          value={fullProject?.secondary_commission_pct || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ secondary_commission_pct: e.target.value ? Number(e.target.value) : null })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tertiary Salesperson</Label>
                        <Input 
                          value={fullProject?.tertiary_salesperson || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ tertiary_salesperson: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Commission %</Label>
                        <Input 
                          type="number"
                          value={fullProject?.tertiary_commission_pct || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ tertiary_commission_pct: e.target.value ? Number(e.target.value) : null })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Quaternary Salesperson</Label>
                        <Input 
                          value={fullProject?.quaternary_salesperson || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ quaternary_salesperson: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Commission %</Label>
                        <Input 
                          type="number"
                          value={fullProject?.quaternary_commission_pct || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ quaternary_commission_pct: e.target.value ? Number(e.target.value) : null })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Install Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Installation Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Install Status</Label>
                        <Select 
                          value={fullProject?.install_status || "New Job"}
                          onValueChange={(value) => updateProjectMutation.mutate({ install_status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="New Job">New Job</SelectItem>
                            <SelectItem value="Scheduled">Scheduled</SelectItem>
                            <SelectItem value="In-Progress">In-Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Install Start Date</Label>
                        <Input 
                          type="date"
                          value={fullProject?.install_start_date || ""} 
                          onChange={(e) => updateProjectMutation.mutate({ install_start_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Install Notes</Label>
                      <Textarea 
                        value={fullProject?.install_notes || ""} 
                        onChange={(e) => updateProjectMutation.mutate({ install_notes: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="mt-4">
            {fullProject && (
              <FinanceSection
                projectId={project.id}
                estimatedCost={fullProject.estimated_cost}
                totalPl={fullProject.total_pl}
                onUpdateProject={(updates) => updateProjectMutation.mutate(updates)}
              />
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <DocumentsSection projectId={project.id} />
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Office Checklist
                </CardTitle>
                <CardDescription>
                  {checklists.filter(c => c.completed).length} of {checklists.length} completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No checklist items yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {checklists.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                        <Checkbox 
                          checked={item.completed}
                          onCheckedChange={(checked) => 
                            toggleChecklistMutation.mutate({ id: item.id, completed: !!checked })
                          }
                        />
                        <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                          {item.item}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Customer Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedback ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Satisfaction Rating</Label>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Star 
                            key={rating}
                            className={`h-5 w-5 ${
                              rating <= (feedback.satisfaction_rank || 0) 
                                ? "fill-amber-500 text-amber-500" 
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {feedback.customer_feedback && (
                      <div>
                        <Label>Customer Comments</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded">
                          {feedback.customer_feedback}
                        </p>
                      </div>
                    )}
                    {feedback.online_review_given && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                          Online Review Given
                        </Badge>
                        {feedback.review_location && (
                          <span className="text-sm text-muted-foreground">
                            on {feedback.review_location}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No feedback recorded yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Project Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-3 bg-muted rounded">
                        {msg.is_alert && (
                          <Badge variant="destructive" className="mb-2">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Alert
                          </Badge>
                        )}
                        {msg.subject && (
                          <p className="font-medium text-sm">{msg.subject}</p>
                        )}
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
