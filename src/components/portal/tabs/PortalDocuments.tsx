import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Loader2,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PortalDocumentsProps {
  documents: any[];
  projectId: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for documents
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];

export function PortalDocuments({ documents, projectId }: PortalDocumentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Filter to only show non-image documents
  const docs = documents.filter(doc => 
    !doc.file_type?.startsWith('image/') && 
    !/\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)
  );

  const getFileIcon = (fileType: string | null, fileName: string) => {
    if (fileType?.includes('pdf') || fileName.endsWith('.pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet') || fileName.match(/\.(xls|xlsx|csv)$/i)) {
      return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    }
    if (fileType?.includes('word') || fileName.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    }
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 5MB limit`);
          continue;
        }

        // Validate file type
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
          toast.error(`${file.name}: Only PDF, Word, Excel, TXT, and CSV files allowed`);
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `customer-uploads/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-attachments')
          .getPublicUrl(fileName);

        // Insert document record
        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            category: 'Customer Upload',
            notes: 'Document uploaded by customer via portal'
          });

        if (dbError) {
          console.error('DB error:', dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} document${successCount > 1 ? 's' : ''}`);
        queryClient.invalidateQueries({ queryKey: ['project-portal'] });
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload documents');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with upload button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Project Documents</h2>
          <p className="text-sm text-muted-foreground">
            Upload documents related to your project (PDF, Word, Excel, TXT, CSV). Max 5MB per file.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </>
            )}
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No Documents Yet</h3>
            <p className="text-muted-foreground mb-4">
              You can upload documents related to your project here.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {getFileIcon(doc.file_type, doc.file_name)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{doc.file_name}</p>
                      {doc.category === 'Customer Upload' && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Your Upload
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                      {doc.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate">{doc.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.file_url} download={doc.file_name} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
