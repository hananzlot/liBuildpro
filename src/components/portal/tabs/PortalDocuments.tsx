import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Loader2,
  Download,
  File,
  FileSpreadsheet,
  FolderOpen,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PortalDocumentsProps {
  documents: any[];
  projectId: string;
  uploadLimitMb?: number;
}

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

export function PortalDocuments({ documents, projectId, uploadLimitMb = 15 }: PortalDocumentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const maxFileSize = uploadLimitMb * 1024 * 1024;

  // Filter to only show non-image documents
  const docs = documents.filter(doc => 
    !doc.file_type?.startsWith('image/') && 
    !/\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)
  );

  const getFileIcon = (fileType: string | null, fileName: string) => {
    if (fileType?.includes('pdf') || fileName.endsWith('.pdf')) {
      return <FileText className="h-6 w-6 text-red-500" />;
    }
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet') || fileName.match(/\.(xls|xlsx|csv)$/i)) {
      return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
    }
    if (fileType?.includes('word') || fileName.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-6 w-6 text-blue-600" />;
    }
    return <File className="h-6 w-6 text-slate-400" />;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > maxFileSize) {
          toast.error(`${file.name} exceeds ${uploadLimitMb}MB limit`);
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
      {/* Premium Header Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Project Documents</h2>
                <p className="text-sm text-slate-500">
                  {docs.length} document{docs.length !== 1 ? 's' : ''} • PDF, Word, Excel • Max {uploadLimitMb}MB
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
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
                className="w-full sm:w-auto shadow-md"
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
        </CardContent>
      </Card>

      {docs.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <FileText className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Documents Yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Upload important documents related to your project here for easy access.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="lg"
              className="shadow-md"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {docs.map((doc, index) => (
                <div 
                  key={doc.id} 
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    {getFileIcon(doc.file_type, doc.file_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
                      {doc.category === 'Customer Upload' && (
                        <Badge className="bg-primary/10 text-primary border-0 shrink-0 text-xs">
                          Your Upload
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      {doc.notes && doc.notes !== 'Document uploaded by customer via portal' && (
                        <> • {doc.notes}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} download={doc.file_name}>
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
