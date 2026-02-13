import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, File, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface ProposalUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  estimateNumber: number;
  customerName: string;
}

export function ProposalUploadDialog({
  open,
  onOpenChange,
  estimateId,
  estimateNumber,
  customerName,
}: ProposalUploadDialogProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch the estimate to get project_id
  const { data: estimate } = useQuery({
    queryKey: ["estimate-project", estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("project_id")
        .eq("id", estimateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!estimateId,
  });

  const projectId = estimate?.project_id;

  // Fetch existing documents
  const { data: documents = [] } = useQuery({
    queryKey: ["proposal-documents", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .eq("category", "Proposal Documents")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!projectId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) throw new Error("No project linked to this estimate");

      setIsUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${projectId}/proposal-docs/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-attachments").getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from("project_documents").insert({
        project_id: projectId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        category: "Proposal Documents",
        notes: `Uploaded for estimate #${estimateNumber}`,
        uploaded_by: user?.id || null,
        company_id: companyId,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-documents", projectId] });
      toast.success("Document uploaded successfully");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("project_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-documents", projectId] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proposal Documents</DialogTitle>
          <DialogDescription>
            Upload documents for EST-{estimateNumber} ({customerName})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!projectId ? (
            <div className="flex items-center gap-2 p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                This estimate is not linked to a project. Link it to a project in the estimate
                builder to upload documents.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Document
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                />
              </div>

              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No documents uploaded yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm truncate hover:underline text-primary"
                        >
                          {doc.file_name}
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => deleteMutation.mutate(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
