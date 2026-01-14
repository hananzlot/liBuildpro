import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PortalEstimateViewProps {
  token: string;
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

export function PortalEstimateView({ token }: PortalEstimateViewProps) {
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
    queryKey: ['portal-estimate', token],
    queryFn: async () => {
      // First get the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (tokenError) throw new Error('Invalid or expired link');
      if (!tokenData.estimate_id) throw new Error('No estimate linked to this token');

      // Check expiration
      if (new Date(tokenData.expires_at) < new Date()) {
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
        signature: signatures?.[0] || null,
      };
    },
  });

  // Set initial signer info from estimate
  useEffect(() => {
    if (portalData?.estimate) {
      setSignerName(portalData.estimate.customer_name || '');
      setSignerEmail(portalData.estimate.customer_email || '');
    }
  }, [portalData]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!signatureData || !agreedToTerms) {
        throw new Error('Please complete the signature and agree to terms');
      }

      const { error: sigError } = await supabase.from('estimate_signatures').insert({
        estimate_id: portalData!.estimate.id,
        signer_name: signerName,
        signer_email: signerEmail,
        signature_type: signatureData.type,
        signature_data: signatureData.data,
        signature_font: signatureData.font,
        portal_token_id: portalData!.token.id,
      });

      if (sigError) throw sigError;

      // Update estimate status
      const { error: updateError } = await supabase
        .from('estimates')
        .update({
          status: 'accepted',
          signed_at: new Date().toISOString(),
        })
        .eq('id', portalData!.estimate.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Proposal signed successfully!');
      setSignatureDialogOpen(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('estimates')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: declineReason,
        })
        .eq('id', portalData!.estimate.id);

      if (error) throw error;
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

  const { estimate, groups, lineItems, paymentSchedule, signature } = portalData;

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

  const canSign = ['sent', 'viewed', 'needs_changes'].includes(estimate.status);
  const isSigned = estimate.status === 'accepted';
  const isDeclined = estimate.status === 'declined';

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Client Portal</span>
          </div>
          {getStatusBadge(estimate.status)}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Status Banner */}
        {isSigned && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Proposal Accepted</p>
                <p className="text-sm text-green-600">
                  Signed by {signature?.signer_name} on {format(new Date(signature?.signed_at || estimate.signed_at), 'MMM d, yyyy')}
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
            {groups.map((group: Group) => (
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
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {ungroupedItems.length > 0 && (
              <div className="space-y-2">
                {ungroupedItems.map((item: LineItem) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                      </p>
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
                  <span>Deposit Due ({estimate.deposit_percent}%)</span>
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

        {/* Terms & Notes */}
        {(estimate.terms_and_conditions || estimate.notes) && (
          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {estimate.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm whitespace-pre-wrap">{estimate.notes}</p>
                </div>
              )}
              {estimate.terms_and_conditions && (
                <div>
                  <h4 className="font-medium mb-2">Terms</h4>
                  <p className="text-sm whitespace-pre-wrap">{estimate.terms_and_conditions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Signature Display */}
        {signature && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Signed Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Signed by:</p>
                {signature.signature_type === 'typed' ? (
                  <p
                    style={{ fontFamily: signature.signature_font, fontSize: '28px' }}
                    className="text-foreground"
                  >
                    {signature.signature_data}
                  </p>
                ) : (
                  <img
                    src={signature.signature_data}
                    alt="Signature"
                    className="max-h-20 object-contain"
                  />
                )}
                <p className="text-sm text-muted-foreground">
                  {signature.signer_name} • {signature.signer_email} • {format(new Date(signature.signed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments Section */}
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

        {/* Action Buttons */}
        {canSign && (
          <div className="sticky bottom-0 bg-background border-t p-4 -mx-4">
            <div className="max-w-5xl mx-auto flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeclineDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Request Changes / Decline
              </Button>
              <Button
                className="flex-1"
                onClick={() => setSignatureDialogOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept & Sign
              </Button>
            </div>
          </div>
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
    </div>
  );
}
