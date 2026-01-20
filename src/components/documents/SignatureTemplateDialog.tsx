import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, FolderOpen, Trash2, PenTool, Calendar, User, Mail, Type, Loader2, Edit3 } from "lucide-react";
import { toast } from "sonner";

interface Signer {
  id: string;
  name: string;
  email: string;
  order: number;
  color: string;
}

interface SignatureField {
  id: string;
  signerId: string;
  signerName: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldType: "signature" | "initials" | "date" | "name" | "email" | "text";
  isRequired: boolean;
  fieldLabel?: string;
}

interface TemplateItem {
  id: string;
  template_id: string;
  signer_order: number;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  field_type: string;
  is_required: boolean;
  field_label: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  items?: TemplateItem[];
}

interface SignatureTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFields: SignatureField[];
  signers: Signer[];
  onApplyTemplate: (fields: SignatureField[]) => void;
}

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  signature: PenTool,
  date: Calendar,
  name: User,
  email: Mail,
  text: Type,
};

export function SignatureTemplateDialog({
  open,
  onOpenChange,
  currentFields,
  signers,
  onApplyTemplate,
}: SignatureTemplateDialogProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [activeTab, setActiveTab] = useState("load");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [signerMapping, setSignerMapping] = useState<Record<number, { name: string; email: string }>>({});

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["signature-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_field_templates")
        .select(`
          *,
          items:signature_field_template_items(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
    enabled: open,
  });

  // Save template mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!templateName.trim()) {
        throw new Error("Template name is required");
      }
      if (currentFields.length === 0) {
        throw new Error("No fields to save");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create template
      const { data: template, error: templateError } = await supabase
        .from("signature_field_templates")
        .insert({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          created_by: user.id,
          company_id: companyId,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create template items - map signer IDs to order numbers
      const signerOrderMap = new Map<string, number>();
      signers.forEach((s) => signerOrderMap.set(s.id, s.order));

      const items = currentFields.map((field) => ({
        template_id: template.id,
        signer_order: signerOrderMap.get(field.signerId) || 1,
        page_number: field.pageNumber,
        x_position: field.x,
        y_position: field.y,
        width: field.width,
        height: field.height,
        field_type: field.fieldType,
        is_required: field.isRequired,
        field_label: field.fieldLabel || null,
        company_id: companyId,
      }));

      const { error: itemsError } = await supabase
        .from("signature_field_template_items")
        .insert(items);

      if (itemsError) throw itemsError;

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-templates"] });
      toast.success("Template saved successfully");
      setTemplateName("");
      setTemplateDescription("");
      setActiveTab("load");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("signature_field_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-templates"] });
      toast.success("Template deleted");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  // Get unique signer orders from a template
  const getUniqueSignerOrders = (template: Template): number[] => {
    if (!template.items) return [];
    const orders = new Set(template.items.map((item) => item.signer_order));
    return Array.from(orders).sort((a, b) => a - b);
  };

  // Apply template
  const handleApplyTemplate = (template: Template) => {
    if (!template.items || template.items.length === 0) {
      toast.error("Template has no fields");
      return;
    }

    // Map signer orders to actual signers
    const orderToSigner = new Map<number, Signer>();
    const signerOrders = getUniqueSignerOrders(template);

    signerOrders.forEach((order) => {
      const mapping = signerMapping[order];
      if (mapping) {
        // Find or create signer from mapping
        const existingSigner = signers.find(
          (s) => s.email.toLowerCase() === mapping.email.toLowerCase()
        );
        if (existingSigner) {
          orderToSigner.set(order, existingSigner);
        } else {
          // Use first available signer with updated info
          const signerIndex = signerOrders.indexOf(order);
          if (signers[signerIndex]) {
            orderToSigner.set(order, {
              ...signers[signerIndex],
              name: mapping.name,
              email: mapping.email,
            });
          }
        }
      } else {
        // Use existing signer by order
        const signer = signers.find((s) => s.order === order) || signers[0];
        if (signer) orderToSigner.set(order, signer);
      }
    });

    // Convert template items to fields
    const newFields: SignatureField[] = template.items.map((item) => {
      const signer = orderToSigner.get(item.signer_order) || signers[0];
      return {
        id: crypto.randomUUID(),
        signerId: signer?.id || "",
        signerName: signerMapping[item.signer_order]?.name || signer?.name || "Signer",
        pageNumber: item.page_number,
        x: item.x_position,
        y: item.y_position,
        width: item.width,
        height: item.height,
        fieldType: item.field_type as SignatureField["fieldType"],
        isRequired: item.is_required,
        fieldLabel: item.field_label || undefined,
      };
    });

    onApplyTemplate(newFields);
    onOpenChange(false);
    toast.success(`Applied template: ${template.name}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Signature Field Templates</DialogTitle>
          <DialogDescription>
            Save field layouts as templates or load existing templates
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="load" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Load Template
            </TabsTrigger>
            <TabsTrigger value="save" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load" className="space-y-4">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No templates saved yet</p>
                <p className="text-sm">Create your first template by saving the current field layout</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {templates.map((template) => {
                    const signerOrders = getUniqueSignerOrders(template);
                    return (
                      <Card key={template.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              {template.description && (
                                <p className="text-sm text-muted-foreground">{template.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary">
                                  {template.items?.length || 0} fields
                                </Badge>
                                <Badge variant="outline">
                                  {signerOrders.length} signer{signerOrders.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(template.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Signer mapping inputs */}
                          <div className="space-y-2 mb-3">
                            <Label className="text-xs text-muted-foreground">
                              Update signer information:
                            </Label>
                            {signerOrders.map((order) => (
                              <div key={order} className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder={`Signer ${order} name`}
                                  value={signerMapping[order]?.name || ""}
                                  onChange={(e) =>
                                    setSignerMapping((prev) => ({
                                      ...prev,
                                      [order]: {
                                        ...prev[order],
                                        name: e.target.value,
                                        email: prev[order]?.email || "",
                                      },
                                    }))
                                  }
                                  className="h-8 text-sm"
                                />
                                <Input
                                  placeholder={`Signer ${order} email`}
                                  type="email"
                                  value={signerMapping[order]?.email || ""}
                                  onChange={(e) =>
                                    setSignerMapping((prev) => ({
                                      ...prev,
                                      [order]: {
                                        ...prev[order],
                                        name: prev[order]?.name || "",
                                        email: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Field preview */}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {template.items?.slice(0, 6).map((item) => {
                              const Icon = FIELD_TYPE_ICONS[item.field_type] || PenTool;
                              return (
                                <Badge key={item.id} variant="outline" className="text-xs">
                                  <Icon className="h-3 w-3 mr-1" />
                                  {item.field_type}
                                </Badge>
                              );
                            })}
                            {(template.items?.length || 0) > 6 && (
                              <Badge variant="outline" className="text-xs">
                                +{(template.items?.length || 0) - 6} more
                              </Badge>
                            )}
                          </div>

                          <Button
                            onClick={() => handleApplyTemplate(template)}
                            className="w-full"
                            size="sm"
                          >
                            Apply Template
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="save" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Contract Layout"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional description of this template"
                  rows={2}
                />
              </div>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Current Fields Preview</h4>
                  {currentFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No fields to save. Add fields to the document first.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{currentFields.length} fields</Badge>
                        <Badge variant="outline">
                          {new Set(currentFields.map((f) => f.signerId)).size} signer
                          {new Set(currentFields.map((f) => f.signerId)).size !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {currentFields.slice(0, 8).map((field) => {
                          const Icon = FIELD_TYPE_ICONS[field.fieldType] || PenTool;
                          return (
                            <Badge key={field.id} variant="outline" className="text-xs">
                              <Icon className="h-3 w-3 mr-1" />
                              {field.fieldType}
                            </Badge>
                          );
                        })}
                        {currentFields.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{currentFields.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !templateName.trim() || currentFields.length === 0}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Template
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
