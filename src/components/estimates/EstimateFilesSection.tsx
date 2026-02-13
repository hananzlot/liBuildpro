import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useUploadLimit } from "@/hooks/useUploadLimit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Upload, FileText, Trash2, ExternalLink, Loader2, File } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EstimateFilesSectionProps {
  projectId: string;
  estimateId: string;
}

interface DocFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string | null;
}

export function EstimateFilesSection({ projectId, estimateId }: EstimateFilesSectionProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { maxMb, validateFileSize } = useUploadLimit();

  const [deleteTarget, setDeleteTarget] = useState<DocFile | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["estimate-files", projectId, estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("id, file_name, file_url, file_type, created_at")
        .eq("project_id", projectId)
        .eq("estimate_id", estimateId)
        .eq("category", "Estimate File")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocFile[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${projectId}/estimate-files/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from("project_documents").insert({
        project_id: projectId,
        estimate_id: estimateId,
        company_id: companyId,
        uploaded_by: user?.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        category: "Estimate File",
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate-files", projectId, estimateId] });
      toast.success("File uploaded successfully");
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocFile) => {
      // Delete from storage
      const urlParts = doc.file_url.split("/project-attachments/");
      if (urlParts.length > 1) {
        await supabase.storage.from("project-attachments").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate-files", projectId, estimateId] });
      toast.success("File deleted");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
      setDeleteTarget(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFileSize(file)) {
      toast.error(`File size must be less than ${maxMb}MB`);
      return;
    }

    uploadMutation.mutate(file);
    e.target.value = "";
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Estimate Files
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No files attached yet. Upload PDFs or documents to include with this estimate.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(file.file_name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  {file.created_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(file.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(file.file_url, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(file)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
