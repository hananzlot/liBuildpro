import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Image, FileText, Loader2, ChevronDown, ChevronUp, Eye, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PdfViewerDialog } from "@/components/production/PdfViewerDialog";
interface PortalFileUploadSectionProps {
  salespersonName: string;
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
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export function PortalFileUploadSection({ salespersonName, companyId }: PortalFileUploadSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ProjectDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch projects where this salesperson is assigned
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["salesperson-portal-projects", salespersonName, companyId],
    queryFn: async () => {
      if (!salespersonName || !companyId) return [];

      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address")
        .eq("company_id", companyId)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .is("deleted_at", null)
        .order("project_number", { ascending: false });

      if (error) throw error;
      return data as Project[];
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
        .select("id, file_name, file_url, file_type, category, created_at")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ProjectDocument[];
    },
    enabled: !!selectedProjectId,
    staleTime: 2 * 60 * 1000,
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProjectId) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 15MB limit`);
          continue;
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: Unsupported file type`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `salesperson-uploads/${selectedProjectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("project-attachments")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("project-attachments")
          .getPublicUrl(fileName);

        const isImage = file.type.startsWith("image/");
        const { error: dbError } = await supabase
          .from("project_documents")
          .insert({
            project_id: selectedProjectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            category: isImage ? "Salesperson Photo" : "Salesperson Upload",
            notes: `Uploaded by ${salespersonName} via portal`,
            company_id: companyId,
          });

        if (dbError) {
          console.error("DB error:", dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`);
        queryClient.invalidateQueries({ queryKey: ["salesperson-portal-project-documents", selectedProjectId] });
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-1.5">
                          {documents.slice(0, 10).map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => {
                                setSelectedDoc(doc);
                                setViewerOpen(true);
                              }}
                            >
                              {getFileIcon(doc.file_type)}
                              <span className="flex-1 truncate text-xs">{doc.file_name}</span>
                              <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {format(new Date(doc.created_at), "MMM d")}
                              </span>
                            </div>
                          ))}
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
                    />
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
