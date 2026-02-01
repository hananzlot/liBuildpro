import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SignatureCanvas } from './SignatureCanvas';
import { ClientComments } from './ClientComments';
import { ComplianceSigningFlow } from './ComplianceSigningFlow';
import {
  ProposalContent,
  getStatusBadge,
  type ProposalEstimate,
  type ProposalGroup,
  type ProposalLineItem,
  type ProposalPaymentPhase,
  type ProposalSignature,
  type ProposalPhoto,
} from '@/components/proposals/ProposalContent';
import {
  CheckCircle2,
  XCircle,
  Building,
  AlertCircle,
  Loader2,
  Users,
  FileSignature,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PortalEstimateViewProps {
  token: string;
  isMultiSigner?: boolean;
  signerId?: string;
  signerData?: {
    id: string;
    signer_name: string;
    signer_email: string;
    signer_order: number;
    status: string;
  };
}

interface EstimateSigner {
  id: string;
  signer_name: string;
  signer_email: string;
  signer_order: number;
  status: string;
  signed_at: string | null;
  signature_id: string | null;
}

export function PortalEstimateView({ token, isMultiSigner = false, signerId, signerData }: PortalEstimateViewProps) {
  const queryClient = useQueryClient();
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [complianceFlowOpen, setComplianceFlowOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [complianceComplete, setComplianceComplete] = useState(false);
  const [signatureData, setSignatureData] = useState<{
    type: 'typed' | 'drawn';
    data: string;
    font?: string;
  } | null>(null);

  // Fetch compliance package enabled setting for the company
  const [compliancePackageEnabled, setCompliancePackageEnabled] = useState(false);
  const [complianceSettingLoaded, setComplianceSettingLoaded] = useState(false);

  // Fetch token and estimate data
  const { data: portalData, isLoading, error, refetch } = useQuery({
    queryKey: ['portal-estimate', token, isMultiSigner],
    queryFn: async () => {
      if (isMultiSigner) {
        // Multi-signer flow - use estimate_portal_tokens
        const { data: tokenData, error: tokenError } = await supabase
          .from('estimate_portal_tokens')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .single();

        if (tokenError) throw new Error('Invalid or expired link');

        // Check expiration
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          throw new Error('This link has expired');
        }

        // Get signer info
        const { data: signer, error: signerError } = await supabase
          .from('estimate_signers')
          .select('*')
          .eq('id', tokenData.signer_id)
          .single();

        if (signerError) throw new Error('Signer not found');

        // Get estimate
        const { data: estimate, error: estError } = await supabase
          .from('estimates')
          .select('*')
          .eq('id', tokenData.estimate_id)
          .single();

        if (estError) throw estError;

        // Get all signers for this estimate
        const { data: allSigners } = await supabase
          .from('estimate_signers')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('signer_order', { ascending: true });

        // Get groups
        const { data: groups } = await supabase
          .from('estimate_groups')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get line items
        const { data: lineItems } = await supabase
          .from('estimate_line_items')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get payment schedule
        const { data: paymentSchedule } = await supabase
          .from('estimate_payment_schedule')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get signatures for this estimate
        const { data: signatures } = await supabase
          .from('estimate_signatures')
          .select('*')
          .eq('estimate_id', estimate.id);

        // Log view and update signer status if needed
        if (signer.status === 'sent' || signer.status === 'pending') {
          await supabase
            .from('estimate_signers')
            .update({ 
              status: 'viewed',
              viewed_at: new Date().toISOString(),
            })
            .eq('id', signer.id);
        }

        // Update access count
        await supabase
          .from('estimate_portal_tokens')
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: (tokenData.access_count || 0) + 1,
          })
          .eq('id', tokenData.id);

        // Update estimate viewed_at if not already
        if (!estimate.viewed_at) {
          await supabase
            .from('estimates')
            .update({ 
              viewed_at: new Date().toISOString(),
              status: estimate.status === 'sent' ? 'viewed' : estimate.status
            })
            .eq('id', estimate.id);
        }

        // Fetch estimate photos if estimate has a linked project
        let estimatePhotos: ProposalPhoto[] = [];
        if (estimate.project_id) {
          const { data: photos } = await supabase
            .from('project_documents')
            .select('id, file_url, file_name')
            .eq('project_id', estimate.project_id)
            .eq('category', 'Estimate Photo')
            .order('created_at', { ascending: false });
          estimatePhotos = (photos || []) as ProposalPhoto[];
        }

        return {
          token: tokenData,
          estimate: estimate as ProposalEstimate,
          groups: (groups || []) as ProposalGroup[],
          lineItems: (lineItems || []) as ProposalLineItem[],
          paymentSchedule: (paymentSchedule || []) as ProposalPaymentPhase[],
          signatures: (signatures || []) as ProposalSignature[],
          currentSigner: signer,
          allSigners: allSigners || [],
          isMultiSigner: true,
          estimatePhotos,
        };
      } else {
        // Legacy single signer flow
        const { data: tokenData, error: tokenError } = await supabase
          .from('client_portal_tokens')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .single();

        if (tokenError) throw new Error('Invalid or expired link');
        if (!tokenData.estimate_id) throw new Error('No estimate linked to this token');

        // Check expiration
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          throw new Error('This link has expired');
        }

        // Get estimate
        const { data: estimate, error: estError } = await supabase
          .from('estimates')
          .select('*')
          .eq('id', tokenData.estimate_id)
          .single();

        if (estError) throw estError;

        // Get groups
        const { data: groups } = await supabase
          .from('estimate_groups')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get line items
        const { data: lineItems } = await supabase
          .from('estimate_line_items')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get payment schedule
        const { data: paymentSchedule } = await supabase
          .from('estimate_payment_schedule')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('sort_order');

        // Get signature if exists
        const { data: signatures } = await supabase
          .from('estimate_signatures')
          .select('*')
          .eq('estimate_id', estimate.id);

        // Log view
        await supabase.from('portal_view_logs').insert({
          portal_token_id: tokenData.id,
          estimate_id: estimate.id,
          page_viewed: 'estimate',
          company_id: tokenData.company_id,
        });

        // Update access count
        await supabase
          .from('client_portal_tokens')
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: (tokenData.access_count || 0) + 1,
          })
          .eq('id', tokenData.id);

        // Update estimate viewed_at if not already
        if (!estimate.viewed_at) {
          await supabase
            .from('estimates')
            .update({ 
              viewed_at: new Date().toISOString(),
              status: estimate.status === 'sent' ? 'viewed' : estimate.status
            })
            .eq('id', estimate.id);
        }

        // Fetch estimate photos if estimate has a linked project
        let estimatePhotos: ProposalPhoto[] = [];
        if (estimate.project_id) {
          const { data: photos } = await supabase
            .from('project_documents')
            .select('id, file_url, file_name')
            .eq('project_id', estimate.project_id)
            .eq('category', 'Estimate Photo')
            .order('created_at', { ascending: false });
          estimatePhotos = (photos || []) as ProposalPhoto[];
        }

        return {
          token: tokenData,
          estimate: estimate as ProposalEstimate,
          groups: (groups || []) as ProposalGroup[],
          lineItems: (lineItems || []) as ProposalLineItem[],
          paymentSchedule: (paymentSchedule || []) as ProposalPaymentPhase[],
          signatures: (signatures || []) as ProposalSignature[],
          signature: signatures?.[0] || null,
          isMultiSigner: false,
          estimatePhotos,
        };
      }
    },
  });

  // Fetch compliance package enabled setting when we have company_id
  useEffect(() => {
    if (!portalData) return;

    const fetchComplianceSetting = async () => {
      const effectiveCompanyId = portalData.token?.company_id || portalData.estimate?.company_id;

      if (!effectiveCompanyId) {
        setCompliancePackageEnabled(false);
        setComplianceSettingLoaded(true);
        return;
      }
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', effectiveCompanyId)
        .eq('setting_key', 'compliance_package_enabled')
        .maybeSingle();
      
      if (!error) {
        const enabled = String(data?.setting_value ?? '').toLowerCase() === 'true';
        setCompliancePackageEnabled(enabled);
        setComplianceSettingLoaded(true);
      } else {
        // Fallback to template check
        const { data: template } = await supabase
          .from('compliance_document_templates')
          .select('id')
          .eq('company_id', effectiveCompanyId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        setCompliancePackageEnabled(!!template?.id);
        setComplianceSettingLoaded(true);
      }
    };
    
    fetchComplianceSetting();
  }, [portalData]);

  // Set initial signer info
  useEffect(() => {
    if (portalData) {
      if (portalData.isMultiSigner && portalData.currentSigner) {
        setSignerName(portalData.currentSigner.signer_name || '');
        setSignerEmail(portalData.currentSigner.signer_email || '');
      } else if (portalData.estimate) {
        setSignerName(portalData.estimate.customer_name || '');
        setSignerEmail(portalData.estimate.customer_email || '');
      }
    }
  }, [portalData]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!signatureData || !agreedToTerms) {
        throw new Error('Please complete the signature and agree to terms');
      }

      // Insert signature
      const { data: signatureRecord, error: sigError } = await supabase
        .from('estimate_signatures')
        .insert({
          estimate_id: portalData!.estimate.id,
          signer_name: signerName,
          signer_email: signerEmail,
          signature_type: signatureData.type,
          signature_data: signatureData.data,
          signature_font: signatureData.font,
          portal_token_id: portalData!.isMultiSigner ? null : portalData!.token.id,
          company_id: portalData!.token.company_id,
        })
        .select()
        .single();

      if (sigError) throw sigError;

      if (portalData!.isMultiSigner) {
        // Update signer status
        await supabase
          .from('estimate_signers')
          .update({
            status: 'signed',
            signed_at: new Date().toISOString(),
            signature_id: signatureRecord.id,
          })
          .eq('id', portalData!.currentSigner.id);

        // Check if all signers have signed
        const { data: allSigners } = await supabase
          .from('estimate_signers')
          .select('status')
          .eq('estimate_id', portalData!.estimate.id);

        const allSigned = allSigners?.every(s => s.status === 'signed');

        if (allSigned) {
          // All signers have signed - mark estimate as accepted
          await supabase
            .from('estimates')
            .update({
              status: 'accepted',
              signed_at: new Date().toISOString(),
            })
            .eq('id', portalData!.estimate.id);

          // Update project status
          if (portalData!.estimate.project_id) {
            const projectUpdate: Record<string, unknown> = {
              project_status: 'Contract Signed',
              agreement_signed_date: new Date().toISOString().split('T')[0],
            };
            
            await supabase
              .from('projects')
              .update(projectUpdate)
              .eq('id', portalData!.estimate.project_id);

            // Generate contract PDF
            supabase.functions.invoke('generate-contract-pdf', {
              body: {
                estimateId: portalData!.estimate.id,
                projectId: portalData!.estimate.project_id,
                signerName: signerName,
                signedAt: new Date().toISOString(),
                isMultiSigner: true,
              },
            }).catch((err) => console.error('Failed to generate contract PDF:', err));
          }

          // Send notification
          supabase.functions.invoke('send-proposal-notification', {
            body: {
              estimateId: portalData!.estimate.id,
              action: 'accepted',
              customerName: signerName,
              isMultiSigner: true,
              allSigned: true,
            },
          }).catch((err) => console.error('Failed to send admin notification:', err));
        } else {
          // Send partial sign notification
          supabase.functions.invoke('send-proposal-notification', {
            body: {
              estimateId: portalData!.estimate.id,
              action: 'partial_sign',
              customerName: signerName,
              isMultiSigner: true,
              signedCount: allSigners?.filter(s => s.status === 'signed').length || 1,
              totalSigners: allSigners?.length || 1,
            },
          }).catch((err) => console.error('Failed to send notification:', err));
        }
      } else {
        // Single signer flow - mark as accepted immediately
        await supabase
          .from('estimates')
          .update({
            status: 'accepted',
            signed_at: new Date().toISOString(),
          })
          .eq('id', portalData!.estimate.id);

        // Update project status
        if (portalData!.estimate.project_id) {
          const projectUpdate: Record<string, unknown> = {
            project_status: 'Contract Signed',
            agreement_signed_date: new Date().toISOString().split('T')[0],
          };
          
          await supabase
            .from('projects')
            .update(projectUpdate)
            .eq('id', portalData!.estimate.project_id);

          // Generate contract PDF
          supabase.functions.invoke('generate-contract-pdf', {
            body: {
              estimateId: portalData!.estimate.id,
              projectId: portalData!.estimate.project_id,
              signerName: signerName,
              signedAt: new Date().toISOString(),
            },
          }).catch((err) => console.error('Failed to generate contract PDF:', err));
        }

        // Send notifications
        supabase.functions.invoke('send-proposal-notification', {
          body: {
            estimateId: portalData!.estimate.id,
            action: 'accepted',
            customerName: signerName,
          },
        }).catch((err) => console.error('Failed to send admin notification:', err));

        supabase.functions.invoke('send-customer-confirmation', {
          body: {
            estimateId: portalData!.estimate.id,
            action: 'accepted',
            customerEmail: signerEmail || portalData!.estimate.customer_email,
            customerName: signerName,
          },
        }).catch((err) => console.error('Failed to send customer confirmation:', err));
      }
    },
    onSuccess: () => {
      toast.success('Proposal signed successfully!');
      setSignatureDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['portal-estimate', token] });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (portalData!.isMultiSigner) {
        await supabase
          .from('estimate_signers')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason: declineReason,
          })
          .eq('id', portalData!.currentSigner.id);

        await supabase
          .from('estimates')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason: `${portalData!.currentSigner.signer_name}: ${declineReason}`,
          })
          .eq('id', portalData!.estimate.id);
      } else {
        await supabase
          .from('estimates')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason: declineReason,
          })
          .eq('id', portalData!.estimate.id);
      }

      // Send notification
      supabase.functions.invoke('send-proposal-notification', {
        body: {
          estimateId: portalData!.estimate.id,
          action: 'declined',
          customerName: portalData!.isMultiSigner ? portalData!.currentSigner.signer_name : portalData!.estimate.customer_name,
          declineReason: declineReason,
        },
      }).catch((err) => console.error('Failed to send admin notification:', err));

      // Send confirmation to customer
      const customerEmail = portalData!.isMultiSigner 
        ? portalData!.currentSigner.signer_email 
        : portalData!.estimate.customer_email;
      
      if (customerEmail) {
        supabase.functions.invoke('send-customer-confirmation', {
          body: {
            estimateId: portalData!.estimate.id,
            action: 'declined',
            customerEmail,
            customerName: portalData!.isMultiSigner ? portalData!.currentSigner.signer_name : portalData!.estimate.customer_name,
          },
        }).catch((err) => console.error('Failed to send customer confirmation:', err));
      }
    },
    onSuccess: () => {
      toast.success('Response submitted');
      setDeclineDialogOpen(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Access Error</h2>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portalData) return null;

  const { estimate, groups, lineItems, paymentSchedule, signatures, estimatePhotos } = portalData;
  const currentSigner = portalData.currentSigner;
  const allSigners: EstimateSigner[] = portalData.allSigners || [];

  // Determine signing state
  const canSign = portalData.isMultiSigner
    ? currentSigner && ['sent', 'viewed', 'pending'].includes(currentSigner.status)
    : ['sent', 'viewed', 'needs_changes'].includes(estimate.status);
  
  const currentSignerHasSigned = portalData.isMultiSigner && currentSigner?.status === 'signed';
  const isSigned = estimate.status === 'accepted';
  const isDeclined = estimate.status === 'declined' || (portalData.isMultiSigner && currentSigner?.status === 'declined');
  const signedCount = allSigners.filter(s => s.status === 'signed').length;
  const totalSigners = allSigners.length;

  // Build custom header content for multi-signer progress
  const multiSignerProgress = portalData.isMultiSigner && allSigners.length > 1 ? (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Signing Progress</span>
          </div>
          <div className="grid gap-2">
            {allSigners.map((signer: EstimateSigner) => (
              <div 
                key={signer.id} 
                className={`flex items-center justify-between p-2 rounded ${
                  signer.id === currentSigner?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {signer.signer_order}
                  </div>
                  <span className="text-sm">
                    {signer.signer_name}
                    {signer.id === currentSigner?.id && (
                      <span className="text-primary ml-1">(You)</span>
                    )}
                  </span>
                </div>
                <Badge variant={
                  signer.status === 'signed' ? 'default' : 
                  signer.status === 'declined' ? 'destructive' : 
                  'secondary'
                }>
                  {signer.status === 'signed' ? 'Signed' : 
                   signer.status === 'declined' ? 'Declined' :
                   signer.status === 'viewed' ? 'Viewed' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current signer signed but waiting for others */}
      {currentSignerHasSigned && !isSigned && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">You have signed this proposal</p>
              <p className="text-sm text-blue-600">
                Waiting for {totalSigners - signedCount} more signature(s) to complete the agreement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  ) : null;

  // Build custom footer content for action buttons and comments
  const footerContent = (
    <>
      {/* Comments Section (single signer only) */}
      {!portalData.isMultiSigner && (
        <Card>
          <CardContent className="pt-6">
            <ClientComments
              estimateId={estimate.id}
              portalTokenId={portalData.token.id}
              commenterName={estimate.customer_name || ''}
              commenterEmail={estimate.customer_email || ''}
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {canSign && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="py-6">
            <div className="text-center mb-4">
              <h3 className="font-semibold text-lg">Ready to proceed?</h3>
              <p className="text-sm text-muted-foreground">
                {portalData.isMultiSigner 
                  ? `Review the proposal above and add your signature (${signedCount + 1} of ${totalSigners})`
                  : complianceComplete 
                    ? 'All required documents signed. You can now sign the proposal.'
                    : 'Review the proposal above and accept or request changes'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className="flex-1"
                size="lg"
                onClick={() => setDeclineDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Request Changes / Decline
              </Button>
              <Button
                className="flex-1"
                size="lg"
                disabled={!complianceSettingLoaded}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  if (!complianceComplete && !portalData.isMultiSigner && compliancePackageEnabled) {
                    toast.message('Opening required documents…');
                    setComplianceFlowOpen(true);
                  } else {
                    setSignatureDialogOpen(true);
                  }
                }}
              >
                {!complianceSettingLoaded ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : complianceComplete || !compliancePackageEnabled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sign Proposal
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Approve & Sign Documents
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Client Portal</span>
          </div>
          <div className="flex items-center gap-2">
            {portalData.isMultiSigner && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {signedCount}/{totalSigners} signed
              </Badge>
            )}
            {getStatusBadge(estimate.status)}
          </div>
        </div>
      </div>

      {/* Main Content - using shared ProposalContent component */}
      <div className="max-w-5xl mx-auto">
        <ProposalContent
          estimate={estimate}
          groups={groups}
          lineItems={lineItems}
          paymentSchedule={paymentSchedule}
          signatures={signatures}
          photos={estimatePhotos}
          showStatusBanner={!portalData.isMultiSigner} // Multi-signer has custom status UI
          showSalesperson={true}
          showNotes={false}
          headerContent={multiSignerProgress}
          footerContent={footerContent}
        />
      </div>

      {/* Signature Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign & Accept Proposal</DialogTitle>
            <DialogDescription>
              By signing below, you agree to the terms and scope of work outlined in this proposal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Your full legal name"
                  disabled={portalData.isMultiSigner}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={portalData.isMultiSigner}
                />
              </div>
            </div>

            <Separator />

            <SignatureCanvas
              signerName={signerName}
              onSignatureComplete={(data) => setSignatureData(data)}
            />

            {signatureData && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Your signature:</p>
                {signatureData.type === 'typed' ? (
                  <p style={{ fontFamily: signatureData.font, fontSize: '24px' }}>
                    {signatureData.data}
                  </p>
                ) : (
                  <img src={signatureData.data} alt="Your signature" className="max-h-16" />
                )}
              </div>
            )}

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the terms and conditions, scope of work, and payment schedule outlined in this proposal.
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSignatureDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => signMutation.mutate()}
                disabled={!signatureData || !agreedToTerms || !signerName || signMutation.isPending}
              >
                {signMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing...
                  </>
                ) : (
                  'Sign & Accept'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes or Decline</DialogTitle>
            <DialogDescription>
              Let us know if you'd like any changes to the proposal or if you'd prefer to decline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your feedback or reason for declining</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Please let us know what changes you'd like or why you're declining..."
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeclineDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => declineMutation.mutate()}
                disabled={!declineReason.trim() || declineMutation.isPending}
              >
                {declineMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Response'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compliance Signing Flow */}
      {!portalData.isMultiSigner && (
        <ComplianceSigningFlow
          open={complianceFlowOpen}
          onOpenChange={setComplianceFlowOpen}
          estimateId={estimate.id}
          companyId={portalData.token?.company_id || estimate.company_id || ''}
          customerName={estimate.customer_name || ''}
          customerEmail={estimate.customer_email || ''}
          onAllSigned={() => {
            setComplianceComplete(true);
            setComplianceFlowOpen(false);
            setSignatureDialogOpen(true);
          }}
        />
      )}
    </div>
  );
}
