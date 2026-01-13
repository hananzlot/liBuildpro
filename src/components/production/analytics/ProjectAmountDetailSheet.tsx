import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { cn, formatCurrency } from "@/lib/utils";
import { Printer, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AmountType = 'contract' | 'collected' | 'billsPaid' | 'cashPosition' | 'arBalance';

interface ProjectAmountDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectNumber: number;
  projectName: string;
  amountType: AmountType | null;
}

const AMOUNT_TITLES: Record<AmountType, string> = {
  contract: 'Contract Details',
  collected: 'Payments Collected',
  billsPaid: 'Bills Paid',
  cashPosition: 'Cash Position Breakdown',
  arBalance: 'Outstanding Invoices (AR)',
};

const AMOUNT_DESCRIPTIONS: Record<AmountType, string> = {
  contract: 'Agreements and contracts for this project',
  collected: 'All received payments for this project',
  billsPaid: 'All paid bills and vendor payments',
  cashPosition: 'Collected payments minus bills paid',
  arBalance: 'Unpaid invoice balances',
};

export function ProjectAmountDetailSheet({
  open,
  onOpenChange,
  projectId,
  projectNumber,
  projectName,
  amountType,
}: ProjectAmountDetailSheetProps) {
  // Fetch agreements
  const { data: agreements = [] } = useQuery({
    queryKey: ["project-agreements-detail", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_agreements")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && amountType === 'contract',
  });

  // Fetch payments with payment phase details
  const { data: payments = [] } = useQuery({
    queryKey: ["project-payments-detail", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_payments")
        .select(`
          *,
          payment_phase:project_payment_phases(phase_name, description)
        `)
        .eq("project_id", projectId)
        .eq("is_voided", false);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && (amountType === 'collected' || amountType === 'cashPosition'),
  });

  // Fetch project address for collected payments
  const { data: project } = useQuery({
    queryKey: ["project-address", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("project_address")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && amountType === 'collected',
  });

  // Fetch bills and bill payments
  const { data: bills = [] } = useQuery({
    queryKey: ["project-bills-detail", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_bills")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_voided", false);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && (amountType === 'billsPaid' || amountType === 'cashPosition'),
  });

  // Fetch invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ["project-invoices-detail", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_invoices")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && amountType === 'arBalance',
  });

  if (!amountType || !projectId) return null;

  const receivedPayments = payments.filter(p => p.payment_status === 'Received');
  const totalCollected = receivedPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalBillsPaid = bills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{AMOUNT_TITLES[amountType]}</SheetTitle>
              <SheetDescription>
                #{projectNumber} - {projectName}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="no-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {/* Contract Details */}
          {amountType === 'contract' && (
            <ContractContent agreements={agreements} />
          )}

          {/* Collected Payments */}
          {amountType === 'collected' && (
            <CollectedContent 
              payments={receivedPayments} 
              total={totalCollected} 
              projectAddress={project?.project_address || null}
            />
          )}

          {/* Bills Paid */}
          {amountType === 'billsPaid' && (
            <BillsPaidContent bills={bills} total={totalBillsPaid} projectName={projectName} />
          )}

          {/* Cash Position Breakdown */}
          {amountType === 'cashPosition' && (
            <CashPositionContent 
              payments={receivedPayments} 
              bills={bills}
              totalCollected={totalCollected}
              totalBillsPaid={totalBillsPaid}
            />
          )}

          {/* AR Balance */}
          {amountType === 'arBalance' && (
            <ARBalanceContent invoices={invoices} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Contract Content
function ContractContent({ agreements }: { agreements: any[] }) {
  const total = agreements.reduce((sum, a) => sum + (a.total_price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Badge variant="outline" className="bg-primary/10 text-primary">
          Total: {formatCurrency(total)}
        </Badge>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agreement #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date Signed</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agreements.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.agreement_number || '-'}</TableCell>
                <TableCell>{a.agreement_type || '-'}</TableCell>
                <TableCell>
                  {a.agreement_signed_date ? new Date(a.agreement_signed_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{a.description_of_work || '-'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(a.total_price || 0)}</TableCell>
              </TableRow>
            ))}
            {agreements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No agreements found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Collected Content
function CollectedContent({ 
  payments, 
  total,
  projectAddress 
}: { 
  payments: any[]; 
  total: number;
  projectAddress: string | null;
}) {
  const [groupByProject, setGroupByProject] = useState(false);

  // For single project view, grouping doesn't make sense - but we'll keep the toggle for consistency
  // In reality, this is most useful when viewing across multiple projects
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Toggle 
          pressed={groupByProject} 
          onPressedChange={setGroupByProject}
          size="sm"
          className="gap-2"
        >
          <Layers className="h-4 w-4" />
          Group by Project
        </Toggle>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
          Total Collected: {formatCurrency(total)}
        </Badge>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project Address</TableHead>
              <TableHead>Payment Phase</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Check #</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.projected_received_date ? new Date(p.projected_received_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={projectAddress || '-'}>
                  {projectAddress || '-'}
                </TableCell>
                <TableCell>
                  {p.payment_phase?.description || p.payment_phase?.phase_name || p.payment_schedule || '-'}
                </TableCell>
                <TableCell>{p.bank_name || '-'}</TableCell>
                <TableCell>{p.check_number || '-'}</TableCell>
                <TableCell className="text-right font-medium text-emerald-600">
                  {formatCurrency(p.payment_amount || 0)}
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No payments received
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Bills Paid Content
function BillsPaidContent({ bills, total, projectName }: { bills: any[]; total: number; projectName: string }) {
  const [groupByVendor, setGroupByVendor] = useState(false);
  const paidBills = bills.filter(b => (b.amount_paid || 0) > 0);

  // Group bills by vendor
  const groupedBills = useMemo(() => {
    if (!groupByVendor) return null;
    
    const groups: Record<string, { vendor: string; category: string; bills: any[]; total: number }> = {};
    
    paidBills.forEach(bill => {
      const vendor = bill.installer_company || 'Unknown Vendor';
      if (!groups[vendor]) {
        groups[vendor] = {
          vendor,
          category: bill.category || '-',
          bills: [],
          total: 0,
        };
      }
      groups[vendor].bills.push(bill);
      groups[vendor].total += (bill.amount_paid || 0);
    });
    
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [paidBills, groupByVendor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Toggle 
          pressed={groupByVendor} 
          onPressedChange={setGroupByVendor}
          size="sm"
          className="gap-2"
        >
          <Layers className="h-4 w-4" />
          Group by Vendor
        </Toggle>
        <Badge variant="outline" className="bg-red-500/10 text-red-600">
          Total Paid: {formatCurrency(total)}
        </Badge>
      </div>

      {groupByVendor && groupedBills ? (
        <div className="space-y-4">
          {groupedBills.map((group) => (
            <div key={group.vendor} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">{group.vendor}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {group.category}
                  </Badge>
                </div>
                <span className="font-medium text-red-600">{formatCurrency(group.total)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Ref</TableHead>
                    <TableHead className="text-right">Bill Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.bills.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.bill_ref || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.bill_amount || 0)}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(b.amount_paid || 0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(b.balance || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          {groupedBills.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              No bills paid
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Vendor Type</TableHead>
                <TableHead>Bill Ref</TableHead>
                <TableHead className="text-right">Bill Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paidBills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.installer_company || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {b.category || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.bill_ref || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(b.bill_amount || 0)}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {formatCurrency(b.amount_paid || 0)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(b.balance || 0)}
                  </TableCell>
                </TableRow>
              ))}
              {paidBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No bills paid
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// Cash Position Content
function CashPositionContent({ 
  payments, 
  bills, 
  totalCollected, 
  totalBillsPaid 
}: { 
  payments: any[]; 
  bills: any[];
  totalCollected: number;
  totalBillsPaid: number;
}) {
  const cashPosition = totalCollected - totalBillsPaid;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Collected:</span>
          <span className="font-medium text-emerald-600">+{formatCurrency(totalCollected)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Bills Paid:</span>
          <span className="font-medium text-red-600">-{formatCurrency(totalBillsPaid)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="font-medium">Cash Position:</span>
          <span className={cn("font-bold", cashPosition >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {formatCurrency(cashPosition)}
          </span>
        </div>
      </div>

      {/* Payments */}
      <div>
        <h4 className="font-medium mb-2 text-emerald-600">Payments Received ({payments.length})</h4>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.projected_received_date ? new Date(p.projected_received_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{p.payment_schedule || p.bank_name || 'Payment'}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    +{formatCurrency(p.payment_amount || 0)}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No payments
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Bills Paid */}
      <div>
        <h4 className="font-medium mb-2 text-red-600">Bills Paid ({bills.filter(b => (b.amount_paid || 0) > 0).length})</h4>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Bill Ref</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.filter(b => (b.amount_paid || 0) > 0).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.installer_company || '-'}</TableCell>
                  <TableCell>{b.bill_ref || '-'}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    -{formatCurrency(b.amount_paid || 0)}
                  </TableCell>
                </TableRow>
              ))}
              {bills.filter(b => (b.amount_paid || 0) > 0).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No bills paid
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// AR Balance Content
function ARBalanceContent({ invoices }: { invoices: any[] }) {
  const unpaidInvoices = invoices.filter(i => (i.open_balance || 0) > 0);
  const total = unpaidInvoices.reduce((sum, i) => sum + (i.open_balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
          Total Outstanding: {formatCurrency(total)}
        </Badge>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unpaidInvoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.invoice_number || '-'}</TableCell>
                <TableCell>
                  {i.invoice_date ? new Date(i.invoice_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(i.amount || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(i.payments_received || 0)}</TableCell>
                <TableCell className="text-right font-medium text-amber-600">
                  {formatCurrency(i.open_balance || 0)}
                </TableCell>
              </TableRow>
            ))}
            {unpaidInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No outstanding invoices
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
