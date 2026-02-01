import React, { useState, useEffect } from 'react';
import { formatUnit } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { SignatureCanvas } from '../SignatureCanvas';
import { ComplianceSigningFlow } from '../ComplianceSigningFlow';
import { updateOpportunityValueFromEstimates } from '@/lib/estimateValueUtils';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Calendar,
  ArrowLeft,
  DollarSign,
  Shield,
  Building,
  MapPin,
  Phone,
  Mail,
  Loader2,
  FileSignature,
  Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PortalProposalsProps {
  estimates: any[];
  projectId: string;
  token: string;
  portalTokenId: string;
  onRefresh?: () => void;
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

export function PortalProposals({ estimates, projectId, token, portalTokenId, onRefresh }: PortalProposalsProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [viewingProposal, setViewingProposal] = useState(false);
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

  // Compliance flow state
  const [complianceFlowOpen, setComplianceFlowOpen] = useState(false);
  const [complianceComplete, setComplianceComplete] = useState(false);
  const [compliancePackageEnabled, setCompliancePackageEnabled] = useState(false);
  const [complianceSettingLoaded, setComplianceSettingLoaded] = useState(false);

  // Get selected estimate for compliance flow
  const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);

  // Fetch compliance package enabled setting
  useEffect(() => {
    const fetchComplianceSetting = async () => {
      // Use the selected estimate's company_id or fall back to context companyId
      const effectiveCompanyId = selectedEstimate?.company_id || companyId;

      console.log('[Compliance-Proposals] Fetching setting for company:', effectiveCompanyId);

      if (!effectiveCompanyId) {
        console.log('[Compliance-Proposals] No company ID found, disabling compliance');
        setCompliancePackageEnabled(false);
        setComplianceSettingLoaded(true);
        return;
      }
      
      // Try direct database query first (RLS allows anonymous access to compliance_package_enabled)
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', effectiveCompanyId)
        .eq('setting_key', 'compliance_package_enabled')
        .maybeSingle();
      
      console.log('[Compliance-Proposals] company_settings query result:', { data, error });
      
      if (!error && data) {
        const enabled = String(data.setting_value ?? '').toLowerCase() === 'true';
        console.log('[Compliance-Proposals] Setting enabled from company_settings:', enabled);
        setCompliancePackageEnabled(enabled);
        setComplianceSettingLoaded(true);
        return;
      }
      
      // Fallback 1: check if company has any active compliance templates (RLS allows portal visitors)
      if (!error || error.code === 'PGRST116') {
        console.log('[Compliance-Proposals] No setting found, checking for active templates');
        const { data: template, error: templateError } = await supabase
          .from('compliance_document_templates')
          .select('id')
          .eq('company_id', effectiveCompanyId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!templateError) {
          const enabled = !!template?.id;
          console.log('[Compliance-Proposals] Setting enabled from templates:', enabled);
          setCompliancePackageEnabled(enabled);
          setComplianceSettingLoaded(true);
          return;
        }
      }
      
      // Fallback 2: use Edge Function (bypasses RLS completely)
      console.log('[Compliance-Proposals] Using Edge Function fallback');
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('portal-compliance-enabled', {
          body: { token },
        });

        console.log('[Compliance-Proposals] portal-compliance-enabled result:', { fnData, fnError });

        if (!fnError && typeof fnData?.enabled === 'boolean') {
          setCompliancePackageEnabled(fnData.enabled);
          setComplianceSettingLoaded(true);
          return;
        }
      } catch (e) {
        console.warn('[Compliance-Proposals] portal-compliance-enabled invoke failed:', e);
      }
      
      // Final fallback: disable compliance
      console.log('[Compliance-Proposals] All methods failed, disabling compliance');
      setCompliancePackageEnabled(false);
      setComplianceSettingLoaded(true);
    };
    
    // Only fetch when we're viewing a proposal
    if (viewingProposal && selectedEstimateId) {
      fetchComplianceSetting();
    }
  }, [viewingProposal, selectedEstimateId, selectedEstimate?.company_id, companyId, token]);

  // Reset compliance state when changing proposals
  useEffect(() => {
    if (!viewingProposal) {
      setComplianceComplete(false);
      setComplianceSettingLoaded(false);
    }
  }, [viewingProposal]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { 
      label: string; 
      bgColor: string; 
      textColor: string; 
      icon: React.ReactNode;
      ringColor: string;
    }> = {
      draft: { 
        label: 'Draft', 
        bgColor: 'bg-slate-100', 
        textColor: 'text-slate-700',
        icon: <FileText className="h-3.5 w-3.5" />,
        ringColor: 'ring-slate-200'
      },
      sent: { 
        label: 'Awaiting Review', 
        bgColor: 'bg-amber-50', 
        textColor: 'text-amber-700',
        icon: <Clock className="h-3.5 w-3.5" />,
        ringColor: 'ring-amber-200'
      },
      viewed: { 
        label: 'Viewed', 
        bgColor: 'bg-blue-50', 
        textColor: 'text-blue-700',
        icon: <Eye className="h-3.5 w-3.5" />,
        ringColor: 'ring-blue-200'
      },
      accepted: { 
        label: 'Accepted', 
        bgColor: 'bg-green-50', 
        textColor: 'text-green-700',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        ringColor: 'ring-green-200'
      },
      declined: { 
        label: 'Declined', 
        bgColor: 'bg-red-50', 
        textColor: 'text-red-700',
        icon: <XCircle className="h-3.5 w-3.5" />,
        ringColor: 'ring-red-200'
      },
      expired: { 
        label: 'Expired', 
        bgColor: 'bg-slate-100', 
        textColor: 'text-slate-600',
        icon: <Clock className="h-3.5 w-3.5" />,
        ringColor: 'ring-slate-200'
      },
    };
    return config[status] || config.draft;
  };

  // Fetch full estimate details when viewing
  const { data: estimateDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['estimate-details', selectedEstimateId],
    queryFn: async () => {
      if (!selectedEstimateId) return null;

      // Get the estimate's project_id for photos
      const estimateForPhotos = estimates.find(e => e.id === selectedEstimateId);
      const estimateProjectId = estimateForPhotos?.project_id || projectId;

      const [groupsRes, itemsRes, scheduleRes, signaturesRes, photosRes] = await Promise.all([
        supabase.from('estimate_groups').select('*').eq('estimate_id', selectedEstimateId).order('sort_order'),
        supabase.from('estimate_line_items').select('*').eq('estimate_id', selectedEstimateId).order('sort_order'),
        supabase.from('estimate_payment_schedule').select('*').eq('estimate_id', selectedEstimateId).order('sort_order'),
        supabase.from('estimate_signatures').select('*').eq('estimate_id', selectedEstimateId),
        // Fetch estimate photos scoped to this specific estimate
        estimateProjectId 
          ? supabase.from('project_documents').select('id, file_url, file_name').eq('project_id', estimateProjectId).eq('category', 'Estimate Photo').eq('estimate_id', selectedEstimateId).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      return {
        groups: groupsRes.data || [],
        lineItems: itemsRes.data || [],
        paymentSchedule: scheduleRes.data || [],
        signatures: signaturesRes.data || [],
        photos: photosRes.data || [],
      };
    },
    enabled: !!selectedEstimateId && viewingProposal,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!signatureData || !agreedToTerms || !selectedEstimateId) {
        throw new Error('Please complete the signature and agree to terms');
      }

      const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);

      const { error: sigError } = await supabase.from('estimate_signatures').insert({
        estimate_id: selectedEstimateId,
        signer_name: signerName,
        signer_email: signerEmail,
        signature_type: signatureData.type,
        signature_data: signatureData.data,
        signature_font: signatureData.font,
        portal_token_id: portalTokenId,
        company_id: companyId,
      });

      if (sigError) throw sigError;

      const { error: updateError } = await supabase
        .from('estimates')
        .update({
          status: 'accepted',
          signed_at: new Date().toISOString(),
        })
        .eq('id', selectedEstimateId);

      if (updateError) throw updateError;

      // UPDATE OPPORTUNITY VALUE AND LINK
      if (selectedEstimate && companyId) {
        const opportunityUuid = selectedEstimate.opportunity_uuid;
        const opportunityGhlId = selectedEstimate.opportunity_id;

        if (opportunityUuid || opportunityGhlId) {
          // Generate the proposal link URL
          const baseUrl = window.location.origin;
          const proposalLink = `${baseUrl}/portal/${token}`;

          // Update opportunity with aggregated value and proposal link
          try {
            // First update the opportunity value using the utility
            await updateOpportunityValueFromEstimates(
              opportunityUuid,
              opportunityGhlId,
              companyId
            );

            // Also update the proposal link in the local opportunity record
            if (opportunityUuid) {
              await supabase
                .from('opportunities')
                .update({ proposal_link: proposalLink })
                .eq('id', opportunityUuid);
            } else if (opportunityGhlId) {
              await supabase
                .from('opportunities')
                .update({ proposal_link: proposalLink })
                .eq('ghl_id', opportunityGhlId)
                .eq('company_id', companyId);
            }

            console.log('Updated opportunity with proposal link and aggregated value');
          } catch (err) {
            console.error('Failed to update opportunity:', err);
          }
        }
      }

      // AUTO-CREATE AGREEMENT AND UPDATE PROJECT
      if (projectId && selectedEstimate) {
        const signedDate = new Date().toISOString().split('T')[0];
        
        // Create project agreement with the contract details
        await supabase.from('project_agreements').insert({
          project_id: projectId,
          agreement_number: `CNT-${selectedEstimate.estimate_number}`,
          agreement_signed_date: signedDate,
          agreement_type: 'Contract',
          total_price: selectedEstimate.total || 0,
          description_of_work: selectedEstimate.work_scope_description || selectedEstimate.estimate_title,
          company_id: companyId,
        }).then(result => {
          if (result.error) console.error('Failed to create agreement:', result.error);
        });

        // Update project status to "New Job" and set agreement signed date
        await supabase.from('projects').update({
          project_status: 'New Job',
          agreement_signed_date: signedDate,
        }).eq('id', projectId).then(result => {
          if (result.error) console.error('Failed to update project:', result.error);
        });
      }

      // Generate contract PDF and attach to agreement
      supabase.functions.invoke('generate-contract-pdf', {
        body: {
          estimateId: selectedEstimateId,
          projectId: projectId,
          signerName: signerName,
          signedAt: new Date().toISOString(),
        },
      }).then(result => {
        if (result.error) {
          console.error('Failed to generate contract PDF:', result.error);
        } else {
          console.log('Contract PDF generated:', result.data);
        }
      }).catch(console.error);

      // Send notifications
      supabase.functions.invoke('send-proposal-notification', {
        body: {
          estimateId: selectedEstimateId,
          action: 'accepted',
          customerName: signerName,
        },
      }).catch(console.error);

      if (signerEmail || selectedEstimate?.customer_email) {
        supabase.functions.invoke('send-customer-confirmation', {
          body: {
            estimateId: selectedEstimateId,
            action: 'accepted',
            customerEmail: signerEmail || selectedEstimate?.customer_email,
            customerName: signerName,
          },
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      toast.success('Proposal signed successfully!');
      setSignatureDialogOpen(false);
      setSignatureData(null);
      setAgreedToTerms(false);
      queryClient.invalidateQueries({ queryKey: ['estimate-details'] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEstimateId) return;
      
      const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);

      const { error } = await supabase
        .from('estimates')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: declineReason,
        })
        .eq('id', selectedEstimateId);

      if (error) throw error;

      // Update opportunity value after decline (to exclude this estimate from the total)
      if (selectedEstimate && companyId) {
        const opportunityUuid = selectedEstimate.opportunity_uuid;
        const opportunityGhlId = selectedEstimate.opportunity_id;

        if (opportunityUuid || opportunityGhlId) {
          try {
            await updateOpportunityValueFromEstimates(
              opportunityUuid,
              opportunityGhlId,
              companyId
            );
            console.log('Updated opportunity value after estimate decline');
          } catch (err) {
            console.error('Failed to update opportunity value after decline:', err);
          }
        }
      }

      supabase.functions.invoke('send-proposal-notification', {
        body: {
          estimateId: selectedEstimateId,
          action: 'declined',
          customerName: selectedEstimate?.customer_name,
          declineReason,
        },
      }).catch(console.error);

      if (selectedEstimate?.customer_email) {
        supabase.functions.invoke('send-customer-confirmation', {
          body: {
            estimateId: selectedEstimateId,
            action: 'declined',
            customerEmail: selectedEstimate.customer_email,
            customerName: selectedEstimate.customer_name,
          },
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      toast.success('Response submitted');
      setDeclineDialogOpen(false);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['estimate-details'] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Viewing a specific proposal - show full details
  if (viewingProposal && selectedEstimateId) {
    const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);
    if (!selectedEstimate) return null;

    const canSign = ['sent', 'viewed', 'needs_changes'].includes(selectedEstimate.status);
    const isSigned = selectedEstimate.status === 'accepted';
    const isDeclined = selectedEstimate.status === 'declined';
    const statusConfig = getStatusConfig(selectedEstimate.status);

    // Set signer info from estimate if not already set
    if (!signerName && selectedEstimate.customer_name) {
      setSignerName(selectedEstimate.customer_name);
    }
    if (!signerEmail && selectedEstimate.customer_email) {
      setSignerEmail(selectedEstimate.customer_email);
    }

    const groups = estimateDetails?.groups || [];
    const lineItems = estimateDetails?.lineItems || [];
    const paymentSchedule = estimateDetails?.paymentSchedule || [];
    const signatures = estimateDetails?.signatures || [];
    const photos = estimateDetails?.photos || [];
    

    const groupedItems = groups.reduce((acc: Record<string, LineItem[]>, group: Group) => {
      acc[group.id] = lineItems.filter((item: LineItem) => item.group_id === group.id);
      return acc;
    }, {});

    const ungroupedItems = lineItems.filter((item: LineItem) => !item.group_id);

    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            setViewingProposal(false);
            setSignerName('');
            setSignerEmail('');
          }}
          className="gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Proposals
        </Button>

        {/* Status Banner */}
        {isSigned && signatures.length > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Proposal Accepted</p>
                <p className="text-sm text-green-600">
                  Signed by {signatures.length} {signatures.length === 1 ? 'party' : 'parties'}
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
                {selectedEstimate.decline_reason && (
                  <p className="text-sm text-red-600">Reason: {selectedEstimate.decline_reason}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proposal Header */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary/70" />
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Proposal #{selectedEstimate.estimate_number}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{selectedEstimate.estimate_title}</h3>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0 gap-1.5`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PREPARED FOR</h4>
                <p className="font-medium text-lg">{selectedEstimate.customer_name}</p>
                {selectedEstimate.customer_email && (
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {selectedEstimate.customer_email}
                  </p>
                )}
                {selectedEstimate.customer_phone && (
                  <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selectedEstimate.customer_phone}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PROJECT LOCATION</h4>
                {selectedEstimate.job_address && (
                  <p className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedEstimate.job_address}
                  </p>
                )}
                {selectedEstimate.salesperson_name && (
                  <p className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Sales Rep: {selectedEstimate.salesperson_name}
                  </p>
                )}
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(selectedEstimate.estimate_date), 'MMM d, yyyy')}
                  </span>
                  {selectedEstimate.expiration_date && (
                    <span className="flex items-center gap-2 text-orange-600">
                      <Clock className="h-4 w-4" />
                      Expires: {format(new Date(selectedEstimate.expiration_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis (Project Understanding & Assumptions) */}
        {(() => {
          const ai = (selectedEstimate as any)?.ai_analysis as
            | {
                project_understanding?: string[];
                assumptions?: string[];
                inclusions?: string[];
                exclusions?: string[];
              }
            | null;

          const hasAny =
            !!ai &&
            ((ai.project_understanding?.length ?? 0) > 0 ||
              (ai.assumptions?.length ?? 0) > 0 ||
              (ai.inclusions?.length ?? 0) > 0 ||
              (ai.exclusions?.length ?? 0) > 0);

          if (!hasAny) return null;

          const renderBullets = (items?: string[]) => {
            if (!items || items.length === 0) return null;
            return (
              <ul className="mt-2 space-y-1 text-sm">
                {items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="whitespace-pre-wrap">{item}</span>
                  </li>
                ))}
              </ul>
            );
          };

          return (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Project Understanding & Assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(ai.project_understanding?.length ?? 0) > 0 && (
                  <section>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Project Understanding
                    </h4>
                    {renderBullets(ai.project_understanding)}
                  </section>
                )}

                {(ai.assumptions?.length ?? 0) > 0 && (
                  <section>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Assumptions
                    </h4>
                    {renderBullets(ai.assumptions)}
                  </section>
                )}

                {(((ai.inclusions?.length ?? 0) > 0) || ((ai.exclusions?.length ?? 0) > 0)) && (
                  <section className="grid md:grid-cols-2 gap-6">
                    {(ai.inclusions?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Inclusions
                        </h4>
                        {renderBullets(ai.inclusions)}
                      </div>
                    )}
                    {(ai.exclusions?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Exclusions
                        </h4>
                        {renderBullets(ai.exclusions)}
                      </div>
                    )}
                  </section>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Scope of Work */}
        {loadingDetails ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Scope of Work
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Work Scope Description */}
                {selectedEstimate.show_scope_to_customer && selectedEstimate.work_scope_description && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="whitespace-pre-wrap text-sm">{selectedEstimate.work_scope_description}</p>
                  </div>
                )}

                {selectedEstimate.show_line_items_to_customer && groups.map((group: Group) => (
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
                            {selectedEstimate.show_details_to_customer && (
                              <p className="text-sm text-muted-foreground">
                                {item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)}
                              </p>
                            )}
                          </div>
                          {selectedEstimate.show_details_to_customer && (
                            <p className="font-medium">{formatCurrency(item.line_total)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {selectedEstimate.show_line_items_to_customer && ungroupedItems.length > 0 && (
                  <div className="space-y-2">
                    {ungroupedItems.map((item: LineItem) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          {selectedEstimate.show_details_to_customer && (
                            <p className="text-sm text-muted-foreground">
                              {item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)}
                            </p>
                          )}
                        </div>
                        {selectedEstimate.show_details_to_customer && (
                          <p className="font-medium">{formatCurrency(item.line_total)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Summary */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedEstimate.subtotal)}</span>
                  </div>
                  {selectedEstimate.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedEstimate.discount_amount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(selectedEstimate.total)}</span>
                  </div>
                  {selectedEstimate.deposit_required && selectedEstimate.deposit_percent > 0 && (
                    <div className="flex justify-between text-sm bg-primary/10 p-3 rounded-lg">
                      <span>Deposit</span>
                      <span className="font-medium">
                        {formatCurrency(Math.min((selectedEstimate.total || 0) * (selectedEstimate.deposit_percent / 100), (selectedEstimate as any).deposit_max_amount || 1000))}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Schedule */}
            {paymentSchedule.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Payment Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paymentSchedule.map((phase: PaymentPhase, index: number) => (
                      <div
                        key={phase.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{phase.phase_name}</p>
                            {phase.description && (
                              <p className="text-sm text-muted-foreground">{phase.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{phase.percent}%</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency((selectedEstimate.total || 0) * (phase.percent / 100))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project Photos */}
            {photos.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Project Photos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {photos.map((photo: { id: string; file_url: string; file_name: string | null }) => (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-lg overflow-hidden border bg-muted"
                      >
                        <img
                          src={photo.file_url}
                          alt={photo.file_name || 'Project photo'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Terms & Conditions */}
            {selectedEstimate.terms_and_conditions && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedEstimate.terms_and_conditions}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Signatures Display */}
            {signatures.length > 0 && (
              <Card className="border-0 shadow-lg bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <Shield className="h-5 w-5" />
                    Digital Signatures ({signatures.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {signatures.map((sig: any, index: number) => (
                    <div key={sig.id} className={`space-y-2 ${index > 0 ? 'pt-4 border-t border-green-200' : ''}`}>
                      <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                        <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                        Signer {index + 1}
                      </div>
                      {sig.signature_type === 'typed' ? (
                        <p style={{ fontFamily: sig.signature_font, fontSize: '28px' }}>
                          {sig.signature_data}
                        </p>
                      ) : (
                        <img src={sig.signature_data} alt={`Signature by ${sig.signer_name}`} className="max-h-20" />
                      )}
                      <p className="text-sm text-green-700">
                        Signed by: {sig.signer_name}
                      </p>
                      <p className="text-sm text-green-700">
                        Email: {sig.signer_email}
                      </p>
                      <p className="text-sm text-green-700">
                        Date: {format(new Date(sig.signed_at), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  ))}
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
                      {complianceComplete 
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

                        // If compliance is enabled and not yet complete, open compliance flow first
                        if (!complianceComplete && compliancePackageEnabled) {
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
        )}

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

        {/* Compliance Signing Flow */}
        {selectedEstimateId && selectedEstimate && (
          <ComplianceSigningFlow
            open={complianceFlowOpen}
            onOpenChange={setComplianceFlowOpen}
            estimateId={selectedEstimateId}
            companyId={selectedEstimate.company_id || companyId || ''}
            customerName={signerName || selectedEstimate.customer_name || ''}
            customerEmail={signerEmail || selectedEstimate.customer_email || ''}
            onAllSigned={() => {
              setComplianceComplete(true);
              setComplianceFlowOpen(false);
              // Automatically open the main proposal signature dialog
              setSignatureDialogOpen(true);
            }}
          />
        )}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Proposals Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your proposals will appear here once they are sent to you for review.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stats
  const totalValue = estimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const acceptedCount = estimates.filter(e => e.status === 'accepted').length;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{estimates.length}</p>
                <p className="text-xs text-slate-500">Total Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{acceptedCount}</p>
                <p className="text-xs text-slate-500">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
                <p className="text-xs text-slate-500">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {estimates.map((estimate) => {
          const signature = estimate.estimate_signatures?.[0];
          const statusConfig = getStatusConfig(estimate.status);
          const isAccepted = estimate.status === 'accepted';
          const isDeclined = estimate.status === 'declined';
          
          return (
            <Card 
              key={estimate.id} 
              className={`border-0 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
                isAccepted ? 'ring-2 ring-green-200' : ''
              }`}
            >
              {isAccepted && (
                <div className="h-1 bg-gradient-to-r from-green-400 to-green-600" />
              )}
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Proposal Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0 gap-1.5 ring-1 ${statusConfig.ringColor}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                      <span className="text-sm text-slate-400 font-mono">
                        #{estimate.estimate_number}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900">{estimate.estimate_title}</h3>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Created {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                      </span>
                      {estimate.sent_at && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          Sent {format(new Date(estimate.sent_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount & Action */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        {formatCurrency(estimate.total)}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shadow-sm"
                      onClick={() => {
                        setSelectedEstimateId(estimate.id);
                        setViewingProposal(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>

                {/* Status Details */}
                {(isAccepted || isDeclined) && (
                  <div className={`mt-6 rounded-xl p-5 ${isAccepted ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isAccepted && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">Proposal Accepted</span>
                        </div>
                        {signature && (
                          <div className="grid sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Signed By</p>
                              <p className="text-green-800 font-medium">{signature.signer_name}</p>
                              {signature.signer_email && (
                                <p className="text-green-600 text-xs">{signature.signer_email}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Date</p>
                              <p className="text-green-800 font-medium">
                                {format(new Date(signature.signed_at), 'MMM d, yyyy')}
                              </p>
                              <p className="text-green-600 text-xs">
                                {format(new Date(signature.signed_at), 'h:mm a')}
                              </p>
                            </div>
                            {signature.ip_address && (
                              <div>
                                <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Verification</p>
                                <p className="text-green-800 font-medium flex items-center gap-1.5">
                                  <Shield className="h-3.5 w-3.5" />
                                  Digitally Signed
                                </p>
                                <p className="text-green-600 text-xs">IP: {signature.ip_address}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {isDeclined && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-700">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">Proposal Declined</span>
                        </div>
                        <div className="text-sm text-red-700 space-y-1">
                          {estimate.declined_at && (
                            <p>
                              <span className="text-red-600/70">Date:</span>{' '}
                              {format(new Date(estimate.declined_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          )}
                          {estimate.decline_reason && (
                            <p>
                              <span className="text-red-600/70">Reason:</span>{' '}
                              {estimate.decline_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}