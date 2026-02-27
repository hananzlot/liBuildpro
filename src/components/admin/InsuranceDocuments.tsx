import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Upload, Trash2, FileText, Loader2, Plus, ExternalLink } from "lucide-react";

interface InsuranceDoc {
  id: string;
  label: string;
  file_url: string | null;
  file_name: string | null;
}

const DEFAULT_SLOTS = [
  { key: "general_liability", label: "General Liability" },
  { key: "workers_comp", label: "Workers Compensation" },
];

const MAX_TOTAL_DOCS = 5;

export function InsuranceDocuments() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const [newDocLabel, setNewDocLabel] = useState("");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["insurance-documents", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId)
        .like("setting_key", "insurance_doc_%");
      if (error) throw error;

      // Parse stored documents
      const docs: InsuranceDoc[] = [];
      const settingsMap = new Map<string, string>();
      (data || []).forEach((s) => {
        settingsMap.set(s.setting_key, s.setting_value || "");
      });

      // Add default slots
      for (const slot of DEFAULT_SLOTS) {
        const urlKey = `insurance_doc_${slot.key}_url`;
        const nameKey = `insurance_doc_${slot.key}_name`;
        docs.push({
          id: slot.key,
          label: slot.label,
          file_url: settingsMap.get(urlKey) || null,
          file_name: settingsMap.get(nameKey) || null,
        });
      }

      // Add custom slots
      const customCountStr = settingsMap.get("insurance_doc_custom_count") || "0";
      const customCount = parseInt(customCountStr, 10) || 0;
      for (let i = 1; i <= customCount; i++) {
        const labelKey = `insurance_doc_custom_${i}_label`;
        const urlKey = `insurance_doc_custom_${i}_url`;
        const nameKey = `insurance_doc_custom_${i}_name`;
        docs.push({
          id: `custom_${i}`,
          label: settingsMap.get(labelKey) || `Custom Document ${i}`,
          file_url: settingsMap.get(urlKey) || null,
          file_name: settingsMap.get(nameKey) || null,
        });
      }

      return docs;
    },
    enabled: !!companyId,
  });

  const saveSetting = async (key: string, value: string) => {
    if (!companyId) return;
    await supabase
      .from("company_settings")
      .upsert(
        {
          company_id: companyId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,setting_key" }
      );
  };

  const handleUpload = async (docId: string, file: File) => {
    if (!companyId) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files are allowed");
      return;
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }

    setUploading(docId);
    try {
      const filePath = `insurance/${companyId}/${docId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(filePath);

      // Save URL and file name to company_settings
      const isCustom = docId.startsWith("custom_");
      const urlKey = isCustom
        ? `insurance_doc_${docId}_url`
        : `insurance_doc_${docId}_url`;
      const nameKey = isCustom
        ? `insurance_doc_${docId}_name`
        : `insurance_doc_${docId}_name`;

      await Promise.all([
        saveSetting(urlKey, urlData.publicUrl),
        saveSetting(nameKey, file.name),
      ]);

      queryClient.invalidateQueries({ queryKey: ["insurance-documents", companyId] });
      toast.success("Insurance document uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (docId: string) => {
    if (!companyId) return;

    const urlKey = `insurance_doc_${docId}_url`;
    const nameKey = `insurance_doc_${docId}_name`;

    await Promise.all([
      saveSetting(urlKey, ""),
      saveSetting(nameKey, ""),
    ]);

    queryClient.invalidateQueries({ queryKey: ["insurance-documents", companyId] });
    toast.success("Document removed");
  };

  const handleAddCustomSlot = async () => {
    if (!companyId || !newDocLabel.trim()) {
      toast.error("Please enter a document label");
      return;
    }

    const customCount = documents.filter((d) => d.id.startsWith("custom_")).length;
    const totalCount = DEFAULT_SLOTS.length + customCount;

    if (totalCount >= MAX_TOTAL_DOCS) {
      toast.error(`Maximum of ${MAX_TOTAL_DOCS} insurance documents allowed`);
      return;
    }

    const newIndex = customCount + 1;
    await Promise.all([
      saveSetting(`insurance_doc_custom_${newIndex}_label`, newDocLabel.trim()),
      saveSetting("insurance_doc_custom_count", String(newIndex)),
    ]);

    setNewDocLabel("");
    queryClient.invalidateQueries({ queryKey: ["insurance-documents", companyId] });
    toast.success("Insurance document slot added");
  };

  const handleRemoveCustomSlot = async (docId: string) => {
    if (!companyId) return;
    // Just clear the data for this slot
    const urlKey = `insurance_doc_${docId}_url`;
    const nameKey = `insurance_doc_${docId}_name`;
    const labelKey = `insurance_doc_${docId}_label`;

    await Promise.all([
      saveSetting(urlKey, ""),
      saveSetting(nameKey, ""),
      saveSetting(labelKey, ""),
    ]);

    // Decrement custom count
    const customCount = documents.filter((d) => d.id.startsWith("custom_")).length;
    await saveSetting("insurance_doc_custom_count", String(Math.max(0, customCount - 1)));

    queryClient.invalidateQueries({ queryKey: ["insurance-documents", companyId] });
    toast.success("Document slot removed");
  };

  const totalSlots = documents.length;
  const canAddMore = totalSlots < MAX_TOTAL_DOCS;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Insurance Documents
              <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Upload insurance certificates for your company. General Liability and Workers Comp are the defaults — you can add up to {MAX_TOTAL_DOCS} total.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{doc.label}</p>
              {doc.file_url && doc.file_name ? (
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate flex items-center gap-1"
                  >
                    {doc.file_name}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No document uploaded</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {doc.file_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(doc.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Label
                htmlFor={`upload-${doc.id}`}
                className="cursor-pointer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={uploading === doc.id}
                >
                  <span>
                    {uploading === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {doc.file_url ? "Replace" : "Upload"}
                  </span>
                </Button>
              </Label>
              <input
                id={`upload-${doc.id}`}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(doc.id, file);
                  e.target.value = "";
                }}
              />
              {doc.id.startsWith("custom_") && !doc.file_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCustomSlot(doc.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Add custom document slot */}
        {canAddMore && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Input
              placeholder="Document label (e.g., Umbrella Policy)"
              value={newDocLabel}
              onChange={(e) => setNewDocLabel(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomSlot()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCustomSlot}
              disabled={!newDocLabel.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}

        {!canAddMore && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Maximum of {MAX_TOTAL_DOCS} insurance documents reached
          </p>
        )}
      </CardContent>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
}
