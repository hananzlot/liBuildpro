import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/hooks/useAuditLog";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { 
  Building2, 
  User, 
  DollarSign, 
  CheckSquare, 
  MessageSquare,
  Star,
  AlertCircle,
  Loader2,
  FolderOpen,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  Pencil,
  X
} from "lucide-react";
import { FinanceSection } from "./FinanceSection";
import { DocumentsSection } from "./DocumentsSection";
import { NotesSection } from "./NotesSection";
import { DebouncedInput, DebouncedTextarea, DebouncedNumberInput } from "@/components/ui/debounced-input";

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
  autoOpenBillDialog?: boolean;
  onBillDialogOpened?: () => void;
}

const statusColors: Record<string, string> = {
  "New Job": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In-Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "On-Hold": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Completed": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Cancelled": "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ProjectDetailSheet({ project, open, onOpenChange, onUpdate, autoOpenBillDialog, onBillDialogOpened }: ProjectDetailSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [newStatusValue, setNewStatusValue] = useState("");
  const [newTypeValue, setNewTypeValue] = useState("");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");

  // Auto-switch to finance tab and signal bill dialog open when returning from subcontractor add
  useEffect(() => {
    if (open && autoOpenBillDialog && project) {
      setActiveTab("finance");
      onBillDialogOpened?.();
    }
  }, [open, autoOpenBillDialog, project, onBillDialogOpened]);

  const handleNavigateToSubcontractors = useCallback(() => {
    onOpenChange(false); // Close the sheet first
    navigate(`/production?view=subcontractors&returnToProject=${project?.id}`);
  }, [navigate, onOpenChange, project?.id]);

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

  // Fetch unique salespeople names from all projects
  const { data: existingSalespeople = [] } = useQuery({
    queryKey: ["project-salespeople"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, project_manager");
      if (error) throw error;
      
      // Extract unique non-null names
      const names = new Set<string>();
      data.forEach((p) => {
        if (p.primary_salesperson) names.add(p.primary_salesperson);
        if (p.secondary_salesperson) names.add(p.secondary_salesperson);
        if (p.tertiary_salesperson) names.add(p.tertiary_salesperson);
        if (p.quaternary_salesperson) names.add(p.quaternary_salesperson);
        if (p.project_manager) names.add(p.project_manager);
      });
      
      return Array.from(names).sort();
    },
    enabled: open,
  });

  // State for combobox inputs
  const [managerSearch, setManagerSearch] = useState("");
  const [primarySearch, setPrimarySearch] = useState("");
  const [secondarySearch, setSecondarySearch] = useState("");
  const [tertiarySearch, setTertiarySearch] = useState("");
  const [quaternarySearch, setQuaternarySearch] = useState("");

  // Calculate total commission percentage
  const totalCommission = (fullProject?.primary_commission_pct || 0) + 
    (fullProject?.secondary_commission_pct || 0) + 
    (fullProject?.tertiary_commission_pct || 0) + 
    (fullProject?.quaternary_commission_pct || 0);

  // Helper to validate and update commission
  const updateCommission = (field: string, value: string, otherCommissions: number) => {
    const newValue = value ? Number(value) : 0;
    const newTotal = newValue + otherCommissions;
    
    if (newTotal > 100) {
      toast.error(`Total commission cannot exceed 100%. Current total would be ${newTotal}%`);
      return;
    }
    
    updateProjectMutation.mutate({ [field]: value ? Number(value) : null });
  };

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: Partial<typeof fullProject>) => {
      if (!project?.id) throw new Error("No project selected");
      
      // Log audit before update
      await logAudit({
        tableName: 'projects',
        recordId: project.id,
        action: 'UPDATE',
        oldValues: fullProject,
        newValues: updates,
        description: `Updated project #${project.project_number}`,
      });
      
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
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'UPDATE',
        oldValues: { completed: !completed },
        newValues: { completed },
        description: `${completed ? 'Completed' : 'Uncompleted'} checklist item`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? user?.id : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
  });

  // Add checklist item
  const addChecklistMutation = useMutation({
    mutationFn: async (item: string) => {
      if (!project?.id) throw new Error("No project");
      const { data, error } = await supabase
        .from("project_checklists")
        .insert({ project_id: project.id, item })
        .select()
        .single();
      if (error) throw error;
      await logAudit({
        tableName: 'project_checklists',
        recordId: data.id,
        action: 'INSERT',
        newValues: { item },
        description: `Added checklist item: ${item}`,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Checklist item added");
      setNewChecklistItem("");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update checklist item text
  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, item }: { id: string; item: string }) => {
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'UPDATE',
        newValues: { item },
        description: `Updated checklist item to: ${item}`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .update({ item })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item updated");
      setEditingChecklistId(null);
      setEditingChecklistText("");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Delete checklist item
  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      await logAudit({
        tableName: 'project_checklists',
        recordId: id,
        action: 'DELETE',
        description: `Deleted checklist item`,
      });
      const { error } = await supabase
        .from("project_checklists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["project-checklists", project?.id] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Fetch project statuses from database
  const { data: projectStatuses = [] } = useQuery({
    queryKey: ["project-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch project types from database
  const { data: projectTypes = [] } = useQuery({
    queryKey: ["project-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_types")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Add new status mutation
  const addStatusMutation = useMutation({
    mutationFn: async (name: string) => {
      const maxSort = projectStatuses.length > 0 
        ? Math.max(...projectStatuses.map(s => s.sort_order || 0)) 
        : 0;
      const { error } = await supabase
        .from("project_statuses")
        .insert({ name, sort_order: maxSort + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status added");
      setNewStatusValue("");
      queryClient.invalidateQueries({ queryKey: ["project-statuses"] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Add new type mutation
  const addTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      const maxSort = projectTypes.length > 0 
        ? Math.max(...projectTypes.map(t => t.sort_order || 0)) 
        : 0;
      const { error } = await supabase
        .from("project_types")
        .insert({ name, sort_order: maxSort + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Type added");
      setNewTypeValue("");
      queryClient.invalidateQueries({ queryKey: ["project-types"] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("project_statuses")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status renamed");
      setEditingStatusId(null);
      setEditingStatusName("");
      queryClient.invalidateQueries({ queryKey: ["project-statuses"] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Update type mutation
  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("project_types")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Type renamed");
      setEditingTypeId(null);
      setEditingTypeName("");
      queryClient.invalidateQueries({ queryKey: ["project-types"] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  if (!project) return null;

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl overflow-y-auto">
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
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium">Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={fullProject?.project_name || ""} 
                          onSave={(value) => updateProjectMutation.mutate({ project_name: value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Status</Label>
                        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.project_status || "New Job"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder={isSuperAdmin ? "Search or add..." : "Search..."} 
                                value={newStatusValue}
                                onValueChange={setNewStatusValue}
                              />
                              <CommandList>
                                <CommandEmpty>No status found.</CommandEmpty>
                                <CommandGroup>
                                  {isSuperAdmin && newStatusValue && !projectStatuses.some(s => s.name.toLowerCase() === newStatusValue.toLowerCase()) && (
                                    <CommandItem
                                      value={newStatusValue}
                                      onSelect={() => {
                                        addStatusMutation.mutate(newStatusValue);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{newStatusValue}"
                                    </CommandItem>
                                  )}
                                  {projectStatuses.map((status) => (
                                    <CommandItem
                                      key={status.id}
                                      value={status.name}
                                      onSelect={() => {
                                        if (editingStatusId !== status.id) {
                                          updateProjectMutation.mutate({ project_status: status.name });
                                          setStatusPopoverOpen(false);
                                          setNewStatusValue("");
                                        }
                                      }}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center">
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            fullProject?.project_status === status.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {editingStatusId === status.id ? (
                                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <Input
                                              value={editingStatusName}
                                              onChange={(e) => setEditingStatusName(e.target.value)}
                                              className="h-6 w-24 text-xs"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && editingStatusName.trim()) {
                                                  updateStatusMutation.mutate({ id: status.id, name: editingStatusName.trim() });
                                                } else if (e.key === 'Escape') {
                                                  setEditingStatusId(null);
                                                  setEditingStatusName("");
                                                }
                                              }}
                                            />
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (editingStatusName.trim()) {
                                                  updateStatusMutation.mutate({ id: status.id, name: editingStatusName.trim() });
                                                }
                                              }}
                                            >
                                              <Check className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingStatusId(null);
                                                setEditingStatusName("");
                                              }}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <span>{status.name}</span>
                                        )}
                                      </div>
                                      {isSuperAdmin && editingStatusId !== status.id && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-5 w-5 opacity-50 hover:opacity-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingStatusId(status.id);
                                            setEditingStatusName(status.name);
                                          }}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Start Date</Label>
                        <Input
                          className="h-8 text-xs"
                          type="date"
                          defaultValue={fullProject?.install_start_date ? fullProject.install_start_date.split('T')[0] : ""} 
                          key={fullProject?.install_start_date}
                          onBlur={(e) => {
                            const newValue = e.target.value || null;
                            const oldValue = fullProject?.install_start_date ? fullProject.install_start_date.split('T')[0] : null;
                            if (newValue !== oldValue) {
                              updateProjectMutation.mutate({ install_start_date: newValue });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Project Address</Label>
                      <DebouncedInput
                        className="h-8 text-xs"
                        value={fullProject?.project_address || ""} 
                        onSave={(value) => updateProjectMutation.mutate({ project_address: value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Type</Label>
                        <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              <span className="text-left flex-1 truncate">
                                {fullProject?.project_type 
                                  ? fullProject.project_type.split(',').map(t => t.trim()).filter(Boolean).join(', ')
                                  : "Select types..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0 z-50 bg-popover" align="start">
                            <Command className="flex flex-col">
                              <CommandInput 
                                placeholder={isSuperAdmin ? "Search or add..." : "Search..."} 
                                value={newTypeValue}
                                onValueChange={setNewTypeValue}
                              />
                              <ScrollArea
                                className="h-[260px]"
                                onWheelCapture={(e) => e.stopPropagation()}
                                onTouchMoveCapture={(e) => e.stopPropagation()}
                              >
                                <CommandList className="max-h-none overflow-visible">
                                  <CommandEmpty>No type found.</CommandEmpty>
                                  <CommandGroup>
                                    {isSuperAdmin && newTypeValue && !projectTypes.some(t => t.name.toLowerCase() === newTypeValue.toLowerCase()) && (
                                      <CommandItem
                                        value={`add-${newTypeValue}`}
                                        onSelect={() => {
                                          addTypeMutation.mutate(newTypeValue);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add "{newTypeValue}"
                                      </CommandItem>
                                    )}
                                    {projectTypes.map((type) => {
                                      const selectedTypes = (fullProject?.project_type || '').split(',').map(t => t.trim()).filter(Boolean);
                                      const isSelected = selectedTypes.includes(type.name);

                                      const toggleType = () => {
                                        if (editingTypeId === type.id) return;
                                        let newTypes: string[];
                                        if (isSelected) {
                                          newTypes = selectedTypes.filter(t => t !== type.name);
                                        } else {
                                          newTypes = [...selectedTypes, type.name];
                                        }
                                        updateProjectMutation.mutate({ project_type: newTypes.join(', ') || null });
                                      };

                                      return (
                                        <CommandItem
                                          key={type.id}
                                          value={type.name}
                                          onSelect={toggleType}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center">
                                            <Checkbox
                                              checked={isSelected}
                                              className="mr-2 h-4 w-4"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleType();
                                              }}
                                            />
                                            {editingTypeId === type.id ? (
                                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                  value={editingTypeName}
                                                  onChange={(e) => setEditingTypeName(e.target.value)}
                                                  className="h-6 w-24 text-xs"
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && editingTypeName.trim()) {
                                                      updateTypeMutation.mutate({ id: type.id, name: editingTypeName.trim() });
                                                    } else if (e.key === 'Escape') {
                                                      setEditingTypeId(null);
                                                      setEditingTypeName("");
                                                    }
                                                  }}
                                                />
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-5 w-5"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (editingTypeName.trim()) {
                                                      updateTypeMutation.mutate({ id: type.id, name: editingTypeName.trim() });
                                                    }
                                                  }}
                                                >
                                                  <Check className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-5 w-5"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTypeId(null);
                                                    setEditingTypeName("");
                                                  }}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <span>{type.name}</span>
                                            )}
                                          </div>
                                          {isSuperAdmin && editingTypeId !== type.id && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5 opacity-50 hover:opacity-100"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTypeId(type.id);
                                                setEditingTypeName(type.name);
                                              }}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </ScrollArea>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Project Manager</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.project_manager || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={managerSearch}
                                onValueChange={setManagerSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {managerSearch && !existingSalespeople.some(n => n.toLowerCase() === managerSearch.toLowerCase()) && (
                                    <CommandItem
                                      value={managerSearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ project_manager: managerSearch });
                                        setManagerSearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{managerSearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ project_manager: name });
                                        setManagerSearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.project_manager === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">First Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={fullProject?.customer_first_name || ""} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_first_name: value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Last Name</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={fullProject?.customer_last_name || ""} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_last_name: value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Cell Phone</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={formatPhoneNumber(fullProject?.cell_phone)} 
                          onSave={(value) => updateProjectMutation.mutate({ cell_phone: value.replace(/\D/g, "") })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Email</Label>
                        <DebouncedInput
                          className="h-8 text-xs"
                          value={fullProject?.customer_email || ""} 
                          onSave={(value) => updateProjectMutation.mutate({ customer_email: value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Salesperson Info */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium">Sales Team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {/* Lead Cost % and Commission Split % */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Lead Cost %</Label>
                        <DebouncedNumberInput
                          className={cn("h-8 text-xs", !isAdmin && "bg-muted")}
                          min={0}
                          max={100}
                          value={fullProject?.lead_cost_percent ?? 18} 
                          onSave={(value) => updateProjectMutation.mutate({ lead_cost_percent: value ?? 18 })}
                          placeholder="18"
                          disabled={!isAdmin}
                        />
                        <p className="text-[10px] text-muted-foreground">Admin only</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Commission Split %</Label>
                        <DebouncedNumberInput
                          className={cn("h-8 text-xs", !isAdmin && "bg-muted")}
                          min={0}
                          max={100}
                          value={fullProject?.commission_split_pct ?? 50} 
                          onSave={(value) => updateProjectMutation.mutate({ commission_split_pct: value ?? 50 })}
                          placeholder="50"
                          disabled={!isAdmin}
                        />
                        <p className="text-[10px] text-muted-foreground">Admin only</p>
                      </div>
                    </div>
                    {/* Primary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Primary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.primary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={primarySearch}
                                onValueChange={setPrimarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {primarySearch && !existingSalespeople.some(n => n.toLowerCase() === primarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={primarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ 
                                          primary_salesperson: primarySearch,
                                          project_manager: fullProject?.project_manager || primarySearch
                                        });
                                        setPrimarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{primarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ 
                                          primary_salesperson: name,
                                          project_manager: fullProject?.project_manager || name
                                        });
                                        setPrimarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.primary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.primary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'primary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    {/* Secondary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Secondary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.secondary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={secondarySearch}
                                onValueChange={setSecondarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {secondarySearch && !existingSalespeople.some(n => n.toLowerCase() === secondarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={secondarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ secondary_salesperson: secondarySearch });
                                        setSecondarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{secondarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ secondary_salesperson: name });
                                        setSecondarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.secondary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.secondary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'secondary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Tertiary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Tertiary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.tertiary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={tertiarySearch}
                                onValueChange={setTertiarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {tertiarySearch && !existingSalespeople.some(n => n.toLowerCase() === tertiarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={tertiarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ tertiary_salesperson: tertiarySearch });
                                        setTertiarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{tertiarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ tertiary_salesperson: name });
                                        setTertiarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.tertiary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.tertiary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'tertiary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.quaternary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Quaternary Salesperson Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Quaternary Salesperson</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs"
                            >
                              {fullProject?.quaternary_salesperson || "Select or add..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search or add new..." 
                                value={quaternarySearch}
                                onValueChange={setQuaternarySearch}
                              />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {quaternarySearch && !existingSalespeople.some(n => n.toLowerCase() === quaternarySearch.toLowerCase()) && (
                                    <CommandItem
                                      value={quaternarySearch}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ quaternary_salesperson: quaternarySearch });
                                        setQuaternarySearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{quaternarySearch}"
                                    </CommandItem>
                                  )}
                                  {existingSalespeople.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProjectMutation.mutate({ quaternary_salesperson: name });
                                        setQuaternarySearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          fullProject?.quaternary_salesperson === name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Comm %</Label>
                        <DebouncedNumberInput
                          className="h-8 text-xs"
                          min={0}
                          max={100}
                          value={fullProject?.quaternary_commission_pct} 
                          onSave={(value) => updateCommission(
                            'quaternary_commission_pct', 
                            value?.toString() || '',
                            (fullProject?.primary_commission_pct || 0) + 
                            (fullProject?.secondary_commission_pct || 0) + 
                            (fullProject?.tertiary_commission_pct || 0)
                          )}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Commission Total Display */}
                    <div className={cn(
                      "flex items-center justify-between px-2 py-1.5 rounded-md text-xs",
                      totalCommission > 100 ? "bg-destructive/10 text-destructive" : 
                      totalCommission === 100 ? "bg-emerald-500/10 text-emerald-600" : 
                      "bg-muted text-muted-foreground"
                    )}>
                      <span className="font-medium">Total Commission:</span>
                      <span className="font-bold">{totalCommission}%</span>
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
                estimatedProjectCost={fullProject.estimated_project_cost}
                totalPl={fullProject.total_pl}
                leadCostPercent={fullProject.lead_cost_percent ?? 18}
                commissionSplitPct={fullProject.commission_split_pct ?? 50}
                salespeople={[
                  { name: fullProject.primary_salesperson, commissionPct: fullProject.primary_commission_pct || 0 },
                  { name: fullProject.secondary_salesperson, commissionPct: fullProject.secondary_commission_pct || 0 },
                  { name: fullProject.tertiary_salesperson, commissionPct: fullProject.tertiary_commission_pct || 0 },
                  { name: fullProject.quaternary_salesperson, commissionPct: fullProject.quaternary_commission_pct || 0 },
                ].filter(s => s.name)}
                onUpdateProject={(updates) => updateProjectMutation.mutate(updates)}
                onNavigateToSubcontractors={handleNavigateToSubcontractors}
                autoOpenBillDialog={autoOpenBillDialog}
              />
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <DocumentsSection projectId={project.id} />
          </TabsContent>


          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-3 mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <CheckSquare className="h-3 w-3" />
                    Office Checklist
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {checklists.filter(c => c.completed).length}/{checklists.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {/* Add new item */}
                <div className="flex gap-1.5">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Add new item..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChecklistItem.trim()) {
                        addChecklistMutation.mutate(newChecklistItem.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        addChecklistMutation.mutate(newChecklistItem.trim());
                      }
                    }}
                    disabled={!newChecklistItem.trim() || addChecklistMutation.isPending}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {checklists.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No checklist items yet
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {checklists.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 group"
                      >
                        <Checkbox
                          className="h-3.5 w-3.5"
                          checked={item.completed}
                          onCheckedChange={(checked) => 
                            toggleChecklistMutation.mutate({ id: item.id, completed: !!checked })
                          }
                        />
                        {editingChecklistId === item.id ? (
                          <div className="flex-1 flex gap-1">
                            <Input
                              value={editingChecklistText}
                              onChange={(e) => setEditingChecklistText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingChecklistText.trim()) {
                                  updateChecklistMutation.mutate({ id: item.id, item: editingChecklistText.trim() });
                                }
                                if (e.key === "Escape") {
                                  setEditingChecklistId(null);
                                  setEditingChecklistText("");
                                }
                              }}
                              autoFocus
                              className="h-6 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (editingChecklistText.trim()) {
                                  updateChecklistMutation.mutate({ id: item.id, item: editingChecklistText.trim() });
                                }
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingChecklistId(null);
                                setEditingChecklistText("");
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className={cn("flex-1 text-xs", item.completed && "line-through text-muted-foreground")}>
                              {item.item}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => {
                                  setEditingChecklistId(item.id);
                                  setEditingChecklistText(item.item);
                                }}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteChecklistMutation.mutate(item.id)}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-3 mt-4">
            {/* Notes Section - First */}
            <NotesSection projectId={project.id} />

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <Star className="h-3 w-3" />
                  Customer Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {feedback ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Satisfaction Rating</Label>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Star 
                            key={rating}
                            className={`h-4 w-4 ${
                              rating <= (feedback.satisfaction_rank || 0) 
                                ? "fill-amber-500 text-amber-500" 
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {feedback.customer_feedback && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Customer Comments</Label>
                        <p className="text-xs p-2 bg-muted rounded">
                          {feedback.customer_feedback}
                        </p>
                      </div>
                    )}
                    {feedback.online_review_given && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500">
                          Online Review Given
                        </Badge>
                        {feedback.review_location && (
                          <span className="text-[10px] text-muted-foreground">
                            on {feedback.review_location}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No feedback recorded yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  Project Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-2 bg-muted rounded">
                        {msg.is_alert && (
                          <Badge variant="destructive" className="mb-1.5 text-[10px] px-1.5 py-0">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                            Alert
                          </Badge>
                        )}
                        {msg.subject && (
                          <p className="font-medium text-xs">{msg.subject}</p>
                        )}
                        <p className="text-xs">{msg.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
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
