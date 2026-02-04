import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { logAudit } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, ChevronsUpDown, Check, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailSyncDialog } from "@/components/shared/EmailSyncDialog";

interface ProjectEditorContentProps {
  projectId?: string | null;
  onClose: () => void;
  onSuccess?: (projectId?: string) => void;
}

const DEFAULT_LOCATION_ID = "mMXD49n5UApITSmKlWdr";

/**
 * Full-page Project Editor content.
 * Handles creating and editing projects.
 */
export function ProjectEditorContent({ 
  projectId, 
  onClose, 
  onSuccess 
}: ProjectEditorContentProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const isEditing = !!projectId;

  // Fetch default lead cost percent from company settings
  const { data: defaultLeadCostPercent } = useQuery({
    queryKey: ["default-lead-cost-percent", companyId],
    queryFn: async () => {
      if (!companyId) return 18;
      
      // First try company_settings
      const { data: companySetting } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "default_lead_cost_percent")
        .maybeSingle();
      
      if (companySetting?.setting_value) {
        return parseFloat(companySetting.setting_value);
      }
      
      // Fallback to app_settings
      const { data: appSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_lead_cost_percent")
        .maybeSingle();
      
      if (appSetting?.setting_value) {
        return parseFloat(appSetting.setting_value);
      }
      
      return 18; // Final fallback
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch existing project if editing
  const { data: existingProject, isLoading: isLoadingProject } = useQuery({
    queryKey: ["project-edit", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
  // Fetch contacts for linking
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-for-project-link", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_name, email, phone")
        .eq("company_id", companyId)
        .order("contact_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
  
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  const filteredContacts = useMemo(() => {
    if (!contactSearchQuery.trim()) return contacts.slice(0, 50);
    const query = contactSearchQuery.toLowerCase();
    return contacts
      .filter(c => 
        c.contact_name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      )
      .slice(0, 50);
  }, [contacts, contactSearchQuery]);
  
  const selectedContact = useMemo(() => 
    contacts.find(c => c.id === selectedContactId),
    [contacts, selectedContactId]
  );

  // Email sync dialog state
  const [emailSyncDialogOpen, setEmailSyncDialogOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [originalEmail, setOriginalEmail] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_name: "",
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    cell_phone: "",
    home_phone: "",
    project_address: "",
    project_type: "",
    project_status: "New Job",
    primary_salesperson: "",
    estimated_cost: "",
    lead_source: "",
    branch: "",
    install_notes: "",
  });

  // Populate form when editing
  useEffect(() => {
    if (existingProject) {
      setFormData({
        project_name: existingProject.project_name || "",
        customer_first_name: existingProject.customer_first_name || "",
        customer_last_name: existingProject.customer_last_name || "",
        customer_email: existingProject.customer_email || "",
        cell_phone: existingProject.cell_phone || "",
        home_phone: existingProject.home_phone || "",
        project_address: existingProject.project_address || "",
        project_type: existingProject.project_type || "",
        project_status: existingProject.project_status || "New Job",
        primary_salesperson: existingProject.primary_salesperson || "",
        estimated_cost: existingProject.estimated_cost?.toString() || "",
        lead_source: existingProject.lead_source || "",
        branch: existingProject.branch || "",
        install_notes: existingProject.install_notes || "",
      });
      // Set existing contact_uuid when editing
      if (existingProject.contact_uuid) {
        setSelectedContactId(existingProject.contact_uuid);
      }
    }
  }, [existingProject]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const projectData = {
        project_name: formData.project_name || "New Project",
        customer_first_name: formData.customer_first_name || null,
        customer_last_name: formData.customer_last_name || null,
        customer_email: formData.customer_email || null,
        cell_phone: formData.cell_phone || null,
        home_phone: formData.home_phone || null,
        project_address: formData.project_address || null,
        project_type: formData.project_type || null,
        project_status: formData.project_status || "New Job",
        primary_salesperson: formData.primary_salesperson || null,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        lead_source: formData.lead_source || null,
        branch: formData.branch || null,
        install_notes: formData.install_notes || null,
        // Include manually selected contact if provided
        contact_uuid: selectedContactId || null,
      };

      if (isEditing && projectId) {
        // Update existing project
        const { data, error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", projectId)
          .select()
          .single();
        
        if (error) throw error;
        
        await logAudit({
          tableName: 'projects',
          recordId: data.id,
          action: 'UPDATE',
          newValues: data,
          description: `Updated project #${data.project_number} - ${data.project_name}`,
        });
        
        return data;
      } else {
        // Create new project - note: trigger will auto-create contact if none selected but customer info provided
        const { data, error } = await supabase
          .from("projects")
          .insert({
            ...projectData,
            location_id: DEFAULT_LOCATION_ID,
            created_by: user?.id || null,
            company_id: companyId,
            lead_cost_percent: defaultLeadCostPercent ?? 18,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        await logAudit({
          tableName: 'projects',
          recordId: data.id,
          action: 'INSERT',
          newValues: data,
          description: `Created project #${data.project_number} - ${data.project_name}`,
        });
        
        return data;
      }
    },
    onSuccess: (data) => {
      toast.success(isEditing ? "Project updated successfully" : "Project created successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onSuccess?.(data.id);
      onClose();
    },
    onError: (error) => {
      console.error("Error saving project:", error);
      toast.error(isEditing ? "Failed to update project" : "Failed to create project");
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name.trim()) {
      toast.error("Project name is required");
      return;
    }
    saveMutation.mutate();
  };

  if (isEditing && isLoadingProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing ? "Edit Project" : "New Project"}
            </h1>
            {isEditing && existingProject && (
              <p className="text-sm text-muted-foreground">
                Project #{existingProject.project_number}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            type="submit" 
            form="project-form"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </div>
      
      {/* Form */}
      <div className="flex-1 overflow-auto p-6">
        <form id="project-form" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="project_name">Project Name *</Label>
                <Input
                  id="project_name"
                  value={formData.project_name}
                  onChange={(e) => updateField("project_name", e.target.value)}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <Label htmlFor="project_type">Project Type</Label>
                <Input
                  id="project_type"
                  value={formData.project_type}
                  onChange={(e) => updateField("project_type", e.target.value)}
                  placeholder="e.g., Roofing, HVAC"
                />
              </div>
              <div>
                <Label htmlFor="project_status">Status</Label>
                <Select
                  value={formData.project_status}
                  onValueChange={(value) => updateField("project_status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Proposal">Proposal</SelectItem>
                    <SelectItem value="New Job">New Job</SelectItem>
                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                    <SelectItem value="On-Hold">On-Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="estimated_cost">Estimated Cost ($)</Label>
                <Input
                  id="estimated_cost"
                  type="text"
                  inputMode="decimal"
                  value={formData.estimated_cost}
                  onChange={(e) => { 
                    const val = e.target.value; 
                    if (val === '' || /^\d*\.?\d*$/.test(val)) updateField("estimated_cost", val); 
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={formData.branch}
                  onChange={(e) => updateField("branch", e.target.value)}
                  placeholder="Enter branch"
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Link to Existing Contact */}
              <div className="md:col-span-2">
                <Label>Link to Existing Contact</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={contactSearchOpen}
                        className="flex-1 justify-between"
                      >
                        {selectedContact ? (
                          <span className="truncate">
                            {selectedContact.contact_name || selectedContact.email || "Unnamed Contact"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select existing contact or enter new info below...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search contacts by name, email, or phone..." 
                          value={contactSearchQuery}
                          onValueChange={setContactSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>No contacts found.</CommandEmpty>
                          <CommandGroup>
                            {filteredContacts.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={contact.id}
                                onSelect={() => {
                                  setSelectedContactId(contact.id);
                                  setContactSearchOpen(false);
                                  // Optionally populate form fields from contact
                                  if (contact.contact_name) {
                                    const parts = contact.contact_name.split(' ');
                                    if (parts.length >= 2) {
                                      updateField("customer_first_name", parts[0]);
                                      updateField("customer_last_name", parts.slice(1).join(' '));
                                    } else {
                                      updateField("customer_first_name", contact.contact_name);
                                    }
                                  }
                                  if (contact.email) updateField("customer_email", contact.email);
                                  if (contact.phone) updateField("cell_phone", contact.phone);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedContactId === contact.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{contact.contact_name || "Unnamed"}</span>
                                  {(contact.email || contact.phone) && (
                                    <span className="text-xs text-muted-foreground">
                                      {[contact.email, contact.phone].filter(Boolean).join(" • ")}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedContactId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedContactId(null)}
                      title="Clear linked contact"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!selectedContactId && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    If no contact is selected, one will be created automatically from the info below.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_first_name">First Name</Label>
                  <Input
                    id="customer_first_name"
                    value={formData.customer_first_name}
                    onChange={(e) => updateField("customer_first_name", e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_last_name">Last Name</Label>
                  <Input
                    id="customer_last_name"
                    value={formData.customer_last_name}
                    onChange={(e) => updateField("customer_last_name", e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => updateField("customer_email", e.target.value)}
                    onFocus={() => {
                      if (!originalEmail && formData.customer_email) {
                        setOriginalEmail(formData.customer_email);
                      }
                    }}
                    onBlur={(e) => {
                      const newEmail = e.target.value.trim();
                      if (selectedContactId && originalEmail && newEmail && newEmail !== originalEmail) {
                        setPendingEmail(newEmail);
                        setEmailSyncDialogOpen(true);
                      }
                    }}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cell_phone">Cell Phone</Label>
                  <Input
                    id="cell_phone"
                    value={formData.cell_phone}
                    onChange={(e) => updateField("cell_phone", e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <Label htmlFor="home_phone">Home Phone</Label>
                  <Input
                    id="home_phone"
                    value={formData.home_phone}
                    onChange={(e) => updateField("home_phone", e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="project_address">Address</Label>
                  <Input
                    id="project_address"
                    value={formData.project_address}
                    onChange={(e) => updateField("project_address", e.target.value)}
                    placeholder="Full address"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sales Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_salesperson">Primary Salesperson</Label>
                <Input
                  id="primary_salesperson"
                  value={formData.primary_salesperson}
                  onChange={(e) => updateField("primary_salesperson", e.target.value)}
                  placeholder="Salesperson name"
                />
              </div>
              <div>
                <Label htmlFor="lead_source">Lead Source</Label>
                <Input
                  id="lead_source"
                  value={formData.lead_source}
                  onChange={(e) => updateField("lead_source", e.target.value)}
                  placeholder="e.g., Referral, Web"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="install_notes">Install Notes</Label>
                <Textarea
                  id="install_notes"
                  value={formData.install_notes}
                  onChange={(e) => updateField("install_notes", e.target.value)}
                  placeholder="Any additional notes..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
    
    {/* Email Sync Dialog */}
    <EmailSyncDialog
      open={emailSyncDialogOpen}
      onOpenChange={setEmailSyncDialogOpen}
      contactUuid={selectedContactId}
      oldEmail={originalEmail}
      newEmail={pendingEmail}
      onSyncConfirmed={() => {
        setOriginalEmail(pendingEmail);
      }}
      onUpdateLocalOnly={() => {
        setOriginalEmail(pendingEmail);
      }}
    />
  </>
  );
}
