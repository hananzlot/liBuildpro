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
import { CompanyHeader } from '@/components/proposals/CompanyHeader';
import {
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  AlertCircle,
  Loader2,
  Users,
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

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  item_type: string;
  group_id: string | null;
}

interface Group {
  id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
}

interface PaymentPhase {
  id: string;
  phase_name: string;
  percent: number;
  amount: number;
  due_type: string;
  description: string | null;
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
  const [declineReason, setDeclineReason] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<{
    type: 'typed' | 'drawn';
    data: string;
    font?: string;
  } | null>(null);

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

        return {
          token: tokenData,
          estimate,
          groups: groups || [],
          lineItems: lineItems || [],
          paymentSchedule: paymentSchedule || [],
          signatures: signatures || [],
          currentSigner: signer,
          allSigners: allSigners || [],
          isMultiSigner: true,
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

        return {
          token: tokenData,
          estimate,
          groups: groups || [],
          lineItems: lineItems || [],
          paymentSchedule: paymentSchedule || [],
          signatures: signatures || [],
          signature: signatures?.[0] || null,
          isMultiSigner: false,
        };
      }
    },
  });

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

          // Update project status to "Contract Signed" if there's a linked project
          if (portalData!.estimate.project_id) {
            // Also link the project to the opportunity if not already linked
            const projectUpdate: Record<string, unknown> = {
              project_status: 'Contract Signed',
              agreement_signed_date: new Date().toISOString().split('T')[0],
            };
            
            // Link opportunity to project if estimate has opportunity_id
            if (portalData!.estimate.opportunity_id) {
              projectUpdate.opportunity_id = portalData!.estimate.opportunity_id;
            }
            if (portalData!.estimate.opportunity_uuid) {
              projectUpdate.opportunity_uuid = portalData!.estimate.opportunity_uuid;
            }
            
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

          // Update linked opportunity status to "won"
          if (portalData!.estimate.opportunity_id) {
            supabase.functions.invoke('update-ghl-opportunity', {
              body: {
                ghl_id: portalData!.estimate.opportunity_id,
                status: 'won',
                company_id: portalData!.estimate.company_id,
              },
            }).catch((err) => console.error('Failed to update opportunity status:', err));
          }

          // Send notification that all parties have signed
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
          // Send notification that this signer has signed
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

        // Update project status to "Contract Signed" if there's a linked project
        if (portalData!.estimate.project_id) {
          // Also link the project to the opportunity if not already linked
          const projectUpdate: Record<string, unknown> = {
            project_status: 'Contract Signed',
            agreement_signed_date: new Date().toISOString().split('T')[0],
          };
          
          // Link opportunity to project if estimate has opportunity_id
          if (portalData!.estimate.opportunity_id) {
            projectUpdate.opportunity_id = portalData!.estimate.opportunity_id;
          }
          if (portalData!.estimate.opportunity_uuid) {
            projectUpdate.opportunity_uuid = portalData!.estimate.opportunity_uuid;
          }
          
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

        // Update linked opportunity status to "won"
        if (portalData!.estimate.opportunity_id) {
          supabase.functions.invoke('update-ghl-opportunity', {
            body: {
              ghl_id: portalData!.estimate.opportunity_id,
              status: 'won',
              company_id: portalData!.estimate.company_id,
            },
          }).catch((err) => console.error('Failed to update opportunity status:', err));
        }

        // Send notification email to admin
        supabase.functions.invoke('send-proposal-notification', {
          body: {
            estimateId: portalData!.estimate.id,
            action: 'accepted',
            customerName: signerName,
          },
        }).catch((err) => console.error('Failed to send admin notification:', err));

        // Send confirmation email to customer
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
        // Update signer status to declined
        await supabase
          .from('estimate_signers')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason: declineReason,
          })
          .eq('id', portalData!.currentSigner.id);

        // Mark estimate as declined
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

      // Send notification email to admin
      supabase.functions.invoke('send-proposal-notification', {
        body: {
          estimateId: portalData!.estimate.id,
          action: 'declined',
          customerName: portalData!.isMultiSigner ? portalData!.currentSigner.signer_name : portalData!.estimate.customer_name,
          declineReason: declineReason,
        },
      }).catch((err) => console.error('Failed to send admin notification:', err));

      // Send confirmation email to customer
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

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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

  const { estimate, groups, lineItems, paymentSchedule, signatures } = portalData;
  const signature = portalData.signature || signatures?.[0];
  const currentSigner = portalData.currentSigner;
  const allSigners: EstimateSigner[] = portalData.allSigners || [];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'outline' },
      sent: { label: 'Awaiting Review', variant: 'secondary' },
      viewed: { label: 'Viewed', variant: 'secondary' },
      accepted: { label: 'Accepted', variant: 'default' },
      declined: { label: 'Declined', variant: 'destructive' },
      expired: { label: 'Expired', variant: 'outline' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const groupedItems = groups.reduce((acc: Record<string, LineItem[]>, group: Group) => {
    acc[group.id] = lineItems.filter((item: LineItem) => item.group_id === group.id);
    return acc;
  }, {});

  const ungroupedItems = lineItems.filter((item: LineItem) => !item.group_id);

  // Determine if current user can sign
  const canSign = portalData.isMultiSigner
    ? currentSigner && ['sent', 'viewed', 'pending'].includes(currentSigner.status)
    : ['sent', 'viewed', 'needs_changes'].includes(estimate.status);
  
  const currentSignerHasSigned = portalData.isMultiSigner && currentSigner?.status === 'signed';
  const isSigned = estimate.status === 'accepted';
  const isDeclined = estimate.status === 'declined' || (portalData.isMultiSigner && currentSigner?.status === 'declined');

  // Calculate signing progress for multi-signer
  const signedCount = allSigners.filter(s => s.status === 'signed').length;
  const totalSigners = allSigners.length;

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

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Company Header */}
        <CompanyHeader companyId={portalData?.token?.company_id || portalData?.estimate?.company_id} />

        {/* Multi-signer Progress */}
        {portalData.isMultiSigner && allSigners.length > 1 && (
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
        )}

        {/* Status Banner */}
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

        {isSigned && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Proposal Accepted</p>
                <p className="text-sm text-green-600">
                  {portalData.isMultiSigner 
                    ? `All ${totalSigners} parties have signed this agreement.`
                    : `Signed by ${signature?.signer_name} on ${format(new Date(signature?.signed_at || estimate.signed_at), 'MMM d, yyyy')}`
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isDeclined && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="py-4 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Proposal Declined</p>
                {estimate.decline_reason && (
                  <p className="text-sm text-red-600">Reason: {estimate.decline_reason}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estimate Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Proposal #{estimate.estimate_number}</p>
                <CardTitle className="text-2xl mt-1">{estimate.estimate_title}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{formatCurrency(estimate.total)}</p>
                <p className="text-sm text-muted-foreground">Total Amount</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer & Project Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PREPARED FOR</h4>
                <p className="font-medium text-lg">{estimate.customer_name}</p>
                {estimate.customer_email && (
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {estimate.customer_email}
                  </p>
                )}
                {estimate.customer_phone && (
                  <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {estimate.customer_phone}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PROJECT LOCATION</h4>
                {estimate.job_address && (
                  <p className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {estimate.job_address}
                  </p>
                )}
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                  </span>
                  {estimate.expiration_date && (
                    <span className="flex items-center gap-2 text-orange-600">
                      <Clock className="h-4 w-4" />
                      Expires: {format(new Date(estimate.expiration_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                {estimate.salesperson_name && (
                  <p className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Sales Rep: {estimate.salesperson_name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope of Work */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Scope of Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Work Scope Description */}
            {estimate.show_scope_to_customer && estimate.work_scope_description && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="whitespace-pre-wrap text-sm">{estimate.work_scope_description}</p>
              </div>
            )}
            {estimate.show_line_items_to_customer && groups.map((group: Group) => (
              <div key={group.id} className="space-y-3">
                <h4 className="font-semibold text-lg">{group.group_name}</h4>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
                <div className="space-y-2">
                {groupedItems[group.id]?.map((item: LineItem) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        {estimate.show_details_to_customer && (
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                          </p>
                        )}
                      </div>
                      <p className="font-medium">{formatCurrency(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {estimate.show_line_items_to_customer && ungroupedItems.length > 0 && (
              <div className="space-y-2">
              {ungroupedItems.map((item: LineItem) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      {estimate.show_details_to_customer && (
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                        </p>
                      )}
                    </div>
                    <p className="font-medium">{formatCurrency(item.line_total)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
              {(estimate.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax ({estimate.tax_rate}%)</span>
                  <span>{formatCurrency(estimate.tax_amount)}</span>
                </div>
              )}
              {(estimate.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(estimate.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>{formatCurrency(estimate.total)}</span>
              </div>
              {estimate.deposit_required && (estimate.deposit_amount || 0) > 0 && (
                <div className="flex justify-between text-sm font-medium text-primary">
                  <span>Deposit Due</span>
                  <span>{formatCurrency(estimate.deposit_amount)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Schedule */}
        {paymentSchedule.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentSchedule.map((phase: PaymentPhase, index: number) => (
                  <div
                    key={phase.id}
                    className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{phase.phase_name}</p>
                      {phase.description && (
                        <p className="text-sm text-muted-foreground">{phase.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(phase.amount)}</p>
                      <p className="text-sm text-muted-foreground">{phase.percent}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Terms & Conditions - Notes are internal only, not shown to customer */}
        {estimate.terms_and_conditions && (
          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{estimate.terms_and_conditions}</p>
            </CardContent>
          </Card>
        )}

        {/* Signatures Display */}
        {signatures && signatures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                {portalData.isMultiSigner ? 'Signatures' : 'Signed Document'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signatures.map((sig: any, index: number) => (
                  <div key={sig.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {portalData.isMultiSigner ? `Signer ${index + 1}:` : 'Signed by:'}
                    </p>
                    {sig.signature_type === 'typed' ? (
                      <p
                        style={{ fontFamily: sig.signature_font, fontSize: '28px' }}
                        className="text-foreground"
                      >
                        {sig.signature_data}
                      </p>
                    ) : (
                      <img
                        src={sig.signature_data}
                        alt="Signature"
                        className="max-h-20 object-contain"
                      />
                    )}
                    <p className="text-sm text-muted-foreground">
                      {sig.signer_name} • {sig.signer_email} • {format(new Date(sig.signed_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments Section */}
        {!portalData.isMultiSigner && (
          <Card>
            <CardContent className="pt-6">
              <ClientComments
                estimateId={estimate.id}
                portalTokenId={portalData.token.id}
                commenterName={estimate.customer_name}
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
                  onClick={() => setSignatureDialogOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept & Sign Proposal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
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
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">Signature captured</span>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm cursor-pointer">
                I have read and agree to the terms and conditions. I understand this constitutes a legally binding agreement.
              </label>
            </div>

            <Button
              onClick={() => signMutation.mutate()}
              disabled={!signatureData || !agreedToTerms || !signerName || !signerEmail || signMutation.isPending}
              className="w-full"
              size="lg"
            >
              {signMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Submit Signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes or Decline</DialogTitle>
            <DialogDescription>
              Let us know if you need any changes to the proposal or if you'd like to decline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Feedback / Reason</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Please describe any changes you need or your reason for declining..."
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeclineDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => declineMutation.mutate()}
                disabled={declineMutation.isPending}
                className="flex-1"
              >
                {declineMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Submit Response
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
