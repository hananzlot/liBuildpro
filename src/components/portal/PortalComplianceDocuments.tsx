import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileSignature, 
  Eye, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalComplianceDocumentsProps {
  estimateId: string;
  companyId?: string;
  onViewDocument?: (documentUrl: string, documentName: string) => void;
}

interface ComplianceDocument {
  id: string;
  template_id: string;
  generated_file_url: string | null;
  signature_document_id: string | null;
  status: string;
  generated_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  template: {
    id: string;
    name: string;
    description: string | null;
    requires_separate_signature: boolean;
    template_file_name: string;
  };
  signature_document?: {
    id: string;
    status: string;
    signed_at: string | null;
  } | null;
}

export function PortalComplianceDocuments({ 
  estimateId, 
  companyId,
  onViewDocument 
}: PortalComplianceDocumentsProps) {
  // Fetch compliance documents for this estimate
  const { data: complianceDocs = [], isLoading } = useQuery({
    queryKey: ['portal-compliance-documents', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_compliance_documents')
        .select(`
          id,
          template_id,
          generated_file_url,
          signature_document_id,
          status,
          generated_at,
          sent_at,
          signed_at,
          template:compliance_document_templates (
            id,
            name,
            description,
            requires_separate_signature,
            template_file_name
          )
        `)
        .eq('estimate_id', estimateId);

      if (error) {
        console.error('Error fetching compliance documents:', error);
        throw error;
      }

      // For documents requiring separate signature, fetch signature status
      const docsWithSignatureStatus = await Promise.all(
        (data || []).map(async (doc: any) => {
          if (doc.signature_document_id) {
            const { data: sigDoc } = await supabase
              .from('signature_documents')
              .select('id, status, signed_at')
              .eq('id', doc.signature_document_id)
              .maybeSingle();
            
            return { ...doc, signature_document: sigDoc };
          }
          return { ...doc, signature_document: null };
        })
      );

      // Filter out docs whose templates have been deleted (null template)
      return docsWithSignatureStatus.filter((doc: any) => doc.template?.id) as ComplianceDocument[];
    },
    enabled: !!estimateId,
  });

  const getStatusConfig = (doc: ComplianceDocument) => {
    // If requires separate signature, check signature document status
    if (doc.template?.requires_separate_signature) {
      const sigStatus = doc.signature_document?.status;
      
      if (sigStatus === 'signed') {
        return {
          label: 'Signed',
          icon: CheckCircle2,
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
        };
      } else if (sigStatus === 'sent' || sigStatus === 'viewed') {
        return {
          label: 'Awaiting Signature',
          icon: Clock,
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200',
        };
      } else {
        return {
          label: 'Signature Required',
          icon: FileSignature,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
        };
      }
    }

    // For docs not requiring separate signature
    if (doc.status === 'signed' || doc.signed_at) {
      return {
        label: 'Completed',
        icon: CheckCircle2,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      };
    } else if (doc.status === 'generated') {
      return {
        label: 'Ready',
        icon: FileText,
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200',
      };
    } else {
      return {
        label: 'Pending',
        icon: Clock,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
      };
    }
  };

  const handleViewDocument = (doc: ComplianceDocument) => {
    const url = doc.generated_file_url;
    const name = doc.template?.name || 'Compliance Document';
    
    if (url) {
      if (onViewDocument) {
        onViewDocument(url, name);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  const handleDownloadDocument = (doc: ComplianceDocument) => {
    const url = doc.generated_file_url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (complianceDocs.length === 0) {
    return null; // Don't show anything if there are no compliance documents
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSignature className="h-5 w-5" />
          Required Documents
        </CardTitle>
        <p className="text-blue-100 text-sm mt-1">
          Please review and sign the following compliance documents
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {complianceDocs.map((doc) => {
            const statusConfig = getStatusConfig(doc);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={doc.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg ${statusConfig.bgColor} flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`h-5 w-5 ${statusConfig.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-foreground truncate">
                        {doc.template?.name || 'Document'}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={`${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} text-xs`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                    {doc.template?.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {doc.template.description}
                      </p>
                    )}
                    {doc.signed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signed {format(new Date(doc.signed_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(doc)}
                    disabled={!doc.generated_file_url}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadDocument(doc)}
                    disabled={!doc.generated_file_url}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info banner about signing */}
        {complianceDocs.some(doc => 
          doc.template?.requires_separate_signature && 
          doc.signature_document?.status !== 'signed'
        ) && (
          <div className="p-4 bg-amber-50 border-t border-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Additional Signatures Required
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Some documents require a separate signature. You'll receive an email with instructions for each document.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
