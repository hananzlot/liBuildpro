import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { ComplianceDocViewerDialog } from '@/components/production/ComplianceDocViewerDialog';

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
  signature_data: string | null;
  signature_type: string | null;
  signature_font: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export function PortalSignedDocuments({ estimateId, projectId }: PortalSignedDocumentsProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SignedDocument | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['portal-signed-docs', estimateId, projectId],
    queryFn: async () => {
      // Query by project_id to get compliance docs across ALL estimates for this project
      if (projectId) {
        const { data, error } = await supabase
          .from('signed_compliance_documents')
          .select('*')
          .eq('project_id', projectId)
          .eq('status', 'signed')
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) return data as SignedDocument[];
      }

      // Fallback: query by estimate_id
      if (estimateId) {
        const { data, error } = await supabase
          .from('signed_compliance_documents')
          .select('*')
          .eq('estimate_id', estimateId)
          .eq('status', 'signed')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data as SignedDocument[];
      }

      return [];
    },
    enabled: !!(estimateId || projectId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
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

  const signedDocs = documents;

  const handleView = (doc: SignedDocument) => {
    setSelectedDoc(doc);
    setViewerOpen(true);
  };

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
                        {doc.ip_address && (
                          <p className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            IP: {doc.ip_address}
                          </p>
                        )}
                      </div>
                      {/* Render e-signature */}
                      {doc.signature_data && (
                        <div className="mt-2 p-2 bg-white rounded border border-green-200 inline-block">
                          {doc.signature_type === 'drawn' ? (
                            <img
                              src={doc.signature_data}
                              alt={`Signature by ${doc.signer_name}`}
                              className="h-10 max-w-[200px] object-contain"
                            />
                          ) : (
                            <span
                              className="text-lg italic font-semibold text-foreground"
                              style={doc.signature_font ? { fontFamily: doc.signature_font } : undefined}
                            >
                              {doc.signature_data}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(doc)}
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


      {/* Compliance Doc Viewer with Signature Certificate */}
      {selectedDoc && (
        <ComplianceDocViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          doc={selectedDoc}
        />
      )}
    </div>
  );
}
