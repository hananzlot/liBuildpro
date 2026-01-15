import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Receipt, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  Calendar,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalInvoicesProps {
  paymentSchedule: any[];
  invoices: any[];
  projectId: string;
}

export function PortalInvoices({ paymentSchedule, invoices, projectId }: PortalInvoicesProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const hasContent = paymentSchedule.length > 0 || invoices.length > 0;

  // Calculate totals
  const totalScheduled = paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
  const paymentProgress = totalScheduled > 0 ? (totalPaid / totalScheduled) * 100 : 0;

  if (!hasContent) {
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
      {totalScheduled > 0 && (
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
                <p className="text-2xl font-bold">{formatCurrency(totalScheduled)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalScheduled - totalPaid)}</p>
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
            <div className="space-y-4">
              {paymentSchedule.map((phase, index) => {
                // Check if this phase has been paid (would need to match against invoices)
                const isPaid = false; // TODO: Match against actual payments
                
                return (
                  <div 
                    key={phase.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isPaid ? 'bg-green-50 border-green-200' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isPaid ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isPaid ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
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
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Invoice #{invoice.invoice_number}</p>
                      <Badge 
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                        className={invoice.status === 'paid' ? 'bg-green-600' : ''}
                      >
                        {invoice.status === 'paid' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> {invoice.status}</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.description}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Issued: {format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                      {invoice.paid_at && (
                        <span className="text-green-600">
                          Paid: {format(new Date(invoice.paid_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">{formatCurrency(invoice.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
