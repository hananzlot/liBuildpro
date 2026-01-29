import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileSignature,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalSignedDocumentsProps {
  estimateId: string;
  projectId?: string;
}

interface SignedDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  signed_file_url: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  status: string;
  created_at: string;
}

export function PortalSignedDocuments({ estimateId, projectId }: PortalSignedDocumentsProps) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['portal-signed-docs', estimateId, projectId],
    queryFn: async () => {
      let query = supabase
        .from('signed_compliance_documents')
        .select('*')
        .order('created_at', { ascending: true });

      if (estimateId) {
        query = query.eq('estimate_id', estimateId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SignedDocument[];
    },
    enabled: !!(estimateId || projectId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSignature className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No signed documents yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Documents you sign will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const signedDocs = documents.filter(d => d.status === 'signed');
  const pendingDocs = documents.filter(d => d.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <FileSignature className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Document Signatures</p>
                <p className="text-sm text-muted-foreground">
                  {signedDocs.length} of {documents.length} documents signed
                </p>
              </div>
            </div>
            <Badge variant={signedDocs.length === documents.length ? 'default' : 'secondary'}>
              {signedDocs.length === documents.length ? 'Complete' : 'In Progress'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Signed Documents */}
      {signedDocs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Signed Documents
          </h3>
          {signedDocs.map((doc) => (
            <Card key={doc.id} className="bg-green-50/50 border-green-200">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-green-100">
                      <FileText className="h-4 w-4 text-green-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.document_name}</p>
                        {doc.document_type === 'main_contract' && (
                          <Badge variant="default" className="text-xs">Main Contract</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {doc.signer_name && (
                          <p className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Signed by: {doc.signer_name}
                          </p>
                        )}
                        {doc.signed_at && (
                          <p className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(doc.signed_at), 'MMM d, yyyy \'at\' h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.signed_file_url || doc.file_url, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = doc.signed_file_url || doc.file_url;
                        link.download = `${doc.document_name}.pdf`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pending Documents */}
      {pendingDocs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Pending Signatures
          </h3>
          {pendingDocs.map((doc) => (
            <Card key={doc.id} className="bg-muted/30">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.document_name}</p>
                        {doc.document_type === 'main_contract' && (
                          <Badge variant="outline" className="text-xs">Main Contract</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Awaiting your signature</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
