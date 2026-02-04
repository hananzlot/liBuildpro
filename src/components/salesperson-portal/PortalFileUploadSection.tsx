import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, Image, FileText, Loader2, ChevronDown, ChevronUp, Eye, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PdfViewerDialog } from "@/components/production/PdfViewerDialog";
interface PortalFileUploadSectionProps {
  salespersonName: string;
  salespersonId: string;
  salespersonGhlUserId?: string;
  companyId: string;
}

interface Project {
  id: string;
  project_number: number | null;
  project_name: string | null;
  project_address: string | null;
}

interface ProjectDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string | null;
  created_at: string;
  notes: string | null;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // iPhone camera formats (often uploaded as HEIC/HEIF)
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export function PortalFileUploadSection({ 
  salespersonName, 
  salespersonId,
  salespersonGhlUserId,
  companyId 
}: PortalFileUploadSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ProjectDocument | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch projects where this salesperson is assigned (directly or via opportunity)
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["salesperson-portal-upload-projects", salespersonName, salespersonId, salespersonGhlUserId, companyId],
    queryFn: async () => {
      if (!salespersonName || !companyId) return [];

      // Step 1: Get projects directly assigned to salesperson by name
      const { data: directProjects, error: directError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address")
        .eq("company_id", companyId)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .is("deleted_at", null);

      if (directError) throw directError;

      // Step 2: Get projects linked via opportunity assignment ONLY if no salesperson is assigned
      let opportunityProjects: typeof directProjects = [];
      
      if (salespersonGhlUserId) {
        // Get opportunities assigned to this salesperson
        const { data: opportunities } = await supabase
          .from("opportunities")
          .select("id, ghl_id")
          .eq("company_id", companyId)
          .eq("assigned_to", salespersonGhlUserId);

        if (opportunities?.length) {
          const oppUuids = opportunities.map(o => o.id);
          const oppGhlIds = opportunities.map(o => o.ghl_id).filter(Boolean) as string[];

          // Build OR filter for projects linked to these opportunities
          const uuidFilters = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(',');
          const ghlIdFilters = oppGhlIds.length ? oppGhlIds.map(id => `opportunity_id.eq.${id}`).join(',') : '';
          const combinedFilter = ghlIdFilters ? `${uuidFilters},${ghlIdFilters}` : uuidFilters;

          // Only include projects with NO salesperson assigned
          const { data: linkedProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .or(combinedFilter);

          // Filter to only include projects without any salesperson assigned
          opportunityProjects = (linkedProjects || [])
            .filter(p => 
              !p.primary_salesperson && 
              !p.secondary_salesperson && 
              !p.tertiary_salesperson && 
              !p.quaternary_salesperson
            )
            .map(({ primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, ...rest }) => rest);
        }
      }

      // Step 3: Merge and deduplicate
      const projectMap = new Map<string, (typeof directProjects)[0]>();
      [...(directProjects || []), ...opportunityProjects].forEach(p => {
        if (!projectMap.has(p.id)) {
          projectMap.set(p.id, p);
        }
      });

      return Array.from(projectMap.values())
        .sort((a, b) => (b.project_number || 0) - (a.project_number || 0)) as Project[];
    },
    enabled: !!salespersonName && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch documents for selected project
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["salesperson-portal-project-documents", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];

      const { data, error } = await supabase
        .from("project_documents")
        .select("id, file_name, file_url, file_type, category, created_at, notes")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ProjectDocument[];
    },
    enabled: !!selectedProjectId,
    staleTime: 2 * 60 * 1000,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProjectId) return;

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 15MB limit`);
        continue;
      }

      const fileExt = (file.name.split(".").pop() || "").toLowerCase();
      const isLikelyImage = file.type.startsWith("image/") || /^(jpg|jpeg|png|webp|gif|heic|heif)$/.test(fileExt);
      const inferredType = file.type || (isLikelyImage ? `image/${fileExt || "jpeg"}` : "");

      if (!ALLOWED_TYPES.includes(inferredType)) {
        toast.error(
          `${file.name}: Unsupported file type${fileExt ? ` (.${fileExt})` : ""}. ` +
            "Try JPEG/PNG, or set iPhone Camera > Formats > Most Compatible."
        );
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setNoteDialogOpen(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadWithNote = async () => {
    if (pendingFiles.length === 0 || !selectedProjectId) return;

    setNoteDialogOpen(false);
    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of pendingFiles) {
        const fileExt = (file.name.split(".").pop() || "").toLowerCase();
        const isLikelyImage = file.type.startsWith("image/") || /^(jpg|jpeg|png|webp|gif|heic|heif)$/.test(fileExt);
        const inferredType = file.type || (isLikelyImage ? `image/${fileExt || "jpeg"}` : "");

        const fileName = `salesperson-uploads/${selectedProjectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt || "bin"}`;

        const { error: uploadError } = await supabase.storage
          .from("project-attachments")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(uploadError.message || `Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("project-attachments")
          .getPublicUrl(fileName);

        const isImage = inferredType.startsWith("image/");
        const noteText = uploadNote.trim() 
          ? `${uploadNote.trim()} (Uploaded by ${salespersonName} via portal)`
          : `Uploaded by ${salespersonName} via portal`;

        const { error: dbError } = await supabase
          .from("project_documents")
          .insert({
            project_id: selectedProjectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: inferredType,
            category: isImage ? "Salesperson Photo" : "Salesperson Upload",
            notes: noteText,
            company_id: companyId,
            uploaded_by: null,
          });

        if (dbError) {
          console.error("DB error:", dbError);
          toast.error(dbError.message || `Failed to save ${file.name}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`);
        setUploadNote("");
        setPendingFiles([]);
        queryClient.invalidateQueries({ queryKey: ["salesperson-portal-project-documents", selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ["project-portal"] });
        queryClient.invalidateQueries({ queryKey: ["project-photos", selectedProjectId] });
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setNoteDialogOpen(false);
    setUploadNote("");
    setPendingFiles([]);
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.startsWith("image/")) {
      return <Image className="h-4 w-4 text-primary" />;
    }
    if (fileType?.includes("pdf")) {
      return <FileText className="h-4 w-4 text-destructive" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
      <CardHeader
        className="pb-3 pt-4 px-4 cursor-pointer bg-gradient-to-r from-primary/5 to-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Upload Files</CardTitle>
              <p className="text-xs text-muted-foreground">
                {projects.length > 0 ? `${projects.length} projects` : "Photos & documents"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <Badge variant="secondary" className="font-medium">{projects.length}</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {projectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No projects assigned yet</p>
            </div>
          ) : (
            <>
              {/* Project Selector */}
              <div onClick={(e) => e.stopPropagation()}>
                <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="truncate">
                          #{project.project_number} - {project.project_name || project.project_address || "Untitled"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectId && (
                <>
                  {/* Upload Button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Photos or Files
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      Images, PDFs, Word docs • Max 15MB
                    </p>
                  </div>

                  {/* Recent Uploads */}
                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : documents.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent uploads</p>
                      <ScrollArea className="max-h-[280px]">
                        <div className="grid grid-cols-3 gap-2">
                          {documents.slice(0, 12).map((doc) => {
                            const isImage = doc.file_type?.startsWith("image/");
                            return (
                              <div
                                key={doc.id}
                                className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/30 hover:border-primary/50 transition-colors"
                                onClick={() => {
                                  setSelectedDoc(doc);
                                  setViewerOpen(true);
                                }}
                              >
                                <div className="aspect-square relative">
                                  {isImage ? (
                                    <img
                                      src={doc.file_url}
                                      alt={doc.file_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                      {getFileIcon(doc.file_type)}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="p-1.5 bg-background/80 backdrop-blur-sm">
                                  {(() => {
                                    // Extract user note by removing auto-generated suffixes
                                    const cleanedNote = doc.notes
                                      ?.replace(/ \(Customer upload\)$/, '')
                                      .replace(/ \(Uploaded by .+ via portal\)$/, '')
                                      .replace(/^Uploaded by .+ via portal$/, '')
                                      .trim();
                                    
                                    return cleanedNote ? (
                                      <p className="text-[10px] truncate font-medium">{cleanedNote}</p>
                                    ) : (
                                      <p className="text-[10px] truncate text-muted-foreground">{doc.file_name}</p>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* File Viewer Dialog */}
                  {selectedDoc && (
                    <PdfViewerDialog
                      open={viewerOpen}
                      onOpenChange={setViewerOpen}
                      fileUrl={selectedDoc.file_url}
                      fileName={selectedDoc.file_name}
                      notes={selectedDoc.notes}
                    />
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      )}

      {/* Note Dialog for Upload */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => !open && handleCancelUpload()}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Add a Note</h3>
              <p className="text-sm text-muted-foreground">
                {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected. Add an optional note to describe these uploads.
              </p>
            </div>
            <Textarea
              placeholder="e.g., Before photos of kitchen area..."
              value={uploadNote}
              onChange={(e) => setUploadNote(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelUpload}>
                Cancel
              </Button>
              <Button onClick={handleUploadWithNote} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {pendingFiles.length} File{pendingFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
