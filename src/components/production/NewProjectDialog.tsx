import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { logAudit } from "@/hooks/useAuditLog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_LOCATION_ID = "mMXD49n5UApITSmKlWdr";

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

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

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
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
          location_id: DEFAULT_LOCATION_ID,
          created_by: user?.id || null,
          company_id: companyId,
          lead_cost_percent: defaultLeadCostPercent ?? 18,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit for project creation
      await logAudit({
        tableName: 'projects',
        recordId: data.id,
        action: 'INSERT',
        newValues: data,
        description: `Created project #${data.project_number} - ${data.project_name}`,
      });
      
      return data;
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    },
  });

  const resetForm = () => {
    setFormData({
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name.trim()) {
      toast.error("Project name is required");
      return;
    }
    createProjectMutation.mutate();
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project manually without a linked opportunity.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Project Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
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
                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updateField("estimated_cost", val); }}
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
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="col-span-2">
                <Label htmlFor="project_address">Address</Label>
                <Input
                  id="project_address"
                  value={formData.project_address}
                  onChange={(e) => updateField("project_address", e.target.value)}
                  placeholder="Full address"
                />
              </div>
            </div>
          </div>

          {/* Sales Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Sales Information</h3>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
            <div>
              <Label htmlFor="install_notes">Install Notes</Label>
              <Textarea
                id="install_notes"
                value={formData.install_notes}
                onChange={(e) => updateField("install_notes", e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
