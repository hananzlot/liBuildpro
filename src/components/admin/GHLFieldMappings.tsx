import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings2, 
  Plus, 
  Loader2,
  Trash2,
  Pencil,
  Save,
  X,
  Building2
} from "lucide-react";

interface FieldMapping {
  id: string;
  company_id: string | null;
  integration_id: string | null;
  field_name: string;
  ghl_custom_field_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface GHLIntegration {
  id: string;
  name: string | null;
  location_id: string | null;
  is_active: boolean | null;
}

const KNOWN_FIELDS = [
  { name: "address", label: "Address", description: "Contact address custom field" },
  { name: "scope_of_work", label: "Scope of Work", description: "Scope of work custom field" },
  { name: "notes", label: "Notes", description: "Additional notes custom field" },
];

export function GHLFieldMappings() {
  const queryClient = useQueryClient();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Form state for adding new mapping
  const [formFieldName, setFormFieldName] = useState("");
  const [formGhlFieldId, setFormGhlFieldId] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Fetch active GHL integrations
  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ["ghl-integrations-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_integrations")
        .select("id, name, location_id, is_active")
        .eq("provider", "ghl")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as GHLIntegration[];
    },
  });

  // Auto-select first integration
  const effectiveIntegrationId = selectedIntegrationId || integrations?.[0]?.id || null;

  // Fetch field mappings for selected integration
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ["ghl-field-mappings", effectiveIntegrationId],
    queryFn: async () => {
      if (!effectiveIntegrationId) return [];
      
      const { data, error } = await supabase
        .from("ghl_field_mappings")
        .select("*")
        .eq("integration_id", effectiveIntegrationId)
        .order("field_name");

      if (error) throw error;
      return (data || []) as FieldMapping[];
    },
    enabled: !!effectiveIntegrationId,
  });

  // Add/update mapping mutation
  const upsertMapping = useMutation({
    mutationFn: async (data: { fieldName: string; ghlFieldId: string; description: string }) => {
      if (!effectiveIntegrationId) throw new Error("No integration selected");
      
      // Get the integration's company_id
      const integration = integrations?.find(i => i.id === effectiveIntegrationId);
      
      // Check if mapping exists for this field on this integration
      const existing = mappings?.find(m => m.field_name === data.fieldName);
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("ghl_field_mappings")
          .update({ 
            ghl_custom_field_id: data.ghlFieldId,
            description: data.description,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Get company_id from integration
        const { data: integrationData } = await supabase
          .from("company_integrations")
          .select("company_id")
          .eq("id", effectiveIntegrationId)
          .single();
        
        // Insert new with integration_id
        const { error } = await supabase
          .from("ghl_field_mappings")
          .insert({
            field_name: data.fieldName,
            ghl_custom_field_id: data.ghlFieldId,
            description: data.description,
            integration_id: effectiveIntegrationId,
            company_id: integrationData?.company_id || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-field-mappings"] });
      toast.success("Field mapping saved");
      resetForm();
      setAddDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save mapping: ${error.message}`);
    },
  });

  // Delete mapping mutation
  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ghl_field_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-field-mappings"] });
      toast.success("Field mapping deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete mapping: ${error.message}`);
    },
  });

  // Inline update mutation
  const inlineUpdate = useMutation({
    mutationFn: async ({ id, ghlFieldId }: { id: string; ghlFieldId: string }) => {
      const { error } = await supabase
        .from("ghl_field_mappings")
        .update({ ghl_custom_field_id: ghlFieldId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-field-mappings"] });
      toast.success("Field mapping updated");
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update mapping: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormFieldName("");
    setFormGhlFieldId("");
    setFormDescription("");
  };

  const handleAddSubmit = () => {
    if (!formFieldName || !formGhlFieldId) {
      toast.error("Please fill in field name and GHL custom field ID");
      return;
    }

    upsertMapping.mutate({
      fieldName: formFieldName,
      ghlFieldId: formGhlFieldId,
      description: formDescription,
    });
  };

  const handleStartEdit = (mapping: FieldMapping) => {
    setEditingId(mapping.id);
    setEditValue(mapping.ghl_custom_field_id);
  };

  const handleSaveEdit = (id: string) => {
    if (!editValue.trim()) {
      toast.error("GHL field ID cannot be empty");
      return;
    }
    inlineUpdate.mutate({ id, ghlFieldId: editValue.trim() });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const getFieldLabel = (fieldName: string) => {
    const known = KNOWN_FIELDS.find(f => f.name === fieldName);
    return known?.label || fieldName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get unmapped known fields for quick add
  const unmappedFields = KNOWN_FIELDS.filter(
    kf => !mappings?.some(m => m.field_name === kf.name)
  );

  const isLoading = integrationsLoading || mappingsLoading;
  const selectedIntegration = integrations?.find(i => i.id === effectiveIntegrationId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Custom Field Mappings
            </CardTitle>
            <CardDescription>
              Map GHL custom field IDs to application fields. Each integration can have different mappings.
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            onClick={() => setAddDialogOpen(true)}
            disabled={!effectiveIntegrationId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Integration Selector */}
        {integrations && integrations.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium whitespace-nowrap">Integration:</Label>
            <Select
              value={effectiveIntegrationId || ""}
              onValueChange={(value) => setSelectedIntegrationId(value)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an integration" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((integration) => (
                  <SelectItem key={integration.id} value={integration.id}>
                    {integration.name || integration.location_id || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIntegration?.location_id && (
              <span className="text-xs text-muted-foreground">
                Location: {selectedIntegration.location_id}
              </span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !integrations || integrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No active GHL integrations found</p>
            <p className="text-sm mt-1">Add a GHL integration first to configure field mappings</p>
          </div>
        ) : !mappings || mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No field mappings for this integration</p>
            <p className="text-sm mt-1">Add mappings to sync custom fields from GHL</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Name</TableHead>
                <TableHead>GHL Custom Field ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">
                    {getFieldLabel(mapping.field_name)}
                  </TableCell>
                  <TableCell>
                    {editingId === mapping.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 font-mono text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleSaveEdit(mapping.id)}
                          disabled={inlineUpdate.isPending}
                        >
                          {inlineUpdate.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {mapping.ghl_custom_field_id}
                      </code>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {mapping.description || "-"}
                  </TableCell>
                  <TableCell>
                    {editingId !== mapping.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleStartEdit(mapping)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMapping.mutate(mapping.id)}
                          disabled={deleteMapping.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Mapping Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Field Mapping</DialogTitle>
            <DialogDescription>
              Map a GHL custom field ID to an application field for {selectedIntegration?.name || "this integration"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {unmappedFields.length > 0 && (
              <div className="space-y-2">
                <Label>Quick Add Known Fields</Label>
                <div className="flex flex-wrap gap-2">
                  {unmappedFields.map(field => (
                    <Button
                      key={field.name}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormFieldName(field.name);
                        setFormDescription(field.description);
                      }}
                      className={formFieldName === field.name ? "border-primary" : ""}
                    >
                      {field.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="field-name">Field Name *</Label>
              <Input
                id="field-name"
                placeholder="e.g., address, scope_of_work"
                value={formFieldName}
                onChange={(e) => setFormFieldName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              />
              <p className="text-xs text-muted-foreground">
                Use snake_case (e.g., scope_of_work)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ghl-field-id">GHL Custom Field ID *</Label>
              <Input
                id="ghl-field-id"
                placeholder="e.g., b7oTVsUQrLgZt84bHpCn"
                value={formGhlFieldId}
                onChange={(e) => setFormGhlFieldId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Found in GHL Settings → Custom Fields → Field ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setAddDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={upsertMapping.isPending || !formFieldName || !formGhlFieldId}
            >
              {upsertMapping.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
