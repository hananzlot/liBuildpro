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
  FileSpreadsheet,
  FolderOpen,
  ExternalLink,
  FileCheck,
  FilePlus,
  FileSignature
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PortalDocumentsProps {
  documents: any[];
  agreements?: any[];
  projectId: string;
  uploadLimitMb?: number;
  companyId?: string | null;
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

export function PortalDocuments({ documents, agreements = [], projectId, uploadLimitMb = 15, companyId }: PortalDocumentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const maxFileSize = uploadLimitMb * 1024 * 1024;

  // Filter to only show non-image documents
  const docs = documents.filter(doc => 
    !doc.file_type?.startsWith('image/') && 
    !/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(doc.file_name)
  );

  // Convert agreements with attachments to document format
  const agreementDocs = agreements
    .filter(agreement => agreement.attachment_url)
    .map(agreement => ({
      id: `agreement-${agreement.id}`,
      file_name: `Contract ${agreement.agreement_number || 'Agreement'}.pdf`,
      file_url: agreement.attachment_url,
      file_type: 'application/pdf',
      created_at: agreement.created_at || agreement.agreement_signed_date,
      category: 'Contract',
      isAgreement: true,
      agreementNumber: agreement.agreement_number,
      totalPrice: agreement.total_price,
    }));

  // Combine all documents
  const allDocs = [...agreementDocs, ...docs];

  const getFileConfig = (fileType: string | null, fileName: string, isAgreement?: boolean) => {
    if (isAgreement) {
      return { 
        icon: FileSignature, 
        color: 'text-emerald-600', 
        bg: 'bg-emerald-50',
        label: 'Contract'
      };
    }
    if (fileType?.includes('pdf') || fileName.endsWith('.pdf')) {
      return { 
        icon: FileText, 
        color: 'text-red-500', 
        bg: 'bg-red-50',
        label: 'PDF'
      };
    }
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet') || fileName.match(/\.(xls|xlsx|csv)$/i)) {
      return { 
        icon: FileSpreadsheet, 
        color: 'text-green-600', 
        bg: 'bg-green-50',
        label: 'Spreadsheet'
      };
    }
    if (fileType?.includes('word') || fileName.match(/\.(doc|docx)$/i)) {
      return { 
        icon: FileText, 
        color: 'text-blue-600', 
        bg: 'bg-blue-50',
        label: 'Word'
      };
    }
    return { 
      icon: File, 
      color: 'text-slate-500', 
      bg: 'bg-slate-50',
      label: 'File'
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        if (file.size > maxFileSize) {
          toast.error(`${file.name} exceeds ${uploadLimitMb}MB limit`);
          continue;
        }

        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
          toast.error(`${file.name}: Only PDF, Word, Excel, TXT, and CSV files allowed`);
          continue;
        }

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

        const { data: { publicUrl } } = supabase.storage
          .from('project-attachments')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            category: 'Customer Upload',
            notes: 'Document uploaded by customer via portal',
            company_id: companyId || null,
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

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <FolderOpen className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Project Documents</h2>
                <p className="text-white/70 text-sm mt-1">
                  {allDocs.length} document{allDocs.length !== 1 ? 's' : ''} • PDF, Word, Excel • Max {uploadLimitMb}MB
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
                variant="secondary"
                className="w-full sm:w-auto shadow-lg bg-white text-indigo-700 hover:bg-white/90"
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
        </div>
      </Card>

      {allDocs.length === 0 ? (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="py-20 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
              <FileText className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Documents Yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              Upload important documents related to your project here for easy access and sharing with the team.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="lg"
              className="shadow-lg"
            >
              <FilePlus className="h-5 w-5 mr-2" />
              Upload Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {allDocs.map((doc, index) => {
                const fileConfig = getFileConfig(doc.file_type, doc.file_name, doc.isAgreement);
                const FileIcon = fileConfig.icon;
                const isCustomerUpload = doc.category === 'Customer Upload';
                
                return (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className={`w-14 h-14 rounded-xl ${fileConfig.bg} flex items-center justify-center shrink-0 ring-1 ring-slate-200`}>
                      <FileIcon className={`h-7 w-7 ${fileConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-slate-900 truncate">{doc.file_name}</p>
                        <Badge variant="outline" className={`text-xs font-normal ${doc.isAgreement ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}`}>
                          {fileConfig.label}
                        </Badge>
                        {isCustomerUpload && (
                          <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">
                            Your Upload
                          </Badge>
                        )}
                        {doc.isAgreement && doc.totalPrice && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                            {formatCurrency(doc.totalPrice)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy • h:mm a') : 'No date'}
                        {doc.notes && doc.notes !== 'Document uploaded by customer via portal' && (
                          <span className="text-slate-400"> • {doc.notes}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="icon" asChild className="hidden sm:flex hover:bg-slate-100">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="shadow-sm">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">View</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}