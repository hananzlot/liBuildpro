import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, File, X, ExternalLink, Loader2 } from "lucide-react";

interface FileUploadProps {
  projectId: string;
  currentUrl: string | null;
  onUpload: (url: string | null) => void;
  folder?: string;
  accept?: string;
}

export function FileUpload({ 
  projectId, 
  currentUrl, 
  onUpload, 
  folder = "general",
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx"
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setIsUploading(true);
    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("project-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(data.path);

      onUpload(publicUrl);
      toast.success("File uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    
    try {
      // Extract path from URL
      const urlParts = currentUrl.split("/project-attachments/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage
          .from("project-attachments")
          .remove([filePath]);
      }
      onUpload(null);
      toast.success("File removed");
    } catch (error) {
      console.error("Remove error:", error);
      // Still clear the URL even if delete fails
      onUpload(null);
    }
  };

  const getFileName = (url: string) => {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    // Remove timestamp prefix for display
    const cleanName = fileName.replace(/^\d+-[a-z0-9]+\./, "");
    return cleanName.length > 20 ? cleanName.substring(0, 17) + "..." : cleanName;
  };

  if (currentUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded border">
        <File className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate flex-1">{getFileName(currentUrl)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => window.open(currentUrl, "_blank")}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={handleRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
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
            Upload File
          </>
        )}
      </Button>
    </div>
  );
}
