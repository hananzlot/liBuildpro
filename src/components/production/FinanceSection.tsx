import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  DollarSign,
  FileText,
  CreditCard,
  Receipt,
  Loader2,
  Paperclip,
  Check,
  ChevronsUpDown,
  AlertCircle
} from "lucide-react";
import { FileUpload } from "./FileUpload";

interface FinanceSectionProps {
  projectId: string;
  estimatedCost: number | null;
  totalPl: number | null;
  onUpdateProject: (updates: { estimated_cost?: number; total_pl?: number }) => void;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  total_expected: number | null;
  payments_received: number | null;
  open_balance: number | null;
  agreement_id: string | null;
  payment_phase_id: string | null;
}

interface Payment {
  id: string;
  bank_name: string | null;
  projected_received_date: string | null;
  payment_schedule: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_fee: number | null;
  check_number: string | null;
  deposit_verified: boolean | null;
  invoice_id: string | null;
  payment_phase_id: string | null;
}

interface PaymentPhase {
  id: string;
  project_id: string | null;
  agreement_id: string | null;
  phase_name: string;
  description: string | null;
  due_date: string | null;
  amount: number | null;
}

interface BillPayment {
  id: string;
  bill_id: string;
  payment_date: string | null;
  payment_amount: number;
  payment_method: string | null;
  payment_reference: string | null;
}

interface Bill {
  id: string;
  installer_company: string | null;
  category: string | null;
  bill_ref: string | null;
  bill_amount: number | null;
  amount_paid: number | null;
  balance: number | null;
  memo: string | null;
  attachment_url: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  agreement_id: string | null;
}

interface Agreement {
  id: string;
  agreement_number: string | null;
  agreement_type: string | null;
  agreement_signed_date: string | null;
  total_price: number | null;
  description_of_work: string | null;
  attachment_url: string | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
};

export function FinanceSection({ projectId, estimatedCost, totalPl, onUpdateProject }: FinanceSectionProps) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState("agreements");
  
  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [editingPhase, setEditingPhase] = useState<PaymentPhase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  // Fetch data
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["project-invoices", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["project-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: bills = [], isLoading: loadingBills } = useQuery({
    queryKey: ["project-bills", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Bill[];
    },
  });

  const { data: agreements = [], isLoading: loadingAgreements } = useQuery({
    queryKey: ["project-agreements", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agreement[];
    },
  });

  const { data: paymentPhases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ["project-payment-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payment_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as PaymentPhase[];
    },
  });

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaymentsReceived = payments.filter(p => p.payment_status === "Received").reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalBills = bills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
  const totalBillsPaid = bills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const totalAgreementsValue = agreements.reduce((sum, a) => sum + (a.total_price || 0), 0);

  // Helper functions to check phase status
  const getPhaseInvoiceStatus = (phaseId: string) => {
    const phaseInvoices = invoices.filter(inv => inv.payment_phase_id === phaseId);
    const totalInvoicedForPhase = phaseInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return { invoices: phaseInvoices, totalInvoiced: totalInvoicedForPhase };
  };

  const getPhasePaymentStatus = (phaseId: string) => {
    const phasePayments = payments.filter(p => p.payment_phase_id === phaseId && p.payment_status === "Received");
    const totalReceivedForPhase = phasePayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    return { payments: phasePayments, totalReceived: totalReceivedForPhase };
  };

  // Calculate phases total by contract
  const getPhasesTotalByAgreement = (agreementId: string) => {
    return paymentPhases
      .filter(p => p.agreement_id === agreementId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  // Invoice mutations
  const saveInvoiceMutation = useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      if (editingInvoice?.id) {
        const { error } = await supabase
          .from("project_invoices")
          .update(invoice)
          .eq("id", editingInvoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_invoices")
          .insert({ ...invoice, project_id: projectId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingInvoice?.id ? "Invoice updated" : "Invoice created");
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["all-project-invoices"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId], refetchType: 'all' });
      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Payment mutations
  const savePaymentMutation = useMutation({
    mutationFn: async (payment: Partial<Payment>) => {
      if (editingPayment?.id) {
        const { error } = await supabase
          .from("project_payments")
          .update(payment)
          .eq("id", editingPayment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_payments")
          .insert({ ...payment, project_id: projectId });
        if (error) throw error;
      }

      // Update invoice balance if payment is linked to an invoice
      if (payment.invoice_id) {
        // Get all payments for this invoice
        const { data: invoicePayments } = await supabase
          .from("project_payments")
          .select("payment_amount, payment_status")
          .eq("invoice_id", payment.invoice_id);
        
        const totalReceived = (invoicePayments || [])
          .filter(p => p.payment_status === "Received")
          .reduce((sum, p) => sum + (p.payment_amount || 0), 0);

        // Get invoice amount
        const { data: invoice } = await supabase
          .from("project_invoices")
          .select("amount")
          .eq("id", payment.invoice_id)
          .single();

        if (invoice) {
          const openBalance = (invoice.amount || 0) - totalReceived;
          await supabase
            .from("project_invoices")
            .update({ payments_received: totalReceived, open_balance: openBalance })
            .eq("id", payment.invoice_id);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingPayment?.id ? "Payment updated" : "Payment created");
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-invoices"] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Bill mutations - updated to handle bill payments
  const saveBillMutation = useMutation({
    mutationFn: async ({ bill, billPayments }: { bill: Partial<Bill>; billPayments: Omit<BillPayment, 'id' | 'bill_id'>[] }) => {
      const totalPaid = billPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      const balance = (bill.bill_amount || 0) - totalPaid;
      
      if (editingBill?.id) {
        const { error } = await supabase
          .from("project_bills")
          .update({ ...bill, amount_paid: totalPaid, balance })
          .eq("id", editingBill.id);
        if (error) throw error;
        
        // Delete existing payments and re-insert
        await supabase.from("bill_payments").delete().eq("bill_id", editingBill.id);
        
        if (billPayments.length > 0) {
          const { error: paymentsError } = await supabase
            .from("bill_payments")
            .insert(billPayments.map(p => ({ ...p, bill_id: editingBill.id })));
          if (paymentsError) throw paymentsError;
        }
      } else {
        const { data: newBill, error } = await supabase
          .from("project_bills")
          .insert({ ...bill, amount_paid: totalPaid, balance, project_id: projectId })
          .select()
          .single();
        if (error) throw error;
        
        if (billPayments.length > 0) {
          const { error: paymentsError } = await supabase
            .from("bill_payments")
            .insert(billPayments.map(p => ({ ...p, bill_id: newBill.id })));
          if (paymentsError) throw paymentsError;
        }
      }
    },
    onSuccess: () => {
      toast.success(editingBill?.id ? "Bill updated" : "Bill created");
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setBillDialogOpen(false);
      setEditingBill(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Agreement mutations
  const saveAgreementMutation = useMutation({
    mutationFn: async (agreement: Partial<Agreement>) => {
      if (editingAgreement?.id) {
        const { error } = await supabase
          .from("project_agreements")
          .update(agreement)
          .eq("id", editingAgreement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_agreements")
          .insert({ ...agreement, project_id: projectId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAgreement?.id ? "Agreement updated" : "Agreement created");
      queryClient.invalidateQueries({ queryKey: ["project-agreements", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-agreements"] });
      setAgreementDialogOpen(false);
      setEditingAgreement(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Payment Phase mutations
  const savePhaseMutation = useMutation({
    mutationFn: async (phase: Partial<PaymentPhase>) => {
      if (editingPhase?.id) {
        const { error } = await supabase
          .from("project_payment_phases")
          .update({
            phase_name: phase.phase_name,
            description: phase.description,
            due_date: phase.due_date,
            amount: phase.amount,
            agreement_id: phase.agreement_id,
          })
          .eq("id", editingPhase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_payment_phases")
          .insert({
            project_id: projectId,
            phase_name: phase.phase_name || "New Phase",
            description: phase.description,
            due_date: phase.due_date,
            amount: phase.amount,
            agreement_id: phase.agreement_id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPhase?.id ? "Phase updated" : "Phase created");
      queryClient.invalidateQueries({ queryKey: ["project-payment-phases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
      setPhaseDialogOpen(false);
      setEditingPhase(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const table = deleteTarget.type === "invoice" ? "project_invoices" 
        : deleteTarget.type === "payment" ? "project_payments" 
        : deleteTarget.type === "agreement" ? "project_agreements"
        : deleteTarget.type === "phase" ? "project_payment_phases"
        : "project_bills";
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted successfully");
      const queryKey = deleteTarget?.type === "phase" 
        ? ["project-payment-phases", projectId]
        : [`project-${deleteTarget?.type}s`, projectId];
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate global queries for main list refresh
      if (deleteTarget?.type === "phase") {
        queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
      } else if (deleteTarget?.type === "agreement") {
        queryClient.invalidateQueries({ queryKey: ["all-project-agreements"] });
      } else if (deleteTarget?.type === "invoice") {
        queryClient.invalidateQueries({ queryKey: ["all-project-invoices"] });
      } else if (deleteTarget?.type === "payment") {
        queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      } else if (deleteTarget?.type === "bill") {
        queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const handleDeleteClick = (type: string, id: string) => {
    setDeleteTarget({ type, id });
    setDeleteDialogOpen(true);
  };

  // Calculate profitability by agreement
  const agreementProfitability = agreements.map(agreement => {
    const agreementPhases = paymentPhases.filter(p => p.agreement_id === agreement.id);
    const agreementInvoices = invoices.filter(inv => inv.agreement_id === agreement.id);
    const totalInvoicedForAgreement = agreementInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // Get payments for these invoices
    const invoiceIds = agreementInvoices.map(inv => inv.id);
    const agreementPayments = payments.filter(p => p.invoice_id && invoiceIds.includes(p.invoice_id) && p.payment_status === "Received");
    const collectedForAgreement = agreementPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    
    const phasesTotal = agreementPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const uninvoiced = (agreement.total_price || 0) - totalInvoicedForAgreement;
    const uncollected = totalInvoicedForAgreement - collectedForAgreement;

    return {
      id: agreement.id,
      agreementNumber: agreement.agreement_number,
      agreementType: agreement.agreement_type,
      totalPrice: agreement.total_price || 0,
      phasesTotal,
      phasesMatch: phasesTotal === (agreement.total_price || 0),
      invoiced: totalInvoicedForAgreement,
      collected: collectedForAgreement,
      uninvoiced,
      uncollected,
    };
  });

  return (
    <div className="space-y-4">
      {/* Profitability by Agreement */}
      {agreements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Profitability by Contract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Contract</TableHead>
                  <TableHead className="text-xs text-right">Sold</TableHead>
                  <TableHead className="text-xs text-right">Invoiced</TableHead>
                  <TableHead className="text-xs text-right">Collected</TableHead>
                  <TableHead className="text-xs text-right">Uninvoiced</TableHead>
                  <TableHead className="text-xs text-right">Uncollected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreementProfitability.map((ap) => (
                  <TableRow key={ap.id}>
                    <TableCell className="text-xs font-medium">
                      {ap.agreementNumber || ap.agreementType || "Contract"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(ap.totalPrice)}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {formatCurrency(ap.invoiced)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-emerald-600">
                      {formatCurrency(ap.collected)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-amber-600">
                      {formatCurrency(ap.uninvoiced)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-amber-600">
                      {formatCurrency(ap.uncollected)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">
                    {formatCurrency(totalAgreementsValue)}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {formatCurrency(totalInvoiced)}
                  </TableCell>
                  <TableCell className="text-xs text-right text-emerald-600">
                    {formatCurrency(totalPaymentsReceived)}
                  </TableCell>
                  <TableCell className="text-xs text-right text-amber-600">
                    {formatCurrency(totalAgreementsValue - totalInvoiced)}
                  </TableCell>
                  <TableCell className="text-xs text-right text-amber-600">
                    {formatCurrency(totalInvoiced - totalPaymentsReceived)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Sold</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(totalAgreementsValue)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Invoiced</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(totalInvoiced)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Payments Received</span>
          </div>
          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totalPaymentsReceived)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Bills Outstanding</span>
          </div>
          <p className="text-lg font-semibold text-amber-600">{formatCurrency(totalBills - totalBillsPaid)}</p>
        </Card>
      </div>

      {/* Sub-tabs for Agreements, Phases, Invoices, Payments, Bills */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agreements" className="text-xs">
            Contracts ({agreements.length})
          </TabsTrigger>
          <TabsTrigger value="phases" className="text-xs">
            Phases ({paymentPhases.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            Pmts Recvd ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="bills" className="text-xs">
            Bills ({bills.length})
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Invoices</CardTitle>
                <Button size="sm" onClick={() => { setEditingInvoice(null); setInvoiceDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvoices ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-xs">{inv.invoice_number || "-"}</TableCell>
                        <TableCell className="text-xs">{formatDate(inv.invoice_date)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(inv.open_balance)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingInvoice(inv); setInvoiceDialogOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("invoice", inv.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Payments</CardTitle>
                <Button size="sm" onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Bank</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((pmt) => (
                      <TableRow key={pmt.id}>
                        <TableCell className="text-xs">{pmt.bank_name || "-"}</TableCell>
                        <TableCell className="text-xs">{formatDate(pmt.projected_received_date)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={
                            pmt.payment_status === "Received" ? "bg-emerald-500/10 text-emerald-500" :
                            pmt.payment_status === "Pending" ? "bg-amber-500/10 text-amber-500" :
                            "bg-muted"
                          }>
                            {pmt.payment_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(pmt.payment_amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPayment(pmt); setPaymentDialogOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("payment", pmt.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Bills</CardTitle>
                <Button size="sm" onClick={() => { setEditingBill(null); setBillDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBills ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : bills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bills yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="text-xs">{bill.installer_company || "-"}</TableCell>
                        <TableCell className="text-xs">{bill.category || "-"}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(bill.bill_amount)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(bill.balance)}</TableCell>
                        <TableCell>
                          {bill.attachment_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => window.open(bill.attachment_url!, "_blank")}
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingBill(bill); setBillDialogOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("bill", bill.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agreements Tab */}
        <TabsContent value="agreements" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Contracts & Agreements</CardTitle>
                <Button size="sm" onClick={() => { setEditingAgreement(null); setAgreementDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAgreements ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : agreements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No agreements yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Agreement #</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Date Signed</TableHead>
                      <TableHead className="text-xs text-right">Value</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map((agreement) => (
                      <TableRow key={agreement.id}>
                        <TableCell className="text-xs">{agreement.agreement_number || "-"}</TableCell>
                        <TableCell className="text-xs">{agreement.agreement_type || "-"}</TableCell>
                        <TableCell className="text-xs">{formatDate(agreement.agreement_signed_date)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(agreement.total_price)}</TableCell>
                        <TableCell>
                          {agreement.attachment_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => window.open(agreement.attachment_url!, "_blank")}
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingAgreement(agreement); setAgreementDialogOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("agreement", agreement.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Phases Tab */}
        <TabsContent value="phases" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Payment Phases</CardTitle>
                <Button size="sm" onClick={() => { setEditingPhase(null); setPhaseDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPhases ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : paymentPhases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payment phases yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Phase</TableHead>
                      <TableHead className="text-xs">Contract</TableHead>
                      <TableHead className="text-xs">Due Date</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentPhases.map((phase) => {
                      const agreement = agreements.find(a => a.id === phase.agreement_id);
                      const invoiceStatus = getPhaseInvoiceStatus(phase.id);
                      const paymentStatus = getPhasePaymentStatus(phase.id);
                      const phaseAmount = phase.amount || 0;
                      const isFullyInvoiced = invoiceStatus.totalInvoiced >= phaseAmount;
                      const isFullyPaid = paymentStatus.totalReceived >= phaseAmount;
                      
                      return (
                        <TableRow key={phase.id}>
                          <TableCell className="text-xs">
                            <div>
                              <span className="font-medium">{phase.phase_name}</span>
                              {phase.description && <p className="text-muted-foreground">{phase.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{agreement?.agreement_number || "-"}</TableCell>
                          <TableCell className="text-xs">{formatDate(phase.due_date)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(phase.amount)}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-1">
                              <Badge 
                                variant="outline" 
                                className={isFullyInvoiced ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}
                              >
                                {isFullyInvoiced ? "Invoiced" : invoiceStatus.totalInvoiced > 0 ? `Invoiced: ${formatCurrency(invoiceStatus.totalInvoiced)}` : "Not Invoiced"}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={isFullyPaid ? "bg-emerald-500/10 text-emerald-500" : paymentStatus.totalReceived > 0 ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}
                              >
                                {isFullyPaid ? "Paid" : paymentStatus.totalReceived > 0 ? `Paid: ${formatCurrency(paymentStatus.totalReceived)}` : "Unpaid"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPhase(phase); setPhaseDialogOpen(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("phase", phase.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        invoice={editingInvoice}
        onSave={(data) => saveInvoiceMutation.mutate(data)}
        isPending={saveInvoiceMutation.isPending}
        agreements={agreements}
        paymentPhases={paymentPhases}
        payments={payments}
        existingInvoices={invoices}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        payment={editingPayment}
        onSave={(data) => savePaymentMutation.mutate(data)}
        isPending={savePaymentMutation.isPending}
        invoices={invoices}
      />

      {/* Bill Dialog */}
      <BillDialog
        open={billDialogOpen}
        onOpenChange={setBillDialogOpen}
        bill={editingBill}
        onSave={(data) => saveBillMutation.mutate(data)}
        isPending={saveBillMutation.isPending}
        projectId={projectId}
        agreements={agreements}
      />

      {/* Agreement Dialog */}
      <AgreementDialog
        open={agreementDialogOpen}
        onOpenChange={setAgreementDialogOpen}
        agreement={editingAgreement}
        onSave={(data) => saveAgreementMutation.mutate(data)}
        isPending={saveAgreementMutation.isPending}
        projectId={projectId}
      />

      {/* Phase Dialog */}
      <PhaseDialog
        open={phaseDialogOpen}
        onOpenChange={setPhaseDialogOpen}
        phase={editingPhase}
        onSave={(data) => savePhaseMutation.mutate(data)}
        isPending={savePhaseMutation.isPending}
        agreements={agreements}
        paymentPhases={paymentPhases}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Invoice Dialog Component
function InvoiceDialog({ 
  open, 
  onOpenChange, 
  invoice, 
  onSave, 
  isPending,
  agreements,
  paymentPhases,
  payments,
  existingInvoices,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  invoice: Invoice | null;
  onSave: (data: Partial<Invoice>) => void;
  isPending: boolean;
  agreements: Agreement[];
  paymentPhases: PaymentPhase[];
  payments: Payment[];
  existingInvoices: Invoice[];
}) {
  const [formData, setFormData] = useState({
    invoice_number: "",
    invoice_date: "",
    amount: "",
    agreement_id: "",
    payment_phase_id: "",
  });
  const [amountError, setAmountError] = useState("");

  // Reset form when dialog opens or invoice changes
  useEffect(() => {
    if (open) {
      if (invoice) {
        setFormData({
          invoice_number: invoice.invoice_number || "",
          invoice_date: invoice.invoice_date || "",
          amount: invoice.amount?.toString() || "",
          agreement_id: invoice.agreement_id || "",
          payment_phase_id: invoice.payment_phase_id || "",
        });
      } else {
        setFormData({ invoice_number: "", invoice_date: "", amount: "", agreement_id: "", payment_phase_id: "" });
      }
      setAmountError("");
    }
  }, [open, invoice]);

  // Filter phases by selected agreement
  const filteredPhases = formData.agreement_id 
    ? paymentPhases.filter(p => p.agreement_id === formData.agreement_id)
    : [];

  // Calculate payments received for this invoice from payment records
  const paymentsReceivedForInvoice = invoice?.id 
    ? payments.filter(p => p.invoice_id === invoice.id && p.payment_status === "Received")
        .reduce((sum, p) => sum + (p.payment_amount || 0), 0)
    : 0;

  // Calculate uninvoiced balance for selected phase
  const selectedPhase = paymentPhases.find(p => p.id === formData.payment_phase_id);
  const phaseAmount = selectedPhase?.amount || 0;
  const alreadyInvoicedForPhase = existingInvoices
    .filter(inv => inv.payment_phase_id === formData.payment_phase_id && inv.id !== invoice?.id)
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const uninvoicedBalance = phaseAmount - alreadyInvoicedForPhase;

  // Clear payment phase when agreement changes
  const handleAgreementChange = (value: string) => {
    setFormData(p => ({ ...p, agreement_id: value, payment_phase_id: "" }));
    setAmountError("");
  };

  const handlePhaseChange = (value: string) => {
    setFormData(p => ({ ...p, payment_phase_id: value }));
    setAmountError("");
  };

  const handleAmountChange = (value: string) => {
    setFormData(p => ({ ...p, amount: value }));
    setAmountError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount) || 0;
    
    // Validate amount doesn't exceed uninvoiced balance for the phase
    if (formData.payment_phase_id && amount > uninvoicedBalance) {
      setAmountError(`Amount cannot exceed uninvoiced balance of ${formatCurrency(uninvoicedBalance)}`);
      return;
    }
    
    onSave({
      invoice_number: formData.invoice_number || null,
      invoice_date: formData.invoice_date || null,
      amount,
      total_expected: amount,
      payments_received: paymentsReceivedForInvoice,
      open_balance: amount - paymentsReceivedForInvoice,
      agreement_id: formData.agreement_id || null,
      payment_phase_id: formData.payment_phase_id || null,
    });
  };

  const invoiceAmount = parseFloat(formData.amount) || 0;
  const openBalance = invoiceAmount - paymentsReceivedForInvoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
          <DialogDescription>Enter invoice details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input value={formData.invoice_number} onChange={(e) => setFormData(p => ({ ...p, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={formData.invoice_date} onChange={(e) => setFormData(p => ({ ...p, invoice_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Agreement</Label>
              <Select value={formData.agreement_id} onValueChange={handleAgreementChange}>
                <SelectTrigger><SelectValue placeholder="Select agreement" /></SelectTrigger>
                <SelectContent>
                  {agreements.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.agreement_number} - {formatCurrency(a.total_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Phase</Label>
              <Select 
                value={formData.payment_phase_id} 
                onValueChange={handlePhaseChange}
                disabled={!formData.agreement_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.agreement_id ? "Select phase" : "Select agreement first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPhases.map((p) => {
                    const invoicedForThisPhase = existingInvoices
                      .filter(inv => inv.payment_phase_id === p.id && inv.id !== invoice?.id)
                      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
                    const remaining = (p.amount || 0) - invoicedForThisPhase;
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.phase_name} - {formatCurrency(p.amount)} (Avail: {formatCurrency(remaining)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount ($)</Label>
              <Input 
                type="number" 
                value={formData.amount} 
                onChange={(e) => handleAmountChange(e.target.value)} 
              />
              {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              {formData.payment_phase_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {formatCurrency(uninvoicedBalance)}
                </p>
              )}
            </div>
            {invoice && (
              <div>
                <Label>Payments Received</Label>
                <p className="text-sm font-medium mt-2">{formatCurrency(paymentsReceivedForInvoice)}</p>
                <p className="text-xs text-muted-foreground">Balance: {formatCurrency(openBalance)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Payment Dialog Component
function PaymentDialog({ 
  open, 
  onOpenChange, 
  payment, 
  onSave, 
  isPending,
  invoices,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  payment: Payment | null;
  onSave: (data: Partial<Payment>) => void;
  isPending: boolean;
  invoices: Invoice[];
}) {
  const [formData, setFormData] = useState({
    bank_name: "",
    projected_received_date: "",
    payment_schedule: "",
    payment_status: "Pending",
    payment_amount: "",
    payment_fee: "",
    check_number: "",
    invoice_id: "",
  });
  const [amountError, setAmountError] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && payment) {
      setFormData({
        bank_name: payment.bank_name || "",
        projected_received_date: payment.projected_received_date || "",
        payment_schedule: payment.payment_schedule || "",
        payment_status: payment.payment_status || "Pending",
        payment_amount: payment.payment_amount?.toString() || "",
        payment_fee: payment.payment_fee?.toString() || "",
        check_number: payment.check_number || "",
        invoice_id: payment.invoice_id || "",
      });
    } else if (newOpen) {
      setFormData({ bank_name: "", projected_received_date: "", payment_schedule: "", payment_status: "Pending", payment_amount: "", payment_fee: "", check_number: "", invoice_id: "" });
    }
    setAmountError("");
    onOpenChange(newOpen);
  };

  // Get selected invoice to validate amount and get phase
  const selectedInvoice = invoices.find(i => i.id === formData.invoice_id);
  const maxAmount = selectedInvoice?.open_balance || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.payment_amount) || 0;
    
    // Validate amount doesn't exceed invoice balance
    if (formData.invoice_id && amount > maxAmount) {
      setAmountError(`Amount cannot exceed invoice balance of ${formatCurrency(maxAmount)}`);
      return;
    }
    
    // Get payment phase from selected invoice
    const paymentPhaseId = selectedInvoice?.payment_phase_id || null;
    
    onSave({
      bank_name: formData.bank_name || null,
      projected_received_date: formData.projected_received_date || null,
      payment_schedule: formData.payment_schedule || null,
      payment_status: formData.payment_status,
      payment_amount: amount,
      payment_fee: parseFloat(formData.payment_fee) || 0,
      check_number: formData.check_number || null,
      invoice_id: formData.invoice_id || null,
      payment_phase_id: paymentPhaseId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payment ? "Edit Payment Received" : "Add Payment Received"}</DialogTitle>
          <DialogDescription>Enter payment details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input value={formData.bank_name} onChange={(e) => setFormData(p => ({ ...p, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label>Date Received</Label>
              <Input type="date" value={formData.projected_received_date} onChange={(e) => setFormData(p => ({ ...p, projected_received_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Invoice</Label>
            <Select value={formData.invoice_id} onValueChange={(v) => { setFormData(p => ({ ...p, invoice_id: v })); setAmountError(""); }}>
              <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} - Balance: {formatCurrency(inv.open_balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount ($)</Label>
              <Input 
                type="number" 
                value={formData.payment_amount} 
                onChange={(e) => { setFormData(p => ({ ...p, payment_amount: e.target.value })); setAmountError(""); }} 
              />
              {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              {selectedInvoice && <p className="text-xs text-muted-foreground mt-1">Max: {formatCurrency(maxAmount)}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.payment_status} onValueChange={(v) => setFormData(p => ({ ...p, payment_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="Anticipated">Anticipated</SelectItem>
                  <SelectItem value="Deposit">Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fee ($)</Label>
              <Input type="number" value={formData.payment_fee} onChange={(e) => setFormData(p => ({ ...p, payment_fee: e.target.value }))} />
            </div>
            <div>
              <Label>Check #</Label>
              <Input value={formData.check_number} onChange={(e) => setFormData(p => ({ ...p, check_number: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Bill Payment sub-form item type
interface BillPaymentFormItem {
  id: string;
  payment_date: string;
  payment_amount: string;
  payment_method: string;
  payment_reference: string;
}

// Bill Dialog Component with multiple payments
function BillDialog({ 
  open, 
  onOpenChange, 
  bill, 
  onSave, 
  isPending,
  projectId,
  agreements,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (data: { bill: Partial<Bill>; billPayments: Omit<BillPayment, 'id' | 'bill_id'>[] }) => void;
  isPending: boolean;
  projectId: string;
  agreements: Agreement[];
}) {
  const [formData, setFormData] = useState({
    installer_company: "",
    category: "",
    bill_ref: "",
    bill_amount: "",
    memo: "",
    attachment_url: null as string | null,
    agreement_id: "",
  });
  const [billPayments, setBillPayments] = useState<BillPaymentFormItem[]>([]);
  const [installerSearch, setInstallerSearch] = useState("");
  const [installerOpen, setInstallerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Predefined categories
  const predefinedCategories = ["Materials", "Labor", "Permits", "Equipment", "Subcontractor"];

  // Fetch unique installer companies
  const { data: existingInstallers = [] } = useQuery({
    queryKey: ["installer-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("installer_company");
      if (error) throw error;
      
      const names = new Set<string>();
      data.forEach((b) => {
        if (b.installer_company) names.add(b.installer_company);
      });
      
      return Array.from(names).sort();
    },
    enabled: open,
  });

  // Fetch unique categories (combining predefined + existing)
  const { data: existingCategories = [] } = useQuery({
    queryKey: ["bill-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("category");
      if (error) throw error;
      
      const categories = new Set<string>(predefinedCategories);
      data.forEach((b) => {
        if (b.category) categories.add(b.category);
      });
      
      return Array.from(categories).sort();
    },
    enabled: open,
  });

  // Fetch existing bill payments when editing
  const { data: existingBillPayments = [] } = useQuery({
    queryKey: ["bill-payments", bill?.id],
    queryFn: async () => {
      if (!bill?.id) return [];
      const { data, error } = await supabase
        .from("bill_payments")
        .select("*")
        .eq("bill_id", bill.id)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return data as BillPayment[];
    },
    enabled: open && !!bill?.id,
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && bill) {
      setFormData({
        installer_company: bill.installer_company || "",
        category: bill.category || "",
        bill_ref: bill.bill_ref || "",
        bill_amount: bill.bill_amount?.toString() || "",
        memo: bill.memo || "",
        attachment_url: bill.attachment_url || null,
        agreement_id: bill.agreement_id || "",
      });
      // Payments will be loaded from query
    } else if (newOpen) {
      setFormData({ installer_company: "", category: "", bill_ref: "", bill_amount: "", memo: "", attachment_url: null, agreement_id: "" });
      setBillPayments([]);
    }
    onOpenChange(newOpen);
  };

  // Update bill payments when existing data loads
  useEffect(() => {
    if (open && bill?.id && existingBillPayments.length > 0) {
      setBillPayments(existingBillPayments.map(p => ({
        id: p.id,
        payment_date: p.payment_date || "",
        payment_amount: p.payment_amount.toString(),
        payment_method: p.payment_method || "",
        payment_reference: p.payment_reference || "",
      })));
    } else if (open && !bill) {
      setBillPayments([]);
    }
  }, [open, bill?.id, existingBillPayments]);

  const addPayment = () => {
    setBillPayments([...billPayments, {
      id: crypto.randomUUID(),
      payment_date: "",
      payment_amount: "",
      payment_method: "",
      payment_reference: "",
    }]);
  };

  const removePayment = (id: string) => {
    setBillPayments(billPayments.filter(p => p.id !== id));
  };

  const updatePayment = (id: string, field: keyof BillPaymentFormItem, value: string) => {
    setBillPayments(billPayments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const totalPaid = billPayments.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);
  const billAmount = parseFloat(formData.bill_amount) || 0;
  const balance = billAmount - totalPaid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bill: {
        installer_company: formData.installer_company || null,
        category: formData.category || null,
        bill_ref: formData.bill_ref || null,
        bill_amount: billAmount,
        memo: formData.memo || null,
        attachment_url: formData.attachment_url,
        agreement_id: formData.agreement_id || null,
      },
      billPayments: billPayments.map(p => ({
        payment_date: p.payment_date || null,
        payment_amount: parseFloat(p.payment_amount) || 0,
        payment_method: p.payment_method || null,
        payment_reference: p.payment_reference || null,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill ? "Edit Bill" : "Add Bill"}</DialogTitle>
          <DialogDescription>Enter bill details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Installer/Company</Label>
              <Popover open={installerOpen} onOpenChange={setInstallerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={installerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formData.installer_company || "Select or add..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 z-50" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search or add new..." 
                      value={installerSearch}
                      onValueChange={setInstallerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {installerSearch && !existingInstallers.some(n => n.toLowerCase() === installerSearch.toLowerCase()) && (
                          <CommandItem
                            value={installerSearch}
                            onSelect={() => {
                              setFormData(p => ({ ...p, installer_company: installerSearch }));
                              setInstallerSearch("");
                              setInstallerOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add "{installerSearch}"
                          </CommandItem>
                        )}
                        {existingInstallers.map((name) => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => {
                              setFormData(p => ({ ...p, installer_company: name }));
                              setInstallerSearch("");
                              setInstallerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.installer_company === name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Category</Label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formData.category || "Select or add..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 z-50" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search or add new..." 
                      value={categorySearch}
                      onValueChange={setCategorySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {categorySearch && !existingCategories.some(c => c.toLowerCase() === categorySearch.toLowerCase()) && (
                          <CommandItem
                            value={categorySearch}
                            onSelect={() => {
                              setFormData(p => ({ ...p, category: categorySearch }));
                              setCategorySearch("");
                              setCategoryOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add "{categorySearch}"
                          </CommandItem>
                        )}
                        {existingCategories.map((cat) => (
                          <CommandItem
                            key={cat}
                            value={cat}
                            onSelect={() => {
                              setFormData(p => ({ ...p, category: cat }));
                              setCategorySearch("");
                              setCategoryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.category === cat ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cat}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Contract</Label>
              <Select value={formData.agreement_id} onValueChange={(v) => setFormData(p => ({ ...p, agreement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
                <SelectContent>
                  {agreements.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.agreement_number || a.agreement_type || "Contract"} - {formatCurrency(a.total_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bill Amount ($)</Label>
              <Input type="number" value={formData.bill_amount} onChange={(e) => setFormData(p => ({ ...p, bill_amount: e.target.value }))} />
            </div>
            <div>
              <Label>Bill Reference</Label>
              <Input value={formData.bill_ref} onChange={(e) => setFormData(p => ({ ...p, bill_ref: e.target.value }))} placeholder="Invoice/PO number" />
            </div>
          </div>
          <div>
            <Label>Memo</Label>
            <Input value={formData.memo} onChange={(e) => setFormData(p => ({ ...p, memo: e.target.value }))} />
          </div>
          <div>
            <Label>Receipt/Attachment</Label>
            <FileUpload
              projectId={projectId}
              currentUrl={formData.attachment_url}
              onUpload={(url) => setFormData(p => ({ ...p, attachment_url: url }))}
              folder="bills"
            />
          </div>

          {/* Payments Sub-form */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Payments Made</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPayment}>
                <Plus className="h-3 w-3 mr-1" />
                Add Payment
              </Button>
            </div>
            
            {billPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No payments recorded yet</p>
            ) : (
              <div className="space-y-3">
                {billPayments.map((payment, index) => (
                  <div key={payment.id} className="border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Payment {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePayment(payment.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input 
                          type="date" 
                          className="h-8 text-xs"
                          value={payment.payment_date} 
                          onChange={(e) => updatePayment(payment.id, 'payment_date', e.target.value)} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Amount ($)</Label>
                        <Input 
                          type="number" 
                          className="h-8 text-xs"
                          value={payment.payment_amount} 
                          onChange={(e) => updatePayment(payment.id, 'payment_amount', e.target.value)} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Method</Label>
                        <Select value={payment.payment_method} onValueChange={(v) => updatePayment(payment.id, 'payment_method', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Wire">Wire</SelectItem>
                            <SelectItem value="ACH">ACH</SelectItem>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Zelle">Zelle</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Reference</Label>
                        <Input 
                          className="h-8 text-xs"
                          value={payment.payment_reference} 
                          onChange={(e) => updatePayment(payment.id, 'payment_reference', e.target.value)} 
                          placeholder="Check #"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Totals */}
            <div className="flex justify-between pt-2 border-t text-sm">
              <span>Total Paid: <span className="font-medium text-emerald-600">{formatCurrency(totalPaid)}</span></span>
              <span>Balance: <span className={cn("font-medium", balance > 0 ? "text-amber-600" : "text-emerald-600")}>{formatCurrency(balance)}</span></span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Agreement Dialog Component
function AgreementDialog({ 
  open, 
  onOpenChange, 
  agreement, 
  onSave, 
  isPending,
  projectId,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  agreement: Agreement | null;
  onSave: (data: Partial<Agreement>) => void;
  isPending: boolean;
  projectId: string;
}) {
  const [formData, setFormData] = useState({
    agreement_number: "",
    agreement_type: "",
    agreement_signed_date: "",
    total_price: "",
    description_of_work: "",
    attachment_url: null as string | null,
  });

  // Query to get the next agreement number (starting from 1201)
  const { data: nextAgreementNumber } = useQuery({
    queryKey: ["next-agreement-number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("agreement_number")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Find the highest numeric agreement number
      let maxNumber = 1200; // Start before 1201
      data.forEach((a) => {
        const num = parseInt(a.agreement_number || "0", 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      });
      
      return (maxNumber + 1).toString();
    },
    enabled: open && !agreement, // Only fetch when creating new agreement
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && agreement) {
      setFormData({
        agreement_number: agreement.agreement_number || "",
        agreement_type: agreement.agreement_type || "",
        agreement_signed_date: agreement.agreement_signed_date || "",
        total_price: agreement.total_price?.toString() || "",
        description_of_work: agreement.description_of_work || "",
        attachment_url: agreement.attachment_url || null,
      });
    } else if (newOpen) {
      // Auto-fill the next agreement number for new agreements
      setFormData({ 
        agreement_number: nextAgreementNumber || "1201", 
        agreement_type: "", 
        agreement_signed_date: "", 
        total_price: "", 
        description_of_work: "", 
        attachment_url: null 
      });
    }
    onOpenChange(newOpen);
  };

  // Update agreement number when nextAgreementNumber loads (for new agreements)
  useEffect(() => {
    if (open && !agreement && nextAgreementNumber && !formData.agreement_number) {
      setFormData(p => ({ ...p, agreement_number: nextAgreementNumber }));
    }
  }, [open, agreement, nextAgreementNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agreement_number: formData.agreement_number || null,
      agreement_type: formData.agreement_type || null,
      agreement_signed_date: formData.agreement_signed_date || null,
      total_price: parseFloat(formData.total_price) || 0,
      description_of_work: formData.description_of_work || null,
      attachment_url: formData.attachment_url,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{agreement ? "Edit Agreement" : "Add Agreement"}</DialogTitle>
          <DialogDescription>Enter agreement/contract details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Agreement Number</Label>
              <Input 
                value={formData.agreement_number} 
                readOnly 
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formData.agreement_type} onValueChange={(v) => setFormData(p => ({ ...p, agreement_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Change Order">Change Order</SelectItem>
                  <SelectItem value="Addendum">Addendum</SelectItem>
                  <SelectItem value="Amendment">Amendment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date Signed</Label>
              <Input type="date" value={formData.agreement_signed_date} onChange={(e) => setFormData(p => ({ ...p, agreement_signed_date: e.target.value }))} />
            </div>
            <div>
              <Label>Total Value ($)</Label>
              <Input type="number" value={formData.total_price} onChange={(e) => setFormData(p => ({ ...p, total_price: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Description of Work</Label>
            <Input value={formData.description_of_work} onChange={(e) => setFormData(p => ({ ...p, description_of_work: e.target.value }))} placeholder="Scope of work covered" />
          </div>
          <div>
            <Label>Contract Document</Label>
            <FileUpload
              projectId={projectId}
              currentUrl={formData.attachment_url}
              onUpload={(url) => setFormData(p => ({ ...p, attachment_url: url }))}
              folder="agreements"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Payment Phase Dialog Component with validation
function PhaseDialog({ 
  open, 
  onOpenChange, 
  phase, 
  onSave, 
  isPending,
  agreements,
  paymentPhases,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  phase: PaymentPhase | null;
  onSave: (data: Partial<PaymentPhase>) => void;
  isPending: boolean;
  agreements: Agreement[];
  paymentPhases: PaymentPhase[];
}) {
  const [formData, setFormData] = useState({
    phase_name: "",
    description: "",
    due_date: "",
    amount: "",
    agreement_id: "",
  });
  const [validationWarning, setValidationWarning] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && phase) {
      setFormData({
        phase_name: phase.phase_name || "",
        description: phase.description || "",
        due_date: phase.due_date || "",
        amount: phase.amount?.toString() || "",
        agreement_id: phase.agreement_id || "",
      });
    } else if (newOpen) {
      setFormData({ phase_name: "", description: "", due_date: "", amount: "", agreement_id: "" });
    }
    setValidationWarning("");
    onOpenChange(newOpen);
  };

  // Calculate validation when agreement or amount changes
  useEffect(() => {
    if (!formData.agreement_id) {
      setValidationWarning("");
      return;
    }
    
    const agreement = agreements.find(a => a.id === formData.agreement_id);
    if (!agreement) {
      setValidationWarning("");
      return;
    }
    
    const contractTotal = agreement.total_price || 0;
    const currentPhaseAmount = parseFloat(formData.amount) || 0;
    
    // Sum of other phases for this agreement (excluding current phase if editing)
    const otherPhasesTotal = paymentPhases
      .filter(p => p.agreement_id === formData.agreement_id && p.id !== phase?.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const newTotal = otherPhasesTotal + currentPhaseAmount;
    
    if (newTotal > contractTotal) {
      setValidationWarning(`Warning: Phase total (${formatCurrency(newTotal)}) exceeds contract value (${formatCurrency(contractTotal)})`);
    } else if (newTotal < contractTotal) {
      setValidationWarning(`Note: Phase total (${formatCurrency(newTotal)}) is less than contract value (${formatCurrency(contractTotal)}). Remaining: ${formatCurrency(contractTotal - newTotal)}`);
    } else {
      setValidationWarning("");
    }
  }, [formData.agreement_id, formData.amount, agreements, paymentPhases, phase?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      phase_name: formData.phase_name || "New Phase",
      description: formData.description || null,
      due_date: formData.due_date || null,
      amount: parseFloat(formData.amount) || 0,
      agreement_id: formData.agreement_id || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase ? "Edit Payment Phase" : "Add Payment Phase"}</DialogTitle>
          <DialogDescription>Define a payment milestone for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Contract</Label>
            <Select value={formData.agreement_id} onValueChange={(v) => setFormData(p => ({ ...p, agreement_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
              <SelectContent>
                {agreements.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.agreement_number} - {a.agreement_type || "Contract"} ({formatCurrency(a.total_price)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phase Name</Label>
              <Input value={formData.phase_name} onChange={(e) => setFormData(p => ({ ...p, phase_name: e.target.value }))} placeholder="e.g., Deposit, Progress, Final" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Amount ($)</Label>
            <Input type="number" value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} />
          </div>
          {validationWarning && (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-md text-sm",
              validationWarning.startsWith("Warning") ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"
            )}>
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{validationWarning}</span>
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Input value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Additional details about this phase" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
