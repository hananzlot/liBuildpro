import { useState, useEffect, useCallback } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { useDiscardConfirm } from "@/hooks/useDiscardConfirm";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_LOCATION_ID = "mMXD49n5UApITSmKlWdr";

const INITIAL_FORM = {
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
};

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { user, isCorpAdmin, company } = useAuth();
  const { companyId: contextCompanyId, corporationId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const { data: corpCompanies } = useQuery({
    queryKey: ["corp-companies-for-new-project", corporationId],
    queryFn: async () => {
      if (!corporationId) return [];
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("corporation_id", corporationId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!isCorpAdmin && !!corporationId,
    staleTime: 30 * 60 * 1000,
  });

  const companyId = selectedCompanyId || contextCompanyId;

  useEffect(() => {
    if (open) {
      setSelectedCompanyId(contextCompanyId);
    }
  }, [open, contextCompanyId]);

  const { data: defaultLeadCostPercent } = useQuery({
    queryKey: ["default-lead-cost-percent", companyId],
    queryFn: async () => {
      if (!companyId) return 18;
      const { data: companySetting } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "default_lead_cost_percent")
        .maybeSingle();
      if (companySetting?.setting_value) return parseFloat(companySetting.setting_value);
      const { data: appSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_lead_cost_percent")
        .maybeSingle();
      if (appSetting?.setting_value) return parseFloat(appSetting.setting_value);
      return 18;
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000,
  });

  // Draft persistence
  const { draft, updateDraft, clearDraft, isDirty } = usePersistentDraft(
    "new-project",
    INITIAL_FORM,
    undefined,
    open
  );

  const handleClose = useCallback(() => {
    clearDraft();
    onOpenChange(false);
  }, [clearDraft, onOpenChange]);

  const { showConfirm, handleOpenChange, confirmDiscard, cancelDiscard } =
    useDiscardConfirm(isDirty, handleClose, () => onOpenChange(true));

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          project_name: draft.project_name || "New Project",
          customer_first_name: draft.customer_first_name || null,
          customer_last_name: draft.customer_last_name || null,
          customer_email: draft.customer_email || null,
          cell_phone: draft.cell_phone || null,
          home_phone: draft.home_phone || null,
          project_address: draft.project_address || null,
          project_type: draft.project_type || null,
          project_status: draft.project_status || "New Job",
          primary_salesperson: draft.primary_salesperson || null,
          estimated_cost: draft.estimated_cost ? parseFloat(draft.estimated_cost) : null,
          lead_source: draft.lead_source || null,
          branch: draft.branch || null,
          install_notes: draft.install_notes || null,
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
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      clearDraft();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.project_name.trim()) {
      toast.error("Project name is required");
      return;
    }
    createProjectMutation.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project manually without a linked opportunity.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Selector for Corp Admins */}
            {isCorpAdmin && corpCompanies && corpCompanies.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="company_select">Create Under Company</Label>
                <Select
                  value={selectedCompanyId || ""}
                  onValueChange={(value) => setSelectedCompanyId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {corpCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Project Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Project Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="project_name">Project Name *</Label>
                  <Input
                    id="project_name"
                    value={draft.project_name}
                    onChange={(e) => updateDraft({ project_name: e.target.value })}
                    placeholder="Enter project name"
                  />
                </div>
                <div>
                  <Label htmlFor="project_type">Project Type</Label>
                  <Input
                    id="project_type"
                    value={draft.project_type}
                    onChange={(e) => updateDraft({ project_type: e.target.value })}
                    placeholder="e.g., Roofing, HVAC"
                  />
                </div>
                <div>
                  <Label htmlFor="project_status">Status</Label>
                  <Select
                    value={draft.project_status}
                    onValueChange={(value) => updateDraft({ project_status: value })}
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
                    value={draft.estimated_cost}
                    onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updateDraft({ estimated_cost: val }); }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={draft.branch}
                    onChange={(e) => updateDraft({ branch: e.target.value })}
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
                    value={draft.customer_first_name}
                    onChange={(e) => updateDraft({ customer_first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_last_name">Last Name</Label>
                  <Input
                    id="customer_last_name"
                    value={draft.customer_last_name}
                    onChange={(e) => updateDraft({ customer_last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={draft.customer_email}
                    onChange={(e) => updateDraft({ customer_email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cell_phone">Cell Phone</Label>
                  <Input
                    id="cell_phone"
                    value={draft.cell_phone}
                    onChange={(e) => updateDraft({ cell_phone: e.target.value })}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <Label htmlFor="home_phone">Home Phone</Label>
                  <Input
                    id="home_phone"
                    value={draft.home_phone}
                    onChange={(e) => updateDraft({ home_phone: e.target.value })}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="project_address">Address</Label>
                  <Input
                    id="project_address"
                    value={draft.project_address}
                    onChange={(e) => updateDraft({ project_address: e.target.value })}
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
                    value={draft.primary_salesperson}
                    onChange={(e) => updateDraft({ primary_salesperson: e.target.value })}
                    placeholder="Salesperson name"
                  />
                </div>
                <div>
                  <Label htmlFor="lead_source">Lead Source</Label>
                  <Input
                    id="lead_source"
                    value={draft.lead_source}
                    onChange={(e) => updateDraft({ lead_source: e.target.value })}
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
                  value={draft.install_notes}
                  onChange={(e) => updateDraft({ install_notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
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

      <AlertDialog open={showConfirm} onOpenChange={(v) => !v && cancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved project data. Discard it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
