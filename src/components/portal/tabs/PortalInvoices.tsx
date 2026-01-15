import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Receipt, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  Calendar,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { InvoicePreviewDialog } from '../InvoicePreviewDialog';

interface PortalInvoicesProps {
  paymentSchedule: any[];
  invoices: any[];
  projectId: string;
  project?: any;
}

export function PortalInvoices({ paymentSchedule, projectId, project }: PortalInvoicesProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<any[]>([]);
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Fetch actual invoices from project_invoices with agreement and phase info
  const { data: projectInvoices } = useQuery({
    queryKey: ['portal-invoices', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_invoices')
        .select(`
          *,
          project_agreements (
            agreement_number,
            description_of_work
          ),
          project_payment_phases (
            phase_name,
            description
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch company name from settings
  const { data: companyName } = useQuery({
    queryKey: ['company-name-portal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'company_name')
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || 'Company';
    },
  });

  // Fetch payments made against the project
  const { data: projectPayments } = useQuery({
    queryKey: ['portal-payments', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_voided', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const invoices = projectInvoices || [];
  const payments = projectPayments || [];

  const hasContent = paymentSchedule.length > 0 || invoices.length > 0;

  // Calculate totals
  const totalScheduled = paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const displayTotal = totalInvoiced > 0 ? totalInvoiced : totalScheduled;
  const paymentProgress = displayTotal > 0 ? (totalPaid / displayTotal) * 100 : 0;

  if (!hasContent && invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Invoices Yet</h3>
          <p className="text-muted-foreground">
            Your payment schedule and invoices will appear here once an agreement is in place.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      {displayTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Contract</p>
                <p className="text-2xl font-bold">{formatCurrency(displayTotal)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(displayTotal - totalPaid)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium">{Math.round(paymentProgress)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices with payment status */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoices.map((invoice: any) => {
                const invoicePayments = payments.filter((p: any) => p.invoice_id === invoice.id);
                const paidAmount = invoicePayments.reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0);
                const isPaid = paidAmount >= (invoice.amount || 0);
                const isPartial = paidAmount > 0 && paidAmount < (invoice.amount || 0);
                
                return (
                  <div 
                    key={invoice.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isPaid ? 'bg-green-50 border-green-200' : ''
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Invoice #{invoice.invoice_number}</p>
                        <Badge 
                          variant={isPaid ? 'default' : isPartial ? 'secondary' : 'outline'}
                          className={isPaid ? 'bg-green-600' : ''}
                        >
                          {isPaid ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</>
                          ) : isPartial ? (
                            <><Clock className="h-3 w-3 mr-1" /> Partial</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {invoice.invoice_date && (
                          <span>Issued: {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</span>
                        )}
                        {isPaid && invoicePayments.length > 0 && (
                          <span className="text-green-600">
                            Paid: {format(new Date(invoicePayments[invoicePayments.length - 1].created_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setSelectedPayments(invoicePayments);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(invoice.amount)}</p>
                        {isPartial && (
                          <p className="text-xs text-muted-foreground">
                            Paid: {formatCurrency(paidAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Schedule (if no invoices yet, show schedule) */}
      {paymentSchedule.length > 0 && invoices.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentSchedule.map((phase: any, index: number) => (
                <div 
                  key={phase.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{phase.phase_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {phase.description || phase.due_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(phase.amount)}</p>
                    <p className="text-sm text-muted-foreground">{phase.percent}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Payments Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment: any) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-green-800">
                      Payment Received
                    </p>
                    <div className="flex gap-3 text-xs text-green-600">
                      <span>{format(new Date(payment.created_at), 'MMM d, yyyy')}</span>
                      {payment.bank_name && <span>• {payment.bank_name}</span>}
                      {payment.check_number && <span>• Check #{payment.check_number}</span>}
                    </div>
                  </div>
                  <p className="font-semibold text-lg text-green-700">
                    {formatCurrency(payment.payment_amount)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Preview Dialog */}
      <InvoicePreviewDialog
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        invoice={selectedInvoice}
        payments={selectedPayments}
        project={project}
        companyName={companyName || 'Company'}
      />
    </div>
  );
}
