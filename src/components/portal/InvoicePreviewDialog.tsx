import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  Clock, 
  Calendar,
  Building2,
  FileText,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';

interface Payment {
  id: string;
  payment_amount: number;
  created_at: string;
  bank_name?: string | null;
  check_number?: string | null;
  payment_method?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  amount: number | null;
  invoice_date: string | null;
  open_balance?: number | null;
  payments_received?: number | null;
}

interface Project {
  project_name?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  job_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  payments: Payment[];
  project?: Project | null;
}

export function InvoicePreviewDialog({ 
  open, 
  onOpenChange, 
  invoice, 
  payments,
  project 
}: InvoicePreviewDialogProps) {
  if (!invoice) return null;

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const invoiceAmount = invoice.amount || 0;
  const paidAmount = payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const remainingBalance = invoiceAmount - paidAmount;
  const isPaid = remainingBalance <= 0;
  const isPartial = paidAmount > 0 && paidAmount < invoiceAmount;

  const customerName = project 
    ? `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() || project.project_name
    : 'Customer';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice #{invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-between items-start">
            <Badge 
              variant={isPaid ? 'default' : isPartial ? 'secondary' : 'outline'}
              className={`text-sm px-3 py-1 ${isPaid ? 'bg-green-600' : ''}`}
            >
              {isPaid ? (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Paid in Full</>
              ) : isPartial ? (
                <><Clock className="h-4 w-4 mr-1" /> Partially Paid</>
              ) : (
                <><Clock className="h-4 w-4 mr-1" /> Payment Due</>
              )}
            </Badge>
            {invoice.invoice_date && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(invoice.invoice_date), 'MMMM d, yyyy')}
              </span>
            )}
          </div>

          {/* Customer Info */}
          {project && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Bill To</h3>
              <p className="font-semibold">{customerName}</p>
              {project.job_address && (
                <p className="text-sm text-muted-foreground">{project.job_address}</p>
              )}
              {project.customer_email && (
                <p className="text-sm text-muted-foreground">{project.customer_email}</p>
              )}
              {project.customer_phone && (
                <p className="text-sm text-muted-foreground">{project.customer_phone}</p>
              )}
            </div>
          )}

          <Separator />

          {/* Invoice Amount Summary */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Invoice Amount</span>
              <span className="font-semibold text-lg">{formatCurrency(invoiceAmount)}</span>
            </div>
            
            {paidAmount > 0 && (
              <div className="flex justify-between items-center py-2 text-green-600">
                <span>Payments Received</span>
                <span className="font-semibold">- {formatCurrency(paidAmount)}</span>
              </div>
            )}

            <Separator />

            <div className={`flex justify-between items-center py-3 ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
              <span className="font-semibold text-lg">
                {isPaid ? 'Balance Paid' : 'Balance Due'}
              </span>
              <span className="font-bold text-2xl">
                {formatCurrency(Math.max(0, remainingBalance))}
              </span>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment History
                </h3>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Payment Received</span>
                        </div>
                        <div className="flex gap-3 text-xs text-green-600">
                          <span>{format(new Date(payment.created_at), 'MMM d, yyyy')}</span>
                          {payment.payment_method && <span>• {payment.payment_method}</span>}
                          {payment.bank_name && <span>• {payment.bank_name}</span>}
                          {payment.check_number && <span>• Check #{payment.check_number}</span>}
                        </div>
                      </div>
                      <span className="font-semibold text-lg text-green-700">
                        {formatCurrency(payment.payment_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Thank you for your business!</p>
            {!isPaid && (
              <p className="mt-1">Please contact us if you have any questions about this invoice.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}