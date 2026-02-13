import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
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
  Plus,
  Eye
} from "lucide-react";
import { PdfViewerDialog } from "./PdfViewerDialog";

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

const isImageFile = (fileType: string | null, fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || (fileType?.startsWith('image') ?? false);
};

export function DocumentsSection({ projectId }: DocumentsSectionProps) {
  const { user, isAdmin } = useAuth();
  const { companyId } = useCompanyContext();
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
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

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

  // Combine all documents, filtering out images (they belong in Photos section)
  const allDocuments: Document[] = [
    ...projectDocuments.filter(doc => 
      !doc.file_type?.startsWith('image/') && 
      !/\.(jpg|jpeg|png|gif|webp|heic|heif|jpe)$/i.test(doc.file_name)
    ),
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
          company_id: companyId,
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

  // Delete mutation - handles documents, bills, and agreements
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      
      // Delete file from storage based on source
      try {
        if (deleteTarget.source === "document") {
          const urlParts = deleteTarget.file_url.split("/project-attachments/");
          if (urlParts.length > 1) {
            await supabase.storage.from("project-attachments").remove([urlParts[1]]);
          }
        } else if (deleteTarget.source === "agreement") {
          const urlParts = deleteTarget.file_url.split("/contracts/");
          if (urlParts.length > 1) {
            await supabase.storage.from("contracts").remove([urlParts[1]]);
          }
        } else if (deleteTarget.source === "bill") {
          const urlParts = deleteTarget.file_url.split("/project-attachments/");
          if (urlParts.length > 1) {
            await supabase.storage.from("project-attachments").remove([urlParts[1]]);
          }
        }
      } catch (e) {
        console.error("Failed to delete file from storage:", e);
      }

      // Delete or update record based on source
      if (deleteTarget.source === "document") {
        const { error } = await supabase
          .from("project_documents")
          .delete()
          .eq("id", deleteTarget.id);
        if (error) throw error;
      } else if (deleteTarget.source === "agreement") {
        // Clear the attachment_url instead of deleting the agreement record
        const { error } = await supabase
          .from("project_agreements")
          .update({ attachment_url: null })
          .eq("id", deleteTarget.id);
        if (error) throw error;
      } else if (deleteTarget.source === "bill") {
        // Clear the attachment_url instead of deleting the bill record
        const { error } = await supabase
          .from("project_bills")
          .update({ attachment_url: null })
          .eq("id", deleteTarget.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-agreement-attachments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-bill-attachments", projectId] });
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
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleDeleteClick = (doc: Document) => {
    setDeleteTarget(doc);
    setDeleteDialogOpen(true);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const handleDocumentClick = (doc: Document) => {
    const ext = doc.file_name.split('.').pop()?.toLowerCase() || '';
    const isPdf = ext === 'pdf' || doc.file_type?.includes('pdf');
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || doc.file_type?.startsWith('image');
    
    if (isPdf || isImage) {
      setSelectedDocument(doc);
      setPdfViewerOpen(true);
    } else {
      window.open(doc.file_url, "_blank");
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-medium">All Project Documents</h3>
          <p className="text-[10px] text-muted-foreground">
            {allDocuments.length} file{allDocuments.length !== 1 ? "s" : ""}
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
          <Button size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-3 w-3 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-3 px-3 pb-3">
          {loadingDocs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : allDocuments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allDocuments.map((doc) => {
                const showImagePreview = isImageFile(doc.file_type, doc.file_name);
                
                return (
                  <div 
                    key={`${doc.source}-${doc.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    {/* Image preview or icon */}
                    {showImagePreview ? (
                      <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-muted">
                        <img 
                          src={doc.file_url} 
                          alt={doc.file_name}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleDocumentClick(doc)}
                        />
                      </div>
                    ) : (
                      <div className="shrink-0 p-1.5 rounded bg-muted">
                        {doc.source === "bill" ? (
                          <Receipt className="h-3 w-3 text-orange-500" />
                        ) : doc.source === "agreement" ? (
                          <FileSignature className="h-3 w-3 text-indigo-500" />
                        ) : (
                          getFileIcon(doc.file_type, doc.file_name)
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${categoryColors[doc.category || "General"] || ""}`}>
                          {doc.category || "General"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDocumentClick(doc)}
                        title="View"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(doc.file_url, "_blank")}
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteClick(doc)}
                          title={doc.source === "document" ? "Delete" : "Remove attachment"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
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
            <AlertDialogTitle>
              {deleteTarget?.source === "document" ? "Delete document?" : "Remove attachment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.source === "document" 
                ? `This will permanently delete "${deleteTarget?.file_name}". This action cannot be undone.`
                : `This will remove the attachment from "${deleteTarget?.file_name}" and delete the file from storage. The ${deleteTarget?.source} record will remain.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTarget?.source === "document" ? "Delete" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF/Image Viewer Dialog */}
      {selectedDocument && (
        <PdfViewerDialog
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          fileUrl={selectedDocument.file_url}
          fileName={selectedDocument.file_name}
        />
      )}
    </div>
  );
}
