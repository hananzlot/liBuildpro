import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  Image, 
  File, 
  Trash2, 
  ExternalLink,
  Loader2,
  FolderOpen,
  Receipt,
  FileSignature,
  Plus
} from "lucide-react";

interface DocumentsSectionProps {
  projectId: string;
}

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  source: "document" | "bill" | "agreement";
}

const categoryColors: Record<string, string> = {
  "General": "bg-muted text-muted-foreground",
  "Contract": "bg-blue-500/10 text-blue-500",
  "Invoice": "bg-amber-500/10 text-amber-500",
  "Receipt": "bg-emerald-500/10 text-emerald-500",
  "Permit": "bg-purple-500/10 text-purple-500",
  "Photo": "bg-pink-500/10 text-pink-500",
  "Bill": "bg-orange-500/10 text-orange-500",
  "Agreement": "bg-indigo-500/10 text-indigo-500",
};

const getFileIcon = (fileType: string | null, fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || fileType?.startsWith('image')) {
    return <Image className="h-4 w-4" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
};

export function DocumentsSection({ projectId }: DocumentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    category: "General",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch all documents from project_documents table
  const { data: projectDocuments = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(d => ({ ...d, source: "document" as const }));
    },
  });

  // Fetch bill attachments
  const { data: billAttachments = [] } = useQuery({
    queryKey: ["project-bill-attachments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("id, installer_company, attachment_url, created_at")
        .eq("project_id", projectId)
        .not("attachment_url", "is", null);
      if (error) throw error;
      return data.map(b => ({
        id: b.id,
        file_name: b.installer_company ? `Bill - ${b.installer_company}` : "Bill Attachment",
        file_url: b.attachment_url!,
        file_type: null,
        category: "Bill",
        notes: null,
        created_at: b.created_at,
        source: "bill" as const,
      }));
    },
  });

  // Fetch agreement attachments
  const { data: agreementAttachments = [] } = useQuery({
    queryKey: ["project-agreement-attachments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, agreement_number, agreement_type, attachment_url, created_at")
        .eq("project_id", projectId)
        .not("attachment_url", "is", null);
      if (error) throw error;
      return data.map(a => ({
        id: a.id,
        file_name: a.agreement_number ? `Agreement #${a.agreement_number}` : (a.agreement_type || "Agreement"),
        file_url: a.attachment_url!,
        file_type: null,
        category: "Agreement",
        notes: null,
        created_at: a.created_at,
        source: "agreement" as const,
      }));
    },
  });

  // Combine all documents
  const allDocuments: Document[] = [
    ...projectDocuments,
    ...billAttachments,
    ...agreementAttachments,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      setIsUploading(true);
      
      // Upload to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${projectId}/documents/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(uploadData.path);

      // Create document record
      const { error: insertError } = await supabase
        .from("project_documents")
        .insert({
          project_id: projectId,
          file_name: selectedFile.name,
          file_url: publicUrl,
          file_type: selectedFile.type,
          category: uploadForm.category,
          notes: uploadForm.notes || null,
          uploaded_by: user?.id || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadForm({ category: "General", notes: "" });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget || deleteTarget.source !== "document") return;
      
      // Delete from storage
      try {
        const urlParts = deleteTarget.file_url.split("/project-attachments/");
        if (urlParts.length > 1) {
          await supabase.storage.from("project-attachments").remove([urlParts[1]]);
        }
      } catch (e) {
        console.error("Failed to delete file from storage:", e);
      }

      // Delete record
      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleDeleteClick = (doc: Document) => {
    if (doc.source !== "document") {
      toast.error("This file is attached to a bill or agreement. Edit that record to remove it.");
      return;
    }
    setDeleteTarget(doc);
    setDeleteDialogOpen(true);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium">All Project Documents</h3>
          <p className="text-xs text-muted-foreground">
            {allDocuments.length} file{allDocuments.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-3 w-3 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* Documents List */}
      <Card>
        <CardContent className="pt-4">
          {loadingDocs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : allDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-xs mt-1">Upload contracts, permits, photos, and more</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allDocuments.map((doc) => (
                <div 
                  key={`${doc.source}-${doc.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="shrink-0 p-2 rounded bg-muted">
                    {doc.source === "bill" ? (
                      <Receipt className="h-4 w-4 text-orange-500" />
                    ) : doc.source === "agreement" ? (
                      <FileSignature className="h-4 w-4 text-indigo-500" />
                    ) : (
                      getFileIcon(doc.file_type, doc.file_name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${categoryColors[doc.category || "General"] || ""}`}>
                        {doc.category || "General"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(doc.file_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {doc.source === "document" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteClick(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              {selectedFile ? `File: ${selectedFile.name}` : "Add details for the uploaded file"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select 
                value={uploadForm.category} 
                onValueChange={(v) => setUploadForm(p => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Receipt">Receipt</SelectItem>
                  <SelectItem value="Permit">Permit</SelectItem>
                  <SelectItem value="Photo">Photo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input 
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Add a description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setSelectedFile(null); }}>
              Cancel
            </Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.file_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
