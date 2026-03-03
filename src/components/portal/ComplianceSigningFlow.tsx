import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignatureCanvas } from './SignatureCanvas';
import {
  FileText,
  CheckCircle2,
  Clock,
  ChevronRight,
  Loader2,
  FileSignature,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ComplianceSigningFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  companyId: string;
  customerName: string;
  customerEmail: string;
  onAllSigned: () => void;
}

interface ComplianceDocument {
  id: string;
  template_id: string;
  document_name: string;
  document_type: 'compliance' | 'main_contract';
  file_url: string;
  status: 'pending' | 'signed';
  signed_at: string | null;
  template: {
    name: string;
    requires_separate_signature: boolean;
    is_main_contract: boolean;
  } | null;
}

export function ComplianceSigningFlow({
  open,
  onOpenChange,
  estimateId,
  companyId,
  customerName,
  customerEmail,
  onAllSigned,
}: ComplianceSigningFlowProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<'list' | 'preview' | 'sign'>('list');
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [signerName, setSignerName] = useState(customerName);
  const [signerEmail, setSignerEmail] = useState(customerEmail);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<{
    type: 'typed' | 'drawn';
    data: string;
    font?: string;
  } | null>(null);

  useEffect(() => {
    setSignerName(customerName);
    setSignerEmail(customerEmail);
  }, [customerName, customerEmail]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep('list');
      setSelectedDocument(null);
      setAgreedToTerms(false);
      setSignatureData(null);
    }
  }, [open]);

  // Fetch or generate compliance documents
  const { data: complianceDocs, isLoading, refetch } = useQuery({
    queryKey: ['compliance-signing-docs', estimateId],
    queryFn: async () => {
      // First check if documents already exist in signed_compliance_documents
      const { data: existing, error: existingError } = await supabase
        .from('signed_compliance_documents')
        .select(`
          id,
          template_id,
          document_name,
          document_type,
          file_url,
          status,
          signed_at
        `)
        .eq('estimate_id', estimateId)
        .order('created_at');

      if (existingError) throw existingError;

      // Fetch ALL active templates for this company to check for missing ones
      const { data: allTemplates } = await supabase
        .from('compliance_document_templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('display_order');

      if (existing && existing.length > 0 && allTemplates) {
        // Check if any active templates are missing from existing signed docs
        const existingTemplateIds = new Set(existing.map(d => d.template_id));
        const missingTemplates = allTemplates.filter(t => !existingTemplateIds.has(t.id));

        if (missingTemplates.length > 0) {
          // Generate docs for missing templates
          const { data: generatedDocs } = await supabase
            .from('estimate_compliance_documents')
            .select('*')
            .eq('estimate_id', estimateId);

          const generatedUrlMap = new Map(
            (generatedDocs || []).map((d: any) => [d.template_id, d.generated_file_url])
          );

          const { data: estimateData } = await supabase
            .from('estimates')
            .select('project_id')
            .eq('id', estimateId)
            .maybeSingle();

          const newDocs = missingTemplates.map(template => ({
            company_id: companyId,
            estimate_id: estimateId,
            project_id: estimateData?.project_id || null,
            template_id: template.id,
            document_name: template.name,
            document_type: template.is_main_contract ? 'main_contract' : 'compliance',
            file_url: generatedUrlMap.get(template.id) || template.template_file_url,
            status: 'pending',
          }));

          const { data: createdDocs } = await supabase
            .from('signed_compliance_documents')
            .insert(newDocs)
            .select();

          // Merge existing + newly created
          const allDocs = [...existing, ...(createdDocs || [])];
          const templateMap = new Map(allTemplates.map(t => [t.id, t]));
          return allDocs.map(doc => ({
            ...doc,
            template: templateMap.get(doc.template_id) || null,
          })) as ComplianceDocument[];
        }

        // All templates accounted for - return existing
        const templateMap = new Map(allTemplates.map(t => [t.id, t]));
        return existing.map(doc => ({
          ...doc,
          template: templateMap.get(doc.template_id) || null,
        })) as ComplianceDocument[];
      }

      // No signed_compliance_documents exist - check for generated docs in estimate_compliance_documents
      const { data: generatedDocs } = await supabase
        .from('estimate_compliance_documents')
        .select('*')
        .eq('estimate_id', estimateId);

      // Fetch active templates for this company
      const { data: templates } = await supabase
        .from('compliance_document_templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('display_order');

      if (!templates || templates.length === 0) {
        // No templates configured - return empty to trigger the "No Documents Required" UI
        return [];
      }

      // Check if we need to generate documents
      if (!generatedDocs || generatedDocs.length === 0) {
        // Call edge function to generate compliance documents
        const { data: generateResult, error: generateError } = await supabase.functions.invoke(
          'generate-compliance-documents',
          {
            body: { estimateId, companyId },
          }
        );

        if (generateError) {
          console.error('Error generating compliance documents:', generateError);
          // Continue anyway - we'll use original template URLs
        }
      }

      // Re-fetch generated docs after generation
      const { data: updatedGeneratedDocs } = await supabase
        .from('estimate_compliance_documents')
        .select('*')
        .eq('estimate_id', estimateId);

      // Create a map of template_id to generated file URL
      const generatedUrlMap = new Map(
        (updatedGeneratedDocs || []).map((d: any) => [d.template_id, d.generated_file_url])
      );

      // Get the project_id from the estimate so compliance docs are linked to the project
      const { data: estimateData } = await supabase
        .from('estimates')
        .select('project_id')
        .eq('id', estimateId)
        .maybeSingle();

      // Create signed_compliance_documents records for each template
      const docsToCreate = templates.map(template => ({
        company_id: companyId,
        estimate_id: estimateId,
        project_id: estimateData?.project_id || null,
        template_id: template.id,
        document_name: template.name,
        document_type: template.is_main_contract ? 'main_contract' : 'compliance',
        file_url: generatedUrlMap.get(template.id) || template.template_file_url,
        status: 'pending',
      }));

      const { data: createdDocs, error: createError } = await supabase
        .from('signed_compliance_documents')
        .insert(docsToCreate)
        .select();

      if (createError) {
        console.error('Error creating signed_compliance_documents:', createError);
        throw createError;
      }

      // Return created docs with template info
      const templateMap = new Map(templates.map(t => [t.id, t]));

      return (createdDocs || []).map(doc => ({
        ...doc,
        template: templateMap.get(doc.template_id) || null,
      })) as ComplianceDocument[];
    },
    enabled: open && !!estimateId && !!companyId,
  });

  // Sign document mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDocument || !signatureData) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase
        .from('signed_compliance_documents')
        .update({
          signer_name: signerName,
          signer_email: signerEmail,
          signature_data: signatureData.data,
          signature_type: signatureData.type,
          signature_font: signatureData.font || null,
          signed_at: new Date().toISOString(),
          status: 'signed',
          user_agent: navigator.userAgent,
        })
        .eq('id', selectedDocument.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Document signed successfully');
      setCurrentStep('list');
      setSelectedDocument(null);
      setSignatureData(null);
      setAgreedToTerms(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['compliance-signing-docs', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to sign: ${error.message}`);
    },
  });

  const requiredDocs = complianceDocs?.filter(d => d.document_type === 'compliance') || [];
  const mainContract = complianceDocs?.find(d => d.document_type === 'main_contract');
  
  const allRequiredSigned = requiredDocs.every(d => d.status === 'signed');
  const mainContractSigned = mainContract?.status === 'signed';
  const allComplete = allRequiredSigned && (!mainContract || mainContractSigned);

  // Check if all documents are complete
  useEffect(() => {
    if (allComplete && complianceDocs && complianceDocs.length > 0) {
      onAllSigned();
    }
  }, [allComplete, complianceDocs, onAllSigned]);

  const handleSelectDocument = (doc: ComplianceDocument) => {
    // Can't sign main contract until all required docs are signed
    if (doc.document_type === 'main_contract' && !allRequiredSigned) {
      toast.error('Please sign all required documents before the main contract');
      return;
    }
    
    if (doc.status === 'signed') {
      // Open document in new tab to view
      window.open(doc.file_url, '_blank');
      return;
    }

    setSelectedDocument(doc);
    setCurrentStep('preview');
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!complianceDocs || complianceDocs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Documents Required</DialogTitle>
            <DialogDescription>
              There are no compliance documents configured for this proposal.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => {
            // Advance the flow before closing
            onAllSigned();
            onOpenChange(false);
          }}>
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {currentStep === 'list' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Required Documents
              </DialogTitle>
              <DialogDescription>
                Please review and sign the following documents to complete your agreement.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 py-4">
                {/* Required Documents Section */}
                {requiredDocs.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Step 1: Sign Required Documents ({requiredDocs.filter(d => d.status === 'signed').length}/{requiredDocs.length})
                    </h4>
                    {requiredDocs.map((doc, index) => (
                      <Card
                        key={doc.id}
                        className={`cursor-pointer transition-colors ${
                          doc.status === 'signed'
                            ? 'bg-green-50 border-green-200'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectDocument(doc)}
                      >
                        <CardContent className="py-3 flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{doc.document_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {doc.status === 'signed' 
                                ? `Signed on ${new Date(doc.signed_at!).toLocaleDateString()}`
                                : 'Requires your signature'}
                            </p>
                          </div>
                          {doc.status === 'signed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}

                {/* Main Contract Section */}
                {mainContract && (
                  <>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Step 2: Sign Main Contract
                    </h4>
                    <Card
                      className={`cursor-pointer transition-colors ${
                        mainContract.status === 'signed'
                          ? 'bg-green-50 border-green-200'
                          : !allRequiredSigned
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-muted/50 border-primary'
                      }`}
                      onClick={() => handleSelectDocument(mainContract)}
                    >
                      <CardContent className="py-3 flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{mainContract.document_name}</p>
                            <Badge variant="default" className="text-xs">Main Contract</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {mainContract.status === 'signed' 
                              ? `Signed on ${new Date(mainContract.signed_at!).toLocaleDateString()}`
                              : !allRequiredSigned
                              ? 'Complete required documents first'
                              : 'Ready for your signature'}
                          </p>
                        </div>
                        {mainContract.status === 'signed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : !allRequiredSigned ? (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </ScrollArea>

            {allComplete && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">All Documents Signed</p>
                  <p className="text-sm text-green-600">You have completed all required signatures.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                {allComplete ? 'Done' : 'Cancel'}
              </Button>
              {!allComplete && requiredDocs.some(d => d.status === 'pending') && (
                <Button 
                  onClick={() => {
                    const firstPending = requiredDocs.find(d => d.status === 'pending');
                    if (firstPending) handleSelectDocument(firstPending);
                  }}
                  className="flex-1"
                >
                  Continue Signing
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {allRequiredSigned && mainContract && mainContract.status === 'pending' && (
                <Button onClick={() => handleSelectDocument(mainContract)} className="flex-1">
                  Sign Main Contract
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </>
        ) : currentStep === 'preview' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Review: {selectedDocument?.document_name}
              </DialogTitle>
              <DialogDescription>
                Please review the document below. Once reviewed, click "Proceed to Sign" to add your signature.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 -mx-6 px-6">
              <div className="h-[60vh] border rounded-lg overflow-hidden bg-muted/30">
                <iframe
                  src={selectedDocument?.file_url}
                  className="w-full h-full"
                  title={selectedDocument?.document_name}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep('list');
                  setSelectedDocument(null);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('sign')}
                className="flex-1"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                Proceed to Sign
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Sign: {selectedDocument?.document_name}
              </DialogTitle>
              <DialogDescription>
                Add your signature below to sign this document.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {/* Link back to preview */}
                <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{selectedDocument?.document_name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep('preview')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review Again
                  </Button>
                </div>

                <Separator />

                {/* Signer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Your full legal name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <Separator />

                {/* Signature */}
                <SignatureCanvas
                  signerName={signerName}
                  onSignatureComplete={(data) => setSignatureData(data)}
                />

                {signatureData && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">Signature captured</span>
                  </div>
                )}

                {/* Agreement Checkbox */}
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="agree"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  />
                  <label htmlFor="agree" className="text-sm cursor-pointer">
                    I have reviewed the document "{selectedDocument?.document_name}" and agree to its terms. 
                    I understand this constitutes a legally binding signature.
                  </label>
                </div>
              </div>
            </ScrollArea>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentStep('list');
                  setSelectedDocument(null);
                  setSignatureData(null);
                  setAgreedToTerms(false);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => signMutation.mutate()}
                disabled={!signatureData || !agreedToTerms || !signerName || !signerEmail || signMutation.isPending}
                className="flex-1"
              >
                {signMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Sign Document
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
