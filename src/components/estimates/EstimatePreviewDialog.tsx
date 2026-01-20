import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
  Building,
  Loader2,
  DollarSign,
  CheckCircle2,
  XCircle,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CompanyHeader } from '@/components/proposals/CompanyHeader';

interface EstimatePreviewDialogProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function EstimatePreviewDialog({
  estimateId,
  open,
  onOpenChange,
}: EstimatePreviewDialogProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    if (!estimateId) return;
    
    setGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { estimateId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('PDF generated successfully');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };
  const { data, isLoading } = useQuery({
    queryKey: ['estimate-preview', estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      const { data: estimate, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (error) throw error;

      const { data: groups } = await supabase
        .from('estimate_groups')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: paymentSchedule } = await supabase
        .from('estimate_payment_schedule')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: signatures } = await supabase
        .from('estimate_signatures')
        .select('*')
        .eq('estimate_id', estimateId);

      return {
        estimate,
        groups: groups || [],
        lineItems: lineItems || [],
        paymentSchedule: paymentSchedule || [],
        signatures: signatures || [],
      };
    },
    enabled: !!estimateId && open,
  });

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!open) return null;

  const estimate = data?.estimate;
  const groups = data?.groups || [];
  const lineItems = data?.lineItems || [];
  const paymentSchedule = data?.paymentSchedule || [];
  const signatures = data?.signatures || [];
  const showLineItems = estimate?.show_line_items_to_customer ?? false;
  const showDetails = estimate?.show_details_to_customer ?? false;
  const showScope = estimate?.show_scope_to_customer ?? false;

  // De-duplicate line items based on description, quantity, unit_price, and group_id
  const deduplicateItems = (items: LineItem[]): LineItem[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.description}-${item.quantity}-${item.unit_price}-${item.group_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniqueLineItems = deduplicateItems(lineItems);

  const groupedItems = groups.reduce((acc: Record<string, LineItem[]>, group: Group) => {
    acc[group.id] = uniqueLineItems.filter((item: LineItem) => item.group_id === group.id);
    return acc;
  }, {});

  const ungroupedItems = uniqueLineItems.filter((item: LineItem) => !item.group_id);

  const isSigned = estimate?.status === 'accepted';
  const isDeclined = estimate?.status === 'declined';

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'outline' },
      sent: { label: 'Awaiting Review', variant: 'secondary' },
      viewed: { label: 'Viewed', variant: 'secondary' },
      needs_changes: { label: 'Needs Changes', variant: 'secondary' },
      accepted: { label: 'Accepted', variant: 'default' },
      declined: { label: 'Declined', variant: 'destructive' },
      expired: { label: 'Expired', variant: 'outline' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="bg-background border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <DialogTitle>Customer Proposal Preview</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePdf}
                disabled={generatingPdf || !estimate}
              >
                {generatingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                View PDF
              </Button>
              {estimate && getStatusBadge(estimate.status)}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !estimate ? (
            <div className="text-center py-12 text-muted-foreground">
              Estimate not found
            </div>
          ) : (
            <div className="p-6 space-y-6 bg-muted/30">
              {/* Company Header */}
              <CompanyHeader companyId={estimate.company_id} />

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
                      <p className="text-sm text-muted-foreground">
                        Proposal #{estimate.estimate_number}
                      </p>
                      <CardTitle className="text-2xl mt-1">{estimate.estimate_title}</CardTitle>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency(estimate.total)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
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
                  {/* Work Scope Description */}
                  {showScope && estimate.work_scope_description && (
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="whitespace-pre-wrap text-sm">{estimate.work_scope_description}</p>
                    </div>
                  )}
                  {showLineItems && groups.map((group: Group) => (
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
                              {showDetails && (
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

                  {showLineItems && ungroupedItems.length > 0 && (
                    <div className="space-y-2">
                      {ungroupedItems.map((item: LineItem) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            {showDetails && (
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
                </CardContent>
              </Card>

              {/* Pricing Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Pricing Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span>Subtotal</span>
                      <span className="font-medium">{formatCurrency(estimate.subtotal)}</span>
                    </div>
                    {estimate.discount_amount && estimate.discount_amount > 0 && (
                      <div className="flex justify-between py-2 text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(estimate.discount_amount)}</span>
                      </div>
                    )}
                    {estimate.tax_amount && estimate.tax_amount > 0 && (
                      <div className="flex justify-between py-2">
                        <span>Tax ({estimate.tax_rate}%)</span>
                        <span>{formatCurrency(estimate.tax_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-t text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(estimate.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Schedule */}
              {paymentSchedule.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Payment Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {paymentSchedule.map((phase: PaymentPhase, index: number) => (
                        <div
                          key={phase.id}
                          className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">
                              {index + 1}. {phase.phase_name}
                            </p>
                            {phase.description && (
                              <p className="text-sm text-muted-foreground">{phase.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">{phase.due_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(phase.amount)}</p>
                            <p className="text-sm text-muted-foreground">{phase.percent}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Terms & Conditions */}
              {estimate.terms_and_conditions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Terms & Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                      {estimate.terms_and_conditions}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Signatures Display */}
              {signatures.length > 0 && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-5 w-5" />
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

              {/* Notes */}
              {estimate.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
