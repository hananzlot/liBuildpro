import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Upload, Loader2, GripVertical, Eye, Download, FileSignature, Settings2, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ComplianceFieldEditor } from "./ComplianceFieldEditor";
import { ComplianceTestOverlayDialog } from "./ComplianceTestOverlayDialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComplianceTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  template_file_url: string;
  template_file_name: string;
  requires_separate_signature: boolean;
  is_main_contract: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_PLACEHOLDERS = [
  { key: "{{customer_name}}", description: "Customer's full name" },
  { key: "{{customer_email}}", description: "Customer's email address" },
  { key: "{{customer_phone}}", description: "Customer's phone number" },
  { key: "{{project_name}}", description: "Project/job name" },
  { key: "{{project_address}}", description: "Full job site address" },
  { key: "{{estimate_total}}", description: "Total estimate amount" },
  { key: "{{deposit_amount}}", description: "Required deposit amount" },
  { key: "{{scope_description}}", description: "Scope of work description" },
  { key: "{{salesperson_name}}", description: "Assigned salesperson name" },
  { key: "{{company_name}}", description: "Your company name" },
  { key: "{{company_address}}", description: "Your company address" },
  { key: "{{company_phone}}", description: "Your company phone" },
  { key: "{{company_license}}", description: "Your license number" },
  { key: "{{current_date}}", description: "Today's date" },
  { key: "{{expiration_date}}", description: "Proposal expiration date" },
  { key: "{{line_items}}", description: "Table of all line items with descriptions and prices" },
  { key: "{{payment_schedule}}", description: "Payment phases/schedule details" },
  { key: "{{terms_and_conditions}}", description: "Terms and conditions text" },
  { key: "{{notes}}", description: "Additional notes from the estimate" },
];

export function ComplianceTemplatesManager() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [testOverlayOpen, setTestOverlayOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ComplianceTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiresSeparateSignature, setRequiresSeparateSignature] = useState(false);
  const [isMainContract, setIsMainContract] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["compliance-templates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("compliance_document_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as ComplianceTemplate[];
    },
    enabled: !!companyId,
  });

  // Create/update template mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      requiresSeparateSignature: boolean;
      isMainContract: boolean;
      file?: File;
      existingId?: string;
    }) => {
      if (!companyId) throw new Error("No company ID");

      let fileUrl = selectedTemplate?.template_file_url;
      let fileName = selectedTemplate?.template_file_name;

      // Upload file if provided
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        // Store inside an existing public bucket to avoid missing-bucket issues.
        // Keep templates namespaced to avoid collisions with other uploads.
        const filePath = `compliance-templates/${companyId}/${Date.now()}-${data.file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("project-attachments")
          .upload(filePath, data.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("project-attachments")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = data.file.name;
      }

      if (!fileUrl || !fileName) {
        throw new Error("Please upload a PDF template file");
      }

      const templateData = {
        company_id: companyId,
        name: data.name,
        description: data.description || null,
        template_file_url: fileUrl,
        template_file_name: fileName,
        requires_separate_signature: data.requiresSeparateSignature,
        is_main_contract: data.isMainContract,
        display_order: data.existingId ? selectedTemplate?.display_order : templates.length,
        updated_at: new Date().toISOString(),
      };

      if (data.existingId) {
        const { error } = await supabase
          .from("compliance_document_templates")
          .update(templateData)
          .eq("id", data.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("compliance_document_templates")
          .insert(templateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-templates", companyId] });
      toast.success(selectedTemplate ? "Template updated" : "Template created");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("compliance_document_templates")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-templates", companyId] });
      toast.success("Template status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compliance_document_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-templates", companyId] });
      toast.success("Template deleted");
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const handleOpenDialog = (template?: ComplianceTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setName(template.name);
      setDescription(template.description || "");
      setRequiresSeparateSignature(template.requires_separate_signature);
      setIsMainContract(template.is_main_contract);
      setSelectedFile(null);
    } else {
      setSelectedTemplate(null);
      setName("");
      setDescription("");
      setRequiresSeparateSignature(false);
      setIsMainContract(false);
      setSelectedFile(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setRequiresSeparateSignature(false);
    setIsMainContract(false);
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!selectedFile && !selectedTemplate) {
      toast.error("Please upload a PDF template file");
      return;
    }

    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      requiresSeparateSignature,
      isMainContract,
      file: selectedFile || undefined,
      existingId: selectedTemplate?.id,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Compliance Document Templates
          </span>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            Add Template
          </Button>
        </CardTitle>
        <CardDescription>
          Upload PDF templates with placeholders that will be auto-filled with customer and proposal information. 
          These documents are automatically attached when sending proposals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No compliance templates configured yet.</p>
            <p className="text-sm mt-1">Add a template to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{template.name}</span>
                    {template.is_main_contract && (
                      <Badge variant="default" className="text-xs bg-primary">
                        Main Contract
                      </Badge>
                    )}
                    {template.requires_separate_signature && (
                      <Badge variant="outline" className="text-xs">
                        <FileSignature className="h-3 w-3 mr-1" />
                        Separate Signature
                      </Badge>
                    )}
                    {!template.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {template.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.template_file_name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => 
                      toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                    }
                    disabled={toggleActiveMutation.isPending}
                  />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(template.template_file_url, "_blank")}
                    title="View template"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setTestOverlayOpen(true);
                    }}
                    title="Test overlay with real data"
                  >
                    <FlaskConical className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setFieldEditorOpen(true);
                    }}
                    title="Configure field positions"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(template)}
                    title="Edit template"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setDeleteDialogOpen(true);
                    }}
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Available Placeholders Info */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Available Placeholders
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Use these placeholders in your PDF templates. They will be automatically replaced with actual data when the document is generated.
          </p>
          <ScrollArea className="h-[200px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
                <div key={placeholder.key} className="flex items-start gap-2 text-sm">
                  <code className="px-1.5 py-0.5 bg-background rounded text-xs font-mono whitespace-nowrap">
                    {placeholder.key}
                  </code>
                  <span className="text-muted-foreground text-xs">{placeholder.description}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Compliance Template" : "Add Compliance Template"}
            </DialogTitle>
            <DialogDescription>
              Upload a PDF template with placeholders that will be filled with customer and proposal data.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Notice of Right to Cancel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this document's purpose..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-file">
                PDF Template {!selectedTemplate && "*"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="template-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
              {selectedTemplate && !selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Current: {selectedTemplate.template_file_name}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="requires-signature" className="font-medium">
                  Requires Separate Signature
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If enabled, this document will require its own signature separate from the main proposal
                </p>
              </div>
              <Switch
                id="requires-signature"
                checked={requiresSeparateSignature}
                onCheckedChange={setRequiresSeparateSignature}
                disabled={isMainContract}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg border-primary/30 bg-primary/5">
              <div>
                <Label htmlFor="is-main-contract" className="font-medium">
                  Main Contract Document
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If enabled, this is the main contract that can only be signed after all required compliance docs are signed
                </p>
              </div>
              <Switch
                id="is-main-contract"
                checked={isMainContract}
                onCheckedChange={(checked) => {
                  setIsMainContract(checked);
                  if (checked) {
                    setRequiresSeparateSignature(false);
                  }
                }}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {selectedTemplate ? "Update" : "Create"} Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Field Position Editor */}
      {selectedTemplate && companyId && (
        <ComplianceFieldEditor
          open={fieldEditorOpen}
          onOpenChange={setFieldEditorOpen}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          templateFileUrl={selectedTemplate.template_file_url}
          companyId={companyId}
        />
      )}

      {/* Test Overlay Dialog */}
      {selectedTemplate && companyId && (
        <ComplianceTestOverlayDialog
          open={testOverlayOpen}
          onOpenChange={setTestOverlayOpen}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          companyId={companyId}
        />
      )}
    </Card>
  );
}
