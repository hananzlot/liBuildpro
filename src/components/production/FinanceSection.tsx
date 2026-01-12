import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/hooks/useAuditLog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
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
  ChevronDown,
  AlertCircle,
  History
} from "lucide-react";
import { FileUpload } from "./FileUpload";
import { PdfViewerDialog } from "./PdfViewerDialog";

interface SalespersonData {
  name: string | null;
  commissionPct: number;
}

interface FinanceSectionProps {
  projectId: string;
  estimatedCost: number | null;
  estimatedProjectCost: number | null;
  totalPl: number | null;
  leadCostPercent: number;
  commissionSplitPct: number;
  salespeople: SalespersonData[];
  onUpdateProject: (updates: Record<string, unknown>) => void;
  onNavigateToSubcontractors?: () => void;
  autoOpenBillDialog?: boolean;
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
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
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
  bank_name: string | null;
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
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
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


const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
};

export function FinanceSection({ projectId, estimatedCost, estimatedProjectCost, totalPl, leadCostPercent, commissionSplitPct, salespeople, onUpdateProject, onNavigateToSubcontractors, autoOpenBillDialog }: FinanceSectionProps) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState("agreements");
  const [selectedAgreementFilter, setSelectedAgreementFilter] = useState<string | null>(null);
  const [hasAutoOpenedBill, setHasAutoOpenedBill] = useState(false);
  
  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quickPayDialogOpen, setQuickPayDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidingBill, setVoidingBill] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPaymentDialogOpen, setVoidPaymentDialogOpen] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidPaymentReason, setVoidPaymentReason] = useState("");

  // Auto-open bill dialog when returning from subcontractor add
  useEffect(() => {
    if (autoOpenBillDialog && !hasAutoOpenedBill) {
      setActiveSubTab("bills");
      setBillDialogOpen(true);
      setHasAutoOpenedBill(true);
    }
  }, [autoOpenBillDialog, hasAutoOpenedBill]);
  
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [prePopulatedInvoice, setPrePopulatedInvoice] = useState<Partial<Invoice> | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [editingPhase, setEditingPhase] = useState<PaymentPhase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [historyBill, setHistoryBill] = useState<Bill | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; name: string } | null>(null);

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

  // Calculate totals - exclude voided bills and payments
  const activeBills = bills.filter(b => !b.is_voided);
  const activePayments = payments.filter(p => !p.is_voided);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaymentsReceived = activePayments.filter(p => p.payment_status === "Received").reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalBills = activeBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
  const totalBillsPaid = activeBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const totalAgreementsValue = agreements.reduce((sum, a) => sum + (a.total_price || 0), 0);

  // Helper functions to check phase status
  const getPhaseInvoiceStatus = (phaseId: string) => {
    const phaseInvoices = invoices.filter(inv => inv.payment_phase_id === phaseId);
    const totalInvoicedForPhase = phaseInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return { invoices: phaseInvoices, totalInvoiced: totalInvoicedForPhase };
  };

  const getPhasePaymentStatus = (phaseId: string) => {
    const phasePayments = activePayments.filter(p => p.payment_phase_id === phaseId && p.payment_status === "Received");
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
        await logAudit({
          tableName: 'project_invoices',
          recordId: editingInvoice.id,
          action: 'UPDATE',
          oldValues: editingInvoice,
          newValues: invoice,
          description: `Updated invoice ${invoice.invoice_number || editingInvoice.invoice_number}`,
        });
        const { error } = await supabase
          .from("project_invoices")
          .update(invoice)
          .eq("id", editingInvoice.id);
        if (error) throw error;
      } else {
        const { data: newInvoice, error } = await supabase
          .from("project_invoices")
          .insert({ ...invoice, project_id: projectId })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tableName: 'project_invoices',
          recordId: newInvoice.id,
          action: 'INSERT',
          newValues: newInvoice,
          description: `Created invoice ${invoice.invoice_number}`,
        });
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
        await logAudit({
          tableName: 'project_payments',
          recordId: editingPayment.id,
          action: 'UPDATE',
          oldValues: editingPayment,
          newValues: payment,
          description: `Updated payment ${formatCurrency(payment.payment_amount)}`,
        });
        const { error } = await supabase
          .from("project_payments")
          .update(payment)
          .eq("id", editingPayment.id);
        if (error) throw error;
      } else {
        const { data: newPayment, error } = await supabase
          .from("project_payments")
          .insert({ ...payment, project_id: projectId })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tableName: 'project_payments',
          recordId: newPayment.id,
          action: 'INSERT',
          newValues: newPayment,
          description: `Created payment ${formatCurrency(payment.payment_amount)}`,
        });
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

  // Bill mutations - simplified (payments handled via QuickPay only)
  const saveBillMutation = useMutation({
    mutationFn: async (bill: Partial<Bill>) => {
      if (editingBill?.id) {
        // When editing, preserve existing amount_paid and recalculate balance
        const currentAmountPaid = editingBill.amount_paid || 0;
        const balance = (bill.bill_amount || 0) - currentAmountPaid;
        
        await logAudit({
          tableName: 'project_bills',
          recordId: editingBill.id,
          action: 'UPDATE',
          oldValues: editingBill,
          newValues: { ...bill, balance },
          description: `Updated bill ${bill.bill_ref || editingBill.bill_ref} - ${formatCurrency(bill.bill_amount)}`,
        });
        const { error } = await supabase
          .from("project_bills")
          .update({ ...bill, balance })
          .eq("id", editingBill.id);
        if (error) throw error;
      } else {
        // New bill starts with 0 paid and full balance
        const { data: newBill, error } = await supabase
          .from("project_bills")
          .insert({ ...bill, amount_paid: 0, balance: bill.bill_amount || 0, project_id: projectId })
          .select()
          .single();
        if (error) throw error;
        
        await logAudit({
          tableName: 'project_bills',
          recordId: newBill.id,
          action: 'INSERT',
          newValues: newBill,
          description: `Created bill ${bill.bill_ref} - ${formatCurrency(bill.bill_amount)}`,
        });
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

  // Quick pay mutation for adding a single payment to a bill
  const quickPayMutation = useMutation({
    mutationFn: async ({ billId, payment }: { billId: string; payment: Omit<BillPayment, 'id' | 'bill_id'> }) => {
      // Insert the payment
      const { data: newPayment, error: paymentError } = await supabase
        .from("bill_payments")
        .insert({ ...payment, bill_id: billId })
        .select()
        .single();
      if (paymentError) throw paymentError;

      await logAudit({
        tableName: 'bill_payments',
        recordId: newPayment.id,
        action: 'INSERT',
        newValues: newPayment,
        description: `Added bill payment ${formatCurrency(payment.payment_amount)}`,
      });

      // Get all payments for this bill and update the bill's amount_paid and balance
      const { data: allPayments, error: fetchError } = await supabase
        .from("bill_payments")
        .select("payment_amount")
        .eq("bill_id", billId);
      if (fetchError) throw fetchError;

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      
      // Get the bill amount to calculate balance
      const { data: bill, error: billFetchError } = await supabase
        .from("project_bills")
        .select("bill_amount")
        .eq("id", billId)
        .single();
      if (billFetchError) throw billFetchError;

      const balance = (bill.bill_amount || 0) - totalPaid;

      const { error: updateError } = await supabase
        .from("project_bills")
        .update({ amount_paid: totalPaid, balance })
        .eq("id", billId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setQuickPayDialogOpen(false);
      setPayingBill(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Void bill mutation
  const voidBillMutation = useMutation({
    mutationFn: async ({ billId, reason, userId }: { billId: string; reason: string; userId: string }) => {
      // Check if any payments exist for this bill
      const { data: existingPayments, error: checkError } = await supabase
        .from("bill_payments")
        .select("id, payment_amount")
        .eq("bill_id", billId);
      
      if (checkError) throw checkError;
      
      if (existingPayments && existingPayments.length > 0) {
        const totalPaid = existingPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        throw new Error(`Cannot void bill: ${existingPayments.length} payment(s) totaling ${formatCurrency(totalPaid)} have been recorded against this bill. Please void or remove payments first.`);
      }

      const { error } = await supabase
        .from("project_bills")
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: userId,
          void_reason: reason,
        })
        .eq("id", billId);
      if (error) throw error;

      await logAudit({
        tableName: 'project_bills',
        recordId: billId,
        action: 'UPDATE',
        newValues: { is_voided: true, void_reason: reason },
        description: `Voided bill - Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success("Bill voided");
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setVoidDialogOpen(false);
      setVoidingBill(null);
      setVoidReason("");
    },
    onError: (error) => toast.error(`Failed to void bill: ${error.message}`),
  });

  // Void payment mutation
  const voidPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, reason, userId }: { paymentId: string; reason: string; userId: string }) => {
      const { error } = await supabase
        .from("project_payments")
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: userId,
          void_reason: reason,
        })
        .eq("id", paymentId);
      if (error) throw error;

      await logAudit({
        tableName: 'project_payments',
        recordId: paymentId,
        action: 'UPDATE',
        newValues: { is_voided: true, void_reason: reason },
        description: `Voided payment - Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success("Payment voided");
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
      setVoidPaymentDialogOpen(false);
      setVoidingPayment(null);
      setVoidPaymentReason("");
    },
    onError: (error) => toast.error(`Failed to void payment: ${error.message}`),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: async (agreement: Partial<Agreement>) => {
      if (editingAgreement?.id) {
        await logAudit({
          tableName: 'project_agreements',
          recordId: editingAgreement.id,
          action: 'UPDATE',
          oldValues: editingAgreement,
          newValues: agreement,
          description: `Updated agreement ${agreement.agreement_number || editingAgreement.agreement_number}`,
        });
        const { error } = await supabase
          .from("project_agreements")
          .update(agreement)
          .eq("id", editingAgreement.id);
        if (error) throw error;
      } else {
        const { data: newAgreement, error } = await supabase
          .from("project_agreements")
          .insert({ ...agreement, project_id: projectId })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tableName: 'project_agreements',
          recordId: newAgreement.id,
          action: 'INSERT',
          newValues: newAgreement,
          description: `Created agreement ${agreement.agreement_number}`,
        });
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
        await logAudit({
          tableName: 'project_payment_phases',
          recordId: editingPhase.id,
          action: 'UPDATE',
          oldValues: editingPhase,
          newValues: phase,
          description: `Updated phase ${phase.phase_name || editingPhase.phase_name}`,
        });
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
        const { data: newPhase, error } = await supabase
          .from("project_payment_phases")
          .insert({
            project_id: projectId,
            phase_name: phase.phase_name || "New Phase",
            description: phase.description,
            due_date: phase.due_date,
            amount: phase.amount,
            agreement_id: phase.agreement_id,
          })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tableName: 'project_payment_phases',
          recordId: newPhase.id,
          action: 'INSERT',
          newValues: newPhase,
          description: `Created phase ${phase.phase_name}`,
        });
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
      
      // Log audit before delete
      await logAudit({
        tableName: table,
        recordId: deleteTarget.id,
        action: 'DELETE',
        description: `Deleted ${deleteTarget.type}`,
      });
      
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

  // Check if bill has payments before allowing edit
  const handleEditBillClick = async (bill: Bill) => {
    // If bill has any amount paid, prevent editing
    if ((bill.amount_paid || 0) > 0) {
      toast.error(`Cannot edit bill: ${formatCurrency(bill.amount_paid)} in payments have been recorded. Please void or remove payments first.`);
      return;
    }
    setEditingBill(bill);
    setBillDialogOpen(true);
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
    
    // Get bills for this agreement
    const agreementBills = bills.filter(b => b.agreement_id === agreement.id);
    const billsTotal = agreementBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
    const billsPaid = agreementBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
    
    const phasesTotal = agreementPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const uninvoiced = (agreement.total_price || 0) - totalInvoicedForAgreement;
    const uncollected = totalInvoicedForAgreement - collectedForAgreement;
    const profit = collectedForAgreement - billsPaid;

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
      billsTotal,
      billsPaid,
      profit,
    };
  });

  // Calculate unassigned bills (bills not linked to any agreement)
  const unassignedBills = bills.filter(b => !b.agreement_id);
  const unassignedBillsTotal = unassignedBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
  const unassignedBillsPaid = unassignedBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);

  return (
    <div className="space-y-4">
      {/* Profitability by Agreement - Collapsible */}
      {agreements.length > 0 && (
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Profitability by Contract
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Contract</TableHead>
                      <TableHead className="text-xs text-right">Sold</TableHead>
                      <TableHead className="text-xs text-right">Uninvoiced</TableHead>
                      <TableHead className="text-xs text-right">Uncollected</TableHead>
                      <TableHead className="text-xs text-right">Collected</TableHead>
                      <TableHead className="text-xs text-right">Bills</TableHead>
                      <TableHead className="text-xs text-right">Bills Paid</TableHead>
                      <TableHead className="text-xs text-right">Profit</TableHead>
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
                        <TableCell className="text-xs text-right text-amber-600">
                          {formatCurrency(ap.uninvoiced)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-amber-600">
                          {formatCurrency(ap.uncollected)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-emerald-600">
                          {formatCurrency(ap.collected)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-amber-600">
                          {formatCurrency(ap.billsTotal)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {formatCurrency(ap.billsPaid)}
                        </TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${ap.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {formatCurrency(ap.profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Unassigned bills row */}
                    {unassignedBillsTotal > 0 && (
                      <TableRow className="text-muted-foreground">
                        <TableCell className="text-xs italic">Unassigned Bills</TableCell>
                        <TableCell className="text-xs text-right">-</TableCell>
                        <TableCell className="text-xs text-right">-</TableCell>
                        <TableCell className="text-xs text-right">-</TableCell>
                        <TableCell className="text-xs text-right">-</TableCell>
                        <TableCell className="text-xs text-right text-amber-600">
                          {formatCurrency(unassignedBillsTotal)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {formatCurrency(unassignedBillsPaid)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold text-destructive">
                          {formatCurrency(-unassignedBillsPaid)}
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Totals row */}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell className="text-xs">Total</TableCell>
                      <TableCell className="text-xs text-right">
                        {formatCurrency(totalAgreementsValue)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-amber-600">
                        {formatCurrency(totalAgreementsValue - totalInvoiced)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-amber-600">
                        {formatCurrency(totalInvoiced - totalPaymentsReceived)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-emerald-600">
                        {formatCurrency(totalPaymentsReceived)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-amber-600">
                        {formatCurrency(totalBills)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {formatCurrency(totalBillsPaid)}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-bold ${totalPaymentsReceived - totalBillsPaid >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {formatCurrency(totalPaymentsReceived - totalBillsPaid)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Sold Amount & Estimated Costs - Compact inline */}
      <div className="flex gap-2 flex-wrap">
        <SoldAmountOriginalCard 
          estimatedCost={estimatedCost} 
          contractsTotal={totalAgreementsValue}
          onSave={(value) => onUpdateProject({ estimated_cost: value })}
        />
        <EstimatedProjectCostsCard
          estimatedProjectCost={estimatedProjectCost}
          estimatedCost={estimatedCost}
          onSave={(value) => onUpdateProject({ estimated_project_cost: value })}
        />
      </div>

      {/* Summary Cards - Compact single row */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Sold:</span>
          <span className="text-xs font-semibold">{formatCurrency(totalAgreementsValue)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
          <FileText className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Invoiced:</span>
          <span className="text-xs font-semibold">{formatCurrency(totalInvoiced)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded-md px-2 py-1.5">
          <CreditCard className="h-3 w-3 text-emerald-600" />
          <span className="text-[10px] text-muted-foreground">Received:</span>
          <span className="text-xs font-semibold text-emerald-600">{formatCurrency(totalPaymentsReceived)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
          <Receipt className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Bills:</span>
          <span className="text-xs font-semibold">{formatCurrency(totalBills)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 rounded-md px-2 py-1.5">
          <AlertCircle className="h-3 w-3 text-amber-600" />
          <span className="text-[10px] text-muted-foreground">Outstanding:</span>
          <span className="text-xs font-semibold text-amber-600">{formatCurrency(totalBills - totalBillsPaid)}</span>
        </div>
      </div>

      {/* Sub-tabs for Agreements, Phases, Invoices, Payments, Bills, Commission */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="agreements" className="text-xs">
            Contracts
          </TabsTrigger>
          <TabsTrigger value="phases" className="text-xs">
            Phases
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            Pmts Rcvd
          </TabsTrigger>
          <TabsTrigger value="bills" className="text-xs">
            Bills
          </TabsTrigger>
          <TabsTrigger value="commission" className="text-xs">
            Commission
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
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Bank</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Payment Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((pmt) => (
                      <TableRow key={pmt.id} className={pmt.is_voided ? "opacity-50 bg-muted/30" : ""}>
                        <TableCell className="text-xs">
                          {pmt.is_voided ? (
                            <div>
                              <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {formatDate(pmt.voided_at)}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">Active</Badge>
                          )}
                        </TableCell>
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
                        <TableCell className={cn("text-xs text-right", pmt.is_voided && "line-through")}>{formatCurrency(pmt.payment_amount)}</TableCell>
                        <TableCell>
                          {pmt.is_voided ? (
                            <p className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={pmt.void_reason || ""}>
                              {pmt.void_reason || "No reason"}
                            </p>
                          ) : (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPayment(pmt); setPaymentDialogOpen(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                                onClick={() => { setVoidingPayment(pmt); setVoidPaymentDialogOpen(true); }}
                              >
                                Void
                              </Button>
                              {(isAdmin || isSuperAdmin) && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("payment", pmt.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
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
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-40"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id} className={bill.is_voided ? "opacity-50 bg-muted/30" : ""}>
                        <TableCell className="text-xs">
                          {bill.is_voided ? (
                            <div>
                              <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {bill.voided_at ? formatDate(bill.voided_at) : ""}
                              </p>
                            </div>
                          ) : (bill.balance || 0) <= 0 ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">Paid</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Open</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{bill.installer_company || "-"}</TableCell>
                        <TableCell className="text-xs">{bill.category || "-"}</TableCell>
                        <TableCell className={cn("text-xs text-right", bill.is_voided && "line-through")}>{formatCurrency(bill.bill_amount)}</TableCell>
                        <TableCell className={cn("text-xs text-right text-emerald-600", bill.is_voided && "line-through")}>{formatCurrency(bill.amount_paid)}</TableCell>
                        <TableCell className={cn("text-xs text-right", bill.is_voided && "line-through")}>{formatCurrency(bill.balance)}</TableCell>
                        <TableCell>
                          {bill.attachment_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSelectedAttachment({ url: bill.attachment_url!, name: bill.installer_company ? `Bill - ${bill.installer_company}` : "Bill Attachment" });
                                setPdfViewerOpen(true);
                              }}
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {bill.is_voided ? (
                            <p className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={bill.void_reason || ""}>
                              {bill.void_reason || "No reason"}
                            </p>
                          ) : (
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs px-2"
                                onClick={() => { setHistoryBill(bill); setHistoryDialogOpen(true); }}
                              >
                                <History className="h-3 w-3 mr-1" />
                                History
                              </Button>
                              {(bill.balance || 0) > 0 && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs px-2"
                                  onClick={() => { setPayingBill(bill); setQuickPayDialogOpen(true); }}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditBillClick(bill)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                                onClick={() => { setVoidingBill(bill); setVoidDialogOpen(true); }}
                              >
                                Void
                              </Button>
                              {(isAdmin || isSuperAdmin) && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick("bill", bill.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
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
                      <TableHead className="text-xs text-right">Phases Total</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map((agreement) => {
                      const phasesTotal = paymentPhases
                        .filter(p => p.agreement_id === agreement.id)
                        .reduce((sum, p) => sum + (p.amount || 0), 0);
                      const contractValue = agreement.total_price || 0;
                      const isBalanced = Math.abs(contractValue - phasesTotal) < 0.01;
                      
                      return (
                      <TableRow 
                        key={agreement.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${!isBalanced ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                        onClick={() => {
                          setSelectedAgreementFilter(agreement.id);
                          setActiveSubTab("phases");
                        }}
                      >
                        <TableCell className="text-xs font-medium text-primary underline">{agreement.agreement_number || "-"}</TableCell>
                        <TableCell className="text-xs">{agreement.agreement_type || "-"}</TableCell>
                        <TableCell className="text-xs">{formatDate(agreement.agreement_signed_date)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(agreement.total_price)}</TableCell>
                        <TableCell className={`text-xs text-right ${isBalanced ? 'text-emerald-600' : phasesTotal > contractValue ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatCurrency(phasesTotal)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {agreement.attachment_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSelectedAttachment({ url: agreement.attachment_url!, name: agreement.agreement_number ? `Agreement #${agreement.agreement_number}` : (agreement.agreement_type || "Agreement") });
                                setPdfViewerOpen(true);
                              }}
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                      );
                    })}
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
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Payment Phases</CardTitle>
                  {selectedAgreementFilter && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      {agreements.find(a => a.id === selectedAgreementFilter)?.agreement_number || "Contract"}
                      <button 
                        onClick={() => setSelectedAgreementFilter(null)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </div>
                <Button size="sm" onClick={() => { setEditingPhase(null); setPhaseDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPhases || loadingAgreements ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : agreements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No contracts yet. Add a contract first to create payment phases.</p>
              ) : (
                <div className="space-y-6">
                  {agreements
                    .filter(a => !selectedAgreementFilter || a.id === selectedAgreementFilter)
                    .map((agreement) => {
                    const agreementPhases = paymentPhases.filter(p => p.agreement_id === agreement.id);
                    const phasesTotal = agreementPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
                    const contractTotal = agreement.total_price || 0;
                    const balance = contractTotal - phasesTotal;
                    const isBalanced = Math.abs(balance) < 0.01;

                    return (
                      <Collapsible key={agreement.id} defaultOpen={selectedAgreementFilter === agreement.id}>
                        <div className="border rounded-lg overflow-hidden">
                          {/* Agreement Header - now clickable */}
                          <CollapsibleTrigger asChild>
                            <div className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${isBalanced ? 'bg-emerald-500/10 border-b border-emerald-500/20' : 'bg-amber-500/10 border-b border-amber-500/20'}`}>
                              <div className="flex items-center gap-3">
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {agreement.agreement_number || 'Unnamed Contract'}
                                    {agreement.agreement_type && <span className="text-muted-foreground font-normal"> • {agreement.agreement_type}</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Contract Total: {formatCurrency(contractTotal)} • {agreementPhases.length} phase{agreementPhases.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Phases Total: {formatCurrency(phasesTotal)}</p>
                                {isBalanced ? (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                                    Balanced
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className={`text-xs ${balance > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-red-500/10 text-red-600 border-red-500/30'}`}>
                                    {balance > 0 ? `Missing: ${formatCurrency(balance)}` : `Over: ${formatCurrency(Math.abs(balance))}`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          {/* Phases Table - Collapsible Content */}
                          <CollapsibleContent>
                            {agreementPhases.length === 0 ? (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground">No phases for this contract</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => { setEditingPhase(null); setPhaseDialogOpen(true); }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Phase
                                </Button>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Phase</TableHead>
                                    <TableHead className="text-xs">Due Date</TableHead>
                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs w-20"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {agreementPhases.map((phase) => {
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
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7" 
                                              title="Add Invoice from Phase"
                                              onClick={() => { 
                                                setEditingInvoice(null);
                                                setPrePopulatedInvoice({
                                                  agreement_id: phase.agreement_id,
                                                  payment_phase_id: phase.id,
                                                  amount: (phase.amount || 0) - invoiceStatus.totalInvoiced,
                                                  invoice_date: new Date().toISOString().split('T')[0],
                                                });
                                                setInvoiceDialogOpen(true); 
                                              }}
                                            >
                                              <FileText className="h-3 w-3" />
                                            </Button>
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
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Tab */}
        <TabsContent value="commission" className="mt-4">
          <CommissionTab
            projectId={projectId}
            totalContracts={totalAgreementsValue}
            leadCostPercent={leadCostPercent}
            commissionSplitPct={commissionSplitPct}
            totalBillsPaid={totalBillsPaid}
            salespeople={salespeople}
          />
        </TabsContent>
      </Tabs>

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open);
          if (!open) setPrePopulatedInvoice(null);
        }}
        invoice={editingInvoice}
        prePopulatedData={prePopulatedInvoice}
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
        onAddSubcontractor={onNavigateToSubcontractors}
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

      {/* Quick Pay Dialog */}
      <QuickPayDialog
        open={quickPayDialogOpen}
        onOpenChange={setQuickPayDialogOpen}
        bill={payingBill}
        onSave={(payment) => payingBill && quickPayMutation.mutate({ billId: payingBill.id, payment })}
        isPending={quickPayMutation.isPending}
      />

      {/* Bill Payment History Dialog */}
      <BillPaymentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        bill={historyBill}
        projectId={projectId}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Void Bill Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={(open) => {
        setVoidDialogOpen(open);
        if (!open) {
          setVoidingBill(null);
          setVoidReason("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Bill</AlertDialogTitle>
            <AlertDialogDescription>
              {voidingBill?.installer_company && (
                <span className="font-medium">{voidingBill.installer_company} - </span>
              )}
              {formatCurrency(voidingBill?.bill_amount)}
              <br /><br />
              Once voided, this bill cannot be restored and will be excluded from all financial calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Reason for voiding <span className="text-destructive">*</span></Label>
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Enter reason for voiding this bill..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (voidingBill && user?.id && voidReason.trim()) {
                  voidBillMutation.mutate({ 
                    billId: voidingBill.id, 
                    reason: voidReason.trim(),
                    userId: user.id 
                  });
                }
              }} 
              disabled={!voidReason.trim() || voidBillMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {voidBillMutation.isPending ? "Voiding..." : "Void Bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Payment Dialog */}
      <AlertDialog open={voidPaymentDialogOpen} onOpenChange={(open) => { setVoidPaymentDialogOpen(open); if (!open) { setVoidingPayment(null); setVoidPaymentReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Void Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The payment of {formatCurrency(voidingPayment?.payment_amount)} will be marked as voided and excluded from all financial calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="voidPaymentReason">Reason for voiding <span className="text-destructive">*</span></Label>
            <Input
              id="voidPaymentReason"
              value={voidPaymentReason}
              onChange={(e) => setVoidPaymentReason(e.target.value)}
              placeholder="Enter reason for voiding this payment..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (voidingPayment && user?.id && voidPaymentReason.trim()) {
                  voidPaymentMutation.mutate({ 
                    paymentId: voidingPayment.id, 
                    reason: voidPaymentReason.trim(),
                    userId: user.id 
                  });
                }
              }} 
              disabled={!voidPaymentReason.trim() || voidPaymentMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {voidPaymentMutation.isPending ? "Voiding..." : "Void Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF/Image Viewer Dialog */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={(open) => {
          setPdfViewerOpen(open);
          if (!open) {
            setSelectedAttachment(null);
          }
        }}
        fileUrl={selectedAttachment?.url || ""}
        fileName={selectedAttachment?.name || ""}
      />
    </div>
  );
}

// Invoice Dialog Component
function InvoiceDialog({ 
  open, 
  onOpenChange, 
  invoice,
  prePopulatedData,
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
  prePopulatedData?: Partial<Invoice> | null;
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
  const [phaseError, setPhaseError] = useState("");

  // Reset form when dialog opens or invoice/prePopulatedData changes
  useEffect(() => {
    if (!open) return;
    
    if (invoice) {
      // Derive agreement_id from payment phase if not set on invoice
      let agreementId = invoice.agreement_id || "";
      if (!agreementId && invoice.payment_phase_id) {
        const phase = paymentPhases.find(p => p.id === invoice.payment_phase_id);
        if (phase) {
          agreementId = phase.agreement_id || "";
        }
      }
      setFormData({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        amount: invoice.amount?.toString() || "",
        agreement_id: agreementId,
        payment_phase_id: invoice.payment_phase_id || "",
      });
    } else if (prePopulatedData) {
      // Pre-populate from payment phase
      setFormData({
        invoice_number: "",
        invoice_date: prePopulatedData.invoice_date || new Date().toISOString().split('T')[0],
        amount: prePopulatedData.amount?.toString() || "",
        agreement_id: prePopulatedData.agreement_id || "",
        payment_phase_id: prePopulatedData.payment_phase_id || "",
      });
    } else {
      setFormData({ invoice_number: "", invoice_date: "", amount: "", agreement_id: "", payment_phase_id: "" });
    }
    setAmountError("");
    setPhaseError("");
  }, [open, invoice, prePopulatedData, paymentPhases]);

  // Filter phases by selected agreement, but always include the currently selected phase
  const filteredPhases = useMemo(() => {
    const baseFiltered = formData.agreement_id 
      ? paymentPhases.filter(p => p.agreement_id === formData.agreement_id)
      : [];
    
    // Ensure currently selected phase is included for display purposes
    if (formData.payment_phase_id && !baseFiltered.some(p => p.id === formData.payment_phase_id)) {
      const selectedPhase = paymentPhases.find(p => p.id === formData.payment_phase_id);
      if (selectedPhase) {
        return [selectedPhase, ...baseFiltered];
      }
    }
    return baseFiltered;
  }, [formData.agreement_id, formData.payment_phase_id, paymentPhases]);

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
    setPhaseError("");
  };

  const handleAmountChange = (value: string) => {
    setFormData(p => ({ ...p, amount: value }));
    setAmountError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount) || 0;
    
    // Validate payment phase is selected
    if (!formData.payment_phase_id) {
      setPhaseError("Payment phase is required");
      // If phases aren't loaded properly, refresh the page
      if (paymentPhases.length === 0) {
        window.location.reload();
      }
      return;
    }
    
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
      payment_phase_id: formData.payment_phase_id,
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
              <Select 
                value={formData.agreement_id} 
                onValueChange={handleAgreementChange}
                disabled={!!prePopulatedData}
              >
                <SelectTrigger className={prePopulatedData ? "opacity-70" : ""}>
                  <SelectValue placeholder="Select agreement" />
                </SelectTrigger>
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
                disabled={!formData.agreement_id || !!prePopulatedData}
              >
                <SelectTrigger className={prePopulatedData ? "opacity-70" : ""}>
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
              {phaseError && <p className="text-xs text-destructive mt-1">{phaseError}</p>}
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
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  // Fetch existing bank names from banks table
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .order("name");
      if (error) throw error;
      return data.map(b => b.name);
    },
    enabled: open,
  });

  const queryClient = useQueryClient();

  // Mutation to add new bank
  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      const { error } = await supabase
        .from("banks")
        .insert({ name: bankName })
        .select()
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
    },
  });

  const handleAddBank = (bankName: string) => {
    setFormData(p => ({ ...p, bank_name: bankName }));
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank => 
    bank.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Initialize form data when dialog opens or payment changes
  useEffect(() => {
    if (open && payment) {
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
    } else if (open) {
      setFormData({ bank_name: "", projected_received_date: "", payment_schedule: "", payment_status: "Pending", payment_amount: "", payment_fee: "", check_number: "", invoice_id: "" });
    }
    setAmountError("");
    setBankSearch("");
  }, [open, payment]);

  const handleOpenChange = (newOpen: boolean) => {
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
              <Label>Bank Account</Label>
              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formData.bank_name || "Select or add..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 z-50" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search or add new..." 
                      value={bankSearch}
                      onValueChange={setBankSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {bankSearch ? `No bank found. Press enter or click below to add "${bankSearch}".` : "Type to search or add a bank."}
                      </CommandEmpty>
                      <CommandGroup>
                        {bankSearch && !filteredBanks.some(b => b.toLowerCase() === bankSearch.toLowerCase()) && (
                          <CommandItem
                            value={`add-${bankSearch}`}
                            onSelect={() => handleAddBank(bankSearch)}
                            className="cursor-pointer"
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            Add "{bankSearch}"
                          </CommandItem>
                        )}
                        {filteredBanks.map((bank) => (
                          <CommandItem
                            key={bank}
                            value={bank}
                            onSelect={() => {
                              setFormData(p => ({ ...p, bank_name: bank }));
                              setBankOpen(false);
                              setBankSearch("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.bank_name === bank ? "opacity-100" : "opacity-0")} />
                            {bank}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

// Bill Dialog Component - simplified (payments handled via QuickPay only)
function BillDialog({ 
  open, 
  onOpenChange, 
  bill, 
  onSave, 
  isPending,
  projectId,
  agreements,
  onAddSubcontractor,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (data: Partial<Bill>) => void;
  isPending: boolean;
  projectId: string;
  agreements: Agreement[];
  onAddSubcontractor?: () => void;
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
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Predefined categories
  const predefinedCategories = ["Materials", "Labor", "Permits", "Equipment", "Subcontractor"];

  // Fetch active subcontractors from subcontractors table
  const { data: activeSubcontractors = [] } = useQuery({
    queryKey: ["active-subcontractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data;
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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (bill) {
        setFormData({
          installer_company: bill.installer_company || "",
          category: bill.category || "",
          bill_ref: bill.bill_ref || "",
          bill_amount: bill.bill_amount?.toString() || "",
          memo: bill.memo || "",
          attachment_url: bill.attachment_url || null,
          agreement_id: bill.agreement_id || "",
        });
      } else {
        setFormData({ 
          installer_company: "", 
          category: "", 
          bill_ref: "", 
          bill_amount: "", 
          memo: "", 
          attachment_url: null, 
          agreement_id: "" 
        });
      }
    }
  }, [open, bill]);

  const billAmount = parseFloat(formData.bill_amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      installer_company: formData.installer_company || null,
      category: formData.category || null,
      bill_ref: formData.bill_ref || null,
      bill_amount: billAmount,
      memo: formData.memo || null,
      attachment_url: formData.attachment_url,
      agreement_id: formData.agreement_id || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill ? "Edit Bill" : "Add Bill"}</DialogTitle>
          <DialogDescription>Enter bill details below. Payments are recorded separately via the "Record Payment" button.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subcontractor/Installer</Label>
              <Select 
                value={formData.installer_company} 
                onValueChange={(value) => {
                  if (value === "__add_new__") {
                    onOpenChange(false);
                    onAddSubcontractor?.();
                  } else {
                    setFormData(p => ({ ...p, installer_company: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subcontractor..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3 w-3" />
                      Add New Subcontractor
                    </span>
                  </SelectItem>
                  {activeSubcontractors.length === 0 ? (
                    <SelectItem value="__no_subs__" disabled>
                      No active subcontractors
                    </SelectItem>
                  ) : (
                    activeSubcontractors.map((sub) => (
                      <SelectItem key={sub.id} value={sub.company_name}>
                        {sub.company_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
              <Label>Contract <span className="text-destructive">*</span></Label>
              <Select value={formData.agreement_id} onValueChange={(v) => setFormData(p => ({ ...p, agreement_id: v }))}>
                <SelectTrigger className={!formData.agreement_id ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select contract (required)" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {agreements.length === 0 ? (
                    <SelectItem value="__no_contracts__" disabled>
                      No contracts - add one first
                    </SelectItem>
                  ) : (
                    agreements.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.agreement_number ? `${a.agreement_number} - ` : ""}{a.agreement_type || "Contract"} - {formatCurrency(a.total_price)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!formData.agreement_id && (
                <p className="text-xs text-destructive mt-1">A contract is required to track bill costs</p>
              )}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              type="submit" 
              disabled={isPending || !formData.agreement_id}
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
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

  // Populate form when agreement changes or dialog opens
  useEffect(() => {
    if (open && agreement) {
      setFormData({
        agreement_number: agreement.agreement_number || "",
        agreement_type: agreement.agreement_type || "",
        agreement_signed_date: agreement.agreement_signed_date || "",
        total_price: agreement.total_price?.toString() || "",
        description_of_work: agreement.description_of_work || "",
        attachment_url: agreement.attachment_url || null,
      });
    } else if (open && !agreement) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  const [agreementError, setAgreementError] = useState("");

  // Calculate which agreements are fully accounted for
  const getAvailableAgreements = () => {
    return agreements.filter(agreement => {
      const contractTotal = agreement.total_price || 0;
      const phasesTotal = paymentPhases
        .filter(p => p.agreement_id === agreement.id && p.id !== phase?.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      // Include if: editing this phase's agreement, or there's remaining balance
      if (phase?.agreement_id === agreement.id) return true;
      return phasesTotal < contractTotal;
    });
  };

  const availableAgreements = getAvailableAgreements();

  // Initialize form data when dialog opens or phase changes
  useEffect(() => {
    if (open && phase) {
      setFormData({
        phase_name: phase.phase_name || "",
        description: phase.description || "",
        due_date: phase.due_date || "",
        amount: phase.amount?.toString() || "",
        agreement_id: phase.agreement_id || "",
      });
    } else if (open && !phase) {
      setFormData({ phase_name: "", description: "", due_date: "", amount: "", agreement_id: "" });
    }
    setValidationWarning("");
    setAgreementError("");
  }, [open, phase]);

  const handleOpenChange = (newOpen: boolean) => {
    setValidationWarning("");
    setAgreementError("");
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
    
    // Validate agreement is selected
    if (!formData.agreement_id) {
      setAgreementError("Contract/Agreement is required");
      return;
    }
    
    onSave({
      phase_name: formData.phase_name || "New Phase",
      description: formData.description || null,
      due_date: formData.due_date || null,
      amount: parseFloat(formData.amount) || 0,
      agreement_id: formData.agreement_id,
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
            <Select 
              value={formData.agreement_id} 
              onValueChange={(v) => {
                setFormData(p => ({ ...p, agreement_id: v }));
                setAgreementError("");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
              <SelectContent>
                {availableAgreements.map((a) => {
                  const phasesTotal = paymentPhases
                    .filter(p => p.agreement_id === a.id && p.id !== phase?.id)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);
                  const remaining = (a.total_price || 0) - phasesTotal;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {a.agreement_number} - {a.agreement_type || "Contract"} ({formatCurrency(a.total_price)}) - Remaining: {formatCurrency(remaining)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {agreementError && <p className="text-xs text-destructive mt-1">{agreementError}</p>}
            {availableAgreements.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">All contracts are fully accounted for in payment phases.</p>
            )}
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

// Sold Amount (Original from Dispatch) Card Component - compact inline version
function SoldAmountOriginalCard({ 
  estimatedCost, 
  contractsTotal,
  onSave 
}: { 
  estimatedCost: number | null;
  contractsTotal: number;
  onSave: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(estimatedCost?.toString() || "");

  useEffect(() => {
    setValue(estimatedCost?.toString() || "");
  }, [estimatedCost]);

  const handleSave = () => {
    const numValue = parseFloat(value) || 0;
    onSave(numValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setValue(estimatedCost?.toString() || "");
      setIsEditing(false);
    }
  };

  const hasMismatch = estimatedCost !== null && estimatedCost > 0 && contractsTotal !== estimatedCost;

  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-md px-2 py-1.5",
      hasMismatch ? "bg-destructive/10 border border-destructive/30" : "bg-muted/50"
    )}>
      <DollarSign className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Sold (Dispatch):</span>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-5 w-20 text-xs px-1"
            autoFocus
          />
          <Button size="sm" className="h-5 w-5 p-0" onClick={handleSave}>
            <Check className="h-2.5 w-2.5" />
          </Button>
        </div>
      ) : (
        <>
          <span className={cn("text-xs font-semibold", hasMismatch && "text-destructive")}>{formatCurrency(estimatedCost)}</span>
          {hasMismatch && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-destructive/10 text-destructive border-destructive/20">
              ≠{formatCurrency(contractsTotal)}
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-4 w-4 ml-0.5" onClick={() => setIsEditing(true)}>
            <Pencil className="h-2.5 w-2.5" />
          </Button>
        </>
      )}
    </div>
  );
}

// Estimated Project Costs Card Component - compact inline version
function EstimatedProjectCostsCard({ 
  estimatedProjectCost,
  estimatedCost, 
  onSave 
}: { 
  estimatedProjectCost: number | null;
  estimatedCost: number | null;
  onSave: (value: number | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Calculate display value: use saved value or default to 50% of estimated_cost
  const displayValue = estimatedProjectCost !== null 
    ? estimatedProjectCost 
    : (estimatedCost ? estimatedCost * 0.5 : null);
  
  const [value, setValue] = useState(displayValue?.toString() || "");

  useEffect(() => {
    setValue(displayValue?.toString() || "");
  }, [displayValue]);

  const handleSave = () => {
    const numValue = parseFloat(value) || 0;
    onSave(numValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setValue(displayValue?.toString() || "");
      setIsEditing(false);
    }
  };

  const isDefaultValue = estimatedProjectCost === null && displayValue !== null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-md px-2 py-1.5",
      isDefaultValue ? "bg-amber-500/10" : "bg-muted/50"
    )}>
      <DollarSign className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Est. Costs:</span>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-5 w-20 text-xs px-1"
            autoFocus
          />
          <Button size="sm" className="h-5 w-5 p-0" onClick={handleSave}>
            <Check className="h-2.5 w-2.5" />
          </Button>
        </div>
      ) : (
        <>
          <span className="text-xs font-semibold">{formatCurrency(displayValue)}</span>
          {isDefaultValue && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
              Auto
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-4 w-4 ml-0.5" onClick={() => setIsEditing(true)}>
            <Pencil className="h-2.5 w-2.5" />
          </Button>
        </>
      )}
    </div>
  );
}

// Quick Pay Dialog Component
function QuickPayDialog({ 
  open, 
  onOpenChange, 
  bill,
  onSave, 
  isPending,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (payment: Omit<BillPayment, 'id' | 'bill_id'>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: "",
    payment_method: "",
    payment_reference: "",
    bank_name: "",
  });

  // Fetch existing bank names
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .order("name");
      if (error) throw error;
      return data.map(b => b.name);
    },
    enabled: open,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && bill) {
      setFormData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: (bill.balance || 0).toString(),
        payment_method: "",
        payment_reference: "",
        bank_name: "",
      });
    }
  }, [open, bill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      payment_date: formData.payment_date || null,
      payment_amount: parseFloat(formData.payment_amount) || 0,
      payment_method: formData.payment_method || null,
      payment_reference: formData.payment_reference || null,
      bank_name: formData.bank_name || null,
    });
  };

  const paymentAmount = parseFloat(formData.payment_amount) || 0;
  const balance = bill?.balance || 0;
  const isOverpaying = paymentAmount > balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {bill?.installer_company && <span className="font-medium">{bill.installer_company}</span>}
            {bill?.installer_company && " • "}
            Balance: <span className="font-semibold text-amber-600">{formatCurrency(balance)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bank Account - Required */}
          <div>
            <Label>Bank Account <span className="text-destructive">*</span></Label>
            <Select value={formData.bank_name} onValueChange={(v) => setFormData(p => ({ ...p, bank_name: v }))}>
              <SelectTrigger className={!formData.bank_name ? "border-destructive" : ""}>
                <SelectValue placeholder="Select bank account (required)" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {existingBanks.length === 0 ? (
                  <SelectItem value="__no_banks__" disabled>No banks configured</SelectItem>
                ) : (
                  existingBanks.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!formData.bank_name && (
              <p className="text-xs text-destructive mt-1">Bank account is required</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Date</Label>
              <Input 
                type="date" 
                value={formData.payment_date} 
                onChange={(e) => setFormData(p => ({ ...p, payment_date: e.target.value }))} 
              />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input 
                type="number" 
                value={formData.payment_amount} 
                onChange={(e) => setFormData(p => ({ ...p, payment_amount: e.target.value }))} 
                className={isOverpaying ? "border-destructive" : ""}
              />
              {isOverpaying && (
                <p className="text-xs text-destructive mt-1">Amount exceeds balance</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Method</Label>
              <Select value={formData.payment_method} onValueChange={(v) => setFormData(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
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
              <Label>Reference / Check #</Label>
              <Input 
                value={formData.payment_reference} 
                onChange={(e) => setFormData(p => ({ ...p, payment_reference: e.target.value }))} 
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => setFormData(p => ({ ...p, payment_amount: balance.toString() }))}
            >
              Pay Full Balance
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || paymentAmount <= 0 || !formData.bank_name}>
              {isPending ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Bill Payment History Dialog Component
function BillPaymentHistoryDialog({
  open,
  onOpenChange,
  bill,
  projectId,
  isAdmin,
  isSuperAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
  projectId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["bill-payments", bill?.id],
    queryFn: async () => {
      if (!bill?.id) return [];
      const { data, error } = await supabase
        .from("bill_payments")
        .select("*")
        .eq("bill_id", bill.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as BillPayment[];
    },
    enabled: !!bill?.id && open,
  });

  // Delete bill payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const payment = payments.find(p => p.id === paymentId);
      
      await logAudit({
        tableName: 'bill_payments',
        recordId: paymentId,
        action: 'DELETE',
        oldValues: payment,
        description: `Deleted bill payment of ${formatCurrency(payment?.payment_amount)}`,
      });

      const { error } = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;

      // Recalculate bill totals
      if (bill?.id) {
        const { data: remainingPayments } = await supabase
          .from("bill_payments")
          .select("payment_amount")
          .eq("bill_id", bill.id);
        
        const newTotalPaid = (remainingPayments || []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        const newBalance = (bill.bill_amount || 0) - newTotalPaid;

        await supabase
          .from("project_bills")
          .update({ amount_paid: newTotalPaid, balance: newBalance })
          .eq("id", bill.id);
      }
    },
    onSuccess: () => {
      toast.success("Payment deleted");
      queryClient.invalidateQueries({ queryKey: ["bill-payments", bill?.id] });
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setDeletePaymentId(null);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const totalPaid = payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const canDelete = isAdmin || isSuperAdmin;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              {bill?.installer_company && <span className="font-medium">{bill.installer_company}</span>}
              {bill?.installer_company && " • "}
              Bill Ref: <span className="font-medium">{bill?.bill_ref || "N/A"}</span>
              {" • "}
              Bill Amount: <span className="font-semibold">{formatCurrency(bill?.bill_amount)}</span>
            </DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Bank Account</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    {canDelete && <TableHead className="text-xs w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs">{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="text-xs">
                        {payment.bank_name ? (
                          <Badge variant="outline" className="text-[10px]">{payment.bank_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{payment.payment_method || "-"}</TableCell>
                      <TableCell className="text-xs">{payment.payment_reference || "-"}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 font-medium">
                        {formatCurrency(payment.payment_amount)}
                      </TableCell>
                      {canDelete && (
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => setDeletePaymentId(payment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4} className="text-xs">Total Paid</TableCell>
                    <TableCell className="text-xs text-right text-emerald-600">{formatCurrency(totalPaid)}</TableCell>
                    {canDelete && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">Remaining Balance:</span>
                <span className={cn("font-semibold", (bill?.balance || 0) > 0 ? "text-amber-600" : "text-emerald-600")}>
                  {formatCurrency(bill?.balance)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => { if (!open) setDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment record? This will update the bill balance accordingly. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletePaymentId) {
                  deletePaymentMutation.mutate(deletePaymentId);
                }
              }}
              disabled={deletePaymentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Commission Payment interface
interface CommissionPayment {
  id: string;
  project_id: string;
  salesperson_name: string;
  payment_date: string | null;
  payment_amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  bank_name: string | null;
}

// Commission Tab Component
function CommissionTab({
  projectId,
  totalContracts,
  leadCostPercent,
  commissionSplitPct,
  totalBillsPaid,
  salespeople,
}: {
  projectId: string;
  totalContracts: number;
  leadCostPercent: number;
  commissionSplitPct: number;
  totalBillsPaid: number;
  salespeople: SalespersonData[];
}) {
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CommissionPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Fetch commission payments
  const { data: commissionPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["commission-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_payments")
        .select("*")
        .eq("project_id", projectId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as CommissionPayment[];
    },
  });

  // Calculations: (Total Contracts - Lead Cost - Bills) × Split%
  const leadCostAmount = totalContracts * (leadCostPercent / 100);
  const profit = totalContracts - leadCostAmount - totalBillsPaid;
  const commissionPool = profit > 0 ? profit * (commissionSplitPct / 100) : 0;
  
  // Calculate total commission % to normalize if needed
  const totalCommissionPct = salespeople.reduce((sum, sp) => sum + sp.commissionPct, 0);
  
  // Calculate commission for each salesperson based on their share of the pool
  const salespeopleWithCommission = salespeople.map(sp => {
    const shareOfPool = totalCommissionPct > 0 ? sp.commissionPct / totalCommissionPct : 0;
    const commissionAmount = commissionPool * shareOfPool;
    // Calculate paid and balance for this salesperson
    const paid = commissionPayments
      .filter(p => p.salesperson_name === sp.name)
      .reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    return {
      ...sp,
      shareOfPool,
      commissionAmount,
      paid,
      balance: commissionAmount - paid,
    };
  });

  const totalCommissionOwed = salespeopleWithCommission.reduce((sum, sp) => sum + sp.commissionAmount, 0);
  const totalCommissionPaid = commissionPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalCommissionBalance = totalCommissionOwed - totalCommissionPaid;
  const companyProfit = profit - totalCommissionOwed;

  // Save payment mutation
  const savePaymentMutation = useMutation({
    mutationFn: async (payment: Partial<CommissionPayment>) => {
      if (editingPayment?.id) {
        await logAudit({
          tableName: 'commission_payments',
          recordId: editingPayment.id,
          action: 'UPDATE',
          oldValues: editingPayment,
          newValues: payment,
          description: `Updated commission payment ${formatCurrency(payment.payment_amount)} for ${payment.salesperson_name}`,
        });
        const { error } = await supabase
          .from("commission_payments")
          .update(payment)
          .eq("id", editingPayment.id);
        if (error) throw error;
      } else {
        const insertData = {
          project_id: projectId,
          salesperson_name: payment.salesperson_name!,
          payment_date: payment.payment_date,
          payment_amount: payment.payment_amount || 0,
          payment_method: payment.payment_method,
          payment_reference: payment.payment_reference,
          notes: payment.notes,
        };
        const { data: newPayment, error } = await supabase
          .from("commission_payments")
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tableName: 'commission_payments',
          recordId: newPayment.id,
          action: 'INSERT',
          newValues: newPayment,
          description: `Created commission payment ${formatCurrency(payment.payment_amount)} for ${payment.salesperson_name}`,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingPayment?.id ? "Payment updated" : "Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["commission-payments", projectId] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const payment = commissionPayments.find(p => p.id === paymentId);
      if (payment) {
        await logAudit({
          tableName: 'commission_payments',
          recordId: paymentId,
          action: 'DELETE',
          oldValues: payment,
          description: `Deleted commission payment ${formatCurrency(payment.payment_amount)} for ${payment.salesperson_name}`,
        });
      }
      const { error } = await supabase
        .from("commission_payments")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment deleted");
      queryClient.invalidateQueries({ queryKey: ["commission-payments", projectId] });
      setDeleteDialogOpen(false);
      setDeletingPaymentId(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Contracts</div>
          <p className="text-lg font-semibold">{formatCurrency(totalContracts)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Lead Cost ({leadCostPercent}%)</div>
          <p className="text-lg font-semibold text-amber-600">{formatCurrency(leadCostAmount)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Bills</div>
          <p className="text-lg font-semibold text-amber-600">-{formatCurrency(totalBillsPaid)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Project Profit</div>
          <p className={cn("text-lg font-semibold", profit >= 0 ? "text-emerald-600" : "text-destructive")}>
            {formatCurrency(profit)}
          </p>
        </Card>
      </div>

      {/* Commission Pool & Company Profit - Same Line */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 border-primary/20">
          <div className="text-xs text-muted-foreground">Commission Pool ({commissionSplitPct}%)</div>
          <p className={cn("text-lg font-bold", commissionPool >= 0 ? "text-primary" : "text-destructive")}>
            {formatCurrency(commissionPool)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            (Contracts - Lead - Bills) × {commissionSplitPct}%
          </p>
        </Card>
        <Card className="p-3 border-emerald-500/20">
          <div className="text-xs text-muted-foreground">Company Profit (After Comm)</div>
          <p className={cn("text-lg font-bold", companyProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
            {formatCurrency(companyProfit)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Profit - Commission Pool
          </p>
        </Card>
      </div>

      {/* Salesperson Commission Breakdown */}
      {salespeople.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Commission Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Commission pool divided among salespeople based on their Commission %
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}>
                <Plus className="h-3 w-3 mr-1" />
                Record Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Salesperson</TableHead>
                  <TableHead className="text-xs text-right">Comm %</TableHead>
                  <TableHead className="text-xs text-right">Commission</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespeopleWithCommission.map((sp, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs font-medium">{sp.name || "-"}</TableCell>
                    <TableCell className="text-xs text-right">{sp.commissionPct}%</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-emerald-600">
                      {formatCurrency(sp.commissionAmount)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {formatCurrency(sp.paid)}
                    </TableCell>
                    <TableCell className={cn("text-xs text-right font-medium", sp.balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {formatCurrency(sp.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">{totalCommissionPct}%</TableCell>
                  <TableCell className="text-xs text-right text-emerald-600">{formatCurrency(totalCommissionOwed)}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{formatCurrency(totalCommissionPaid)}</TableCell>
                  <TableCell className={cn("text-xs text-right", totalCommissionBalance > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {formatCurrency(totalCommissionBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No salespeople assigned to this project</p>
          <p className="text-xs text-muted-foreground mt-1">Add salespeople in the Details tab</p>
        </Card>
      )}

      {/* Commission Payments History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Commission Payments</CardTitle>
          <CardDescription className="text-xs">
            History of commission payments made to salespeople
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPayments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : commissionPayments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No commission payments recorded yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Salesperson</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-xs">{formatDate(payment.payment_date)}</TableCell>
                    <TableCell className="text-xs font-medium">{payment.salesperson_name}</TableCell>
                    <TableCell className="text-xs">{payment.payment_method || "-"}</TableCell>
                    <TableCell className="text-xs">{payment.payment_reference || "-"}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-emerald-600">
                      {formatCurrency(payment.payment_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => { setEditingPayment(payment); setPaymentDialogOpen(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => { setDeletingPaymentId(payment.id); setDeleteDialogOpen(true); }}
                        >
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

      {/* Commission Payment Dialog */}
      <CommissionPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        editingPayment={editingPayment}
        salespeople={salespeople}
        salespeopleWithCommission={salespeopleWithCommission}
        onSave={(payment) => savePaymentMutation.mutate(payment)}
        isPending={savePaymentMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commission Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The payment record will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPaymentId && deletePaymentMutation.mutate(deletingPaymentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Commission Payment Dialog Component
function CommissionPaymentDialog({
  open,
  onOpenChange,
  editingPayment,
  salespeople,
  salespeopleWithCommission,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPayment: CommissionPayment | null;
  salespeople: SalespersonData[];
  salespeopleWithCommission: { name: string | null; balance: number }[];
  onSave: (payment: Partial<CommissionPayment>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    salesperson_name: "",
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: "",
    payment_method: "",
    payment_reference: "",
    notes: "",
    bank_name: "",
  });

  // Fetch existing bank names from banks table
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .order("name");
      if (error) throw error;
      return data.map(b => b.name);
    },
    enabled: open,
  });

  // Reset form when dialog opens/closes or editing changes
  useEffect(() => {
    if (open) {
      if (editingPayment) {
        setFormData({
          salesperson_name: editingPayment.salesperson_name,
          payment_date: editingPayment.payment_date || new Date().toISOString().split('T')[0],
          payment_amount: editingPayment.payment_amount.toString(),
          payment_method: editingPayment.payment_method || "",
          payment_reference: editingPayment.payment_reference || "",
          notes: editingPayment.notes || "",
          bank_name: editingPayment.bank_name || "",
        });
      } else {
        setFormData({
          salesperson_name: "",
          payment_date: new Date().toISOString().split('T')[0],
          payment_amount: "",
          payment_method: "",
          payment_reference: "",
          notes: "",
          bank_name: "",
        });
      }
    }
  }, [open, editingPayment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      salesperson_name: formData.salesperson_name,
      payment_date: formData.payment_date || null,
      payment_amount: parseFloat(formData.payment_amount) || 0,
      payment_method: formData.payment_method || null,
      payment_reference: formData.payment_reference || null,
      notes: formData.notes || null,
      bank_name: formData.bank_name || null,
    });
  };

  const selectedSalespersonBalance = salespeopleWithCommission.find(
    sp => sp.name === formData.salesperson_name
  )?.balance || 0;

  const paymentAmount = parseFloat(formData.payment_amount) || 0;
  const isOverpaying = formData.salesperson_name && paymentAmount > selectedSalespersonBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingPayment ? "Edit Commission Payment" : "Record Commission Payment"}</DialogTitle>
          <DialogDescription>
            Record a payment made to a salesperson for their commission
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Salesperson *</Label>
            <Select
              value={formData.salesperson_name}
              onValueChange={(v) => setFormData(p => ({ ...p, salesperson_name: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                {salespeople.filter(sp => sp.name).map((sp, index) => {
                  const spWithBalance = salespeopleWithCommission.find(s => s.name === sp.name);
                  return (
                    <SelectItem key={index} value={sp.name || ""}>
                      {sp.name} {spWithBalance ? `(Balance: ${formatCurrency(spWithBalance.balance)})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData(p => ({ ...p, payment_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.payment_amount}
                onChange={(e) => setFormData(p => ({ ...p, payment_amount: e.target.value }))}
                className={isOverpaying ? "border-amber-500" : ""}
              />
              {isOverpaying && (
                <p className="text-xs text-amber-600 mt-1">Amount exceeds balance</p>
              )}
            </div>
          </div>
          {formData.salesperson_name && selectedSalespersonBalance > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(p => ({ ...p, payment_amount: selectedSalespersonBalance.toString() }))}
              >
                Pay Full Balance ({formatCurrency(selectedSalespersonBalance)})
              </Button>
            </div>
          )}
          <div>
            <Label>Bank Account *</Label>
            <Select
              value={formData.bank_name}
              onValueChange={(v) => setFormData(p => ({ ...p, bank_name: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {existingBanks.map((bank) => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => setFormData(p => ({ ...p, payment_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
                  <SelectItem value="Zelle">Zelle</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Check #</Label>
              <Input
                value={formData.payment_reference}
                onChange={(e) => setFormData(p => ({ ...p, payment_reference: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isPending || !formData.salesperson_name || !formData.bank_name || paymentAmount <= 0}
            >
              {isPending ? "Saving..." : editingPayment ? "Update Payment" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
