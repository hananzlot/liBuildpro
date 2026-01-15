import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowUpRight
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
  const { data: companyNameData } = useQuery({
    queryKey: ['app-settings', 'company_name'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'company_name')
        .single();
      if (error) throw error;
      return data?.setting_value;
    },
    staleTime: 1000 * 60 * 5,
  });
  
  const companyName = companyNameData || 'Company';

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
  const remaining = displayTotal - totalPaid;

  if (!hasContent && invoices.length === 0) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <Receipt className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Invoices Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your payment schedule and invoices will appear here once an agreement is in place.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary Dashboard */}
      {displayTotal > 0 && (
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90 p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg">Payment Summary</h3>
            </div>
            
            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                <p className="text-white/60 text-sm mb-1">Total Contract</p>
                <p className="text-3xl font-bold">{formatCurrency(displayTotal)}</p>
              </div>
              <div className="bg-green-500/20 backdrop-blur-sm rounded-2xl p-5">
                <p className="text-green-200 text-sm mb-1">Amount Paid</p>
                <p className="text-3xl font-bold text-green-300">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="bg-amber-500/20 backdrop-blur-sm rounded-2xl p-5">
                <p className="text-amber-200 text-sm mb-1">Remaining</p>
                <p className="text-3xl font-bold text-amber-300">{formatCurrency(remaining)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Payment Progress</span>
                <span className="font-semibold">{Math.round(paymentProgress)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-3 bg-white/10" />
            </div>
          </div>
        </Card>
      )}

      {/* Invoices with payment status */}
      {invoices.length > 0 && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Invoices</h3>
                  <p className="text-sm text-slate-500">{invoices.length} invoice(s)</p>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {invoices.map((invoice: any) => {
                const invoicePayments = payments.filter((p: any) => p.invoice_id === invoice.id);
                const paidAmount = invoicePayments.reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0);
                const isPaid = paidAmount >= (invoice.amount || 0);
                const isPartial = paidAmount > 0 && paidAmount < (invoice.amount || 0);
                
                return (
                  <div 
                    key={invoice.id}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isPaid ? 'bg-green-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isPaid ? 'bg-green-100' : isPartial ? 'bg-amber-100' : 'bg-slate-100'
                      }`}>
                        {isPaid ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Receipt className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">Invoice #{invoice.invoice_number}</p>
                          <Badge 
                            className={`border-0 ${
                              isPaid 
                                ? 'bg-green-100 text-green-700' 
                                : isPartial 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-slate-100 text-slate-600'
                            }`}
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
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
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
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="shadow-sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setSelectedPayments(invoicePayments);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(invoice.amount)}</p>
                        {isPartial && (
                          <p className="text-xs text-slate-500">
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
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Payment Schedule</h3>
                  <p className="text-sm text-slate-500">{paymentSchedule.length} payment phase(s)</p>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {paymentSchedule.map((phase: any, index: number) => (
                <div key={phase.id} className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{phase.phase_name}</p>
                    <p className="text-sm text-slate-500">
                      {phase.description || phase.due_type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(phase.amount)}</p>
                    <p className="text-sm text-slate-500">{phase.percent}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments History */}
      {payments.length > 0 && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 border-b border-green-100 bg-green-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Payments Received</h3>
                  <p className="text-sm text-slate-500">{payments.length} payment(s) • {formatCurrency(totalPaid)} total</p>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-green-100">
              {payments.map((payment: any) => (
                <div 
                  key={payment.id}
                  className="p-5 flex items-center gap-4 bg-green-50/50"
                >
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-green-800">Payment Received</p>
                    <div className="flex flex-wrap gap-3 text-xs text-green-600">
                      <span>{format(new Date(payment.created_at), 'MMM d, yyyy')}</span>
                      {payment.bank_name && <span>• {payment.bank_name}</span>}
                      {payment.check_number && <span>• Check #{payment.check_number}</span>}
                    </div>
                  </div>
                  <p className="text-xl font-bold text-green-700 shrink-0">
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