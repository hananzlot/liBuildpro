import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { logAudit } from "@/hooks/useAuditLog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn, formatCurrency, formatCurrencyWithDecimals } from "@/lib/utils";
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
  initialBillsSubTab?: 'bills' | 'history';
  highlightInvoiceId?: string | null;
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
  original_bill_amount: number | null;
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
  offset_bill_id: string | null;
  created_at: string | null;
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

export function FinanceSection({ projectId, estimatedCost, estimatedProjectCost, totalPl, leadCostPercent, commissionSplitPct, salespeople, onUpdateProject, onNavigateToSubcontractors, autoOpenBillDialog, initialBillsSubTab, highlightInvoiceId }: FinanceSectionProps) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const [activeSubTab, setActiveSubTab] = useState(initialBillsSubTab ? "bills" : "agreements");
  const [activeBillsSubTab, setActiveBillsSubTab] = useState<"bills" | "history">(initialBillsSubTab || "bills");
  const [activeInvoicesSubTab, setActiveInvoicesSubTab] = useState<"invoices" | "payments">("invoices");
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

  // Set bills sub-tab when initialBillsSubTab changes
  useEffect(() => {
    if (initialBillsSubTab) {
      setActiveSubTab("bills");
      setActiveBillsSubTab(initialBillsSubTab);
    }
  }, [initialBillsSubTab]);

  // Auto-switch to invoices tab when highlighting an invoice
  useEffect(() => {
    if (highlightInvoiceId) {
      setActiveSubTab("invoices");
      setActiveInvoicesSubTab("invoices");
    }
  }, [highlightInvoiceId]);
  
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [prePopulatedInvoice, setPrePopulatedInvoice] = useState<Partial<Invoice> | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [prePopulatedPayment, setPrePopulatedPayment] = useState<Partial<Payment> | null>(null);
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

  // Fetch bill payments for all bills in this project
  const { data: allBillPayments = [], isLoading: loadingBillPayments } = useQuery({
    queryKey: ["project-bill-payments", projectId],
    queryFn: async () => {
      // First get all bill IDs for this project
      const { data: projectBills, error: billsError } = await supabase
        .from("project_bills")
        .select("id, installer_company, bill_ref")
        .eq("project_id", projectId);
      if (billsError) throw billsError;
      
      if (projectBills.length === 0) return [];
      
      const billIds = projectBills.map(b => b.id);
      const { data, error } = await supabase
        .from("bill_payments")
        .select("*")
        .in("bill_id", billIds)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      
      // Attach bill info to each payment
      return data.map(payment => ({
        ...payment,
        bill: projectBills.find(b => b.id === payment.bill_id),
      }));
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
          .insert({ ...invoice, project_id: projectId, company_id: companyId })
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
          .insert({ ...payment, project_id: projectId, company_id: companyId })
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

  // Quick toggle deposit verified
  const toggleDepositVerifiedMutation = useMutation({
    mutationFn: async ({ paymentId, depositVerified }: { paymentId: string; depositVerified: boolean }) => {
      const { error } = await supabase
        .from("project_payments")
        .update({ deposit_verified: depositVerified })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deposit status updated");
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits"] });
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
          .insert({ ...bill, amount_paid: 0, balance: bill.bill_amount || 0, project_id: projectId, company_id: companyId })
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

        // If this bill offsets a subcontractor bill, update the subcontractor bill
        if (bill.offset_bill_id) {
          const offsetAmount = bill.bill_amount || 0;
          
          // Get the target subcontractor bill
          const { data: targetBill, error: fetchError } = await supabase
            .from("project_bills")
            .select("id, bill_amount, original_bill_amount, amount_paid, balance")
            .eq("id", bill.offset_bill_id)
            .single();
          
          if (fetchError) throw fetchError;
          
          if (targetBill) {
            // Save original amount if not already saved
            const originalAmount = targetBill.original_bill_amount ?? targetBill.bill_amount;
            const newBillAmount = (targetBill.bill_amount || 0) - offsetAmount;
            const newBalance = newBillAmount - (targetBill.amount_paid || 0);
            
            const { error: updateError } = await supabase
              .from("project_bills")
              .update({ 
                original_bill_amount: originalAmount,
                bill_amount: newBillAmount,
                balance: newBalance
              })
              .eq("id", bill.offset_bill_id);
            
            if (updateError) throw updateError;
            
            await logAudit({
              tableName: 'project_bills',
              recordId: bill.offset_bill_id,
              action: 'UPDATE',
              oldValues: { bill_amount: targetBill.bill_amount, balance: targetBill.balance },
              newValues: { bill_amount: newBillAmount, balance: newBalance, original_bill_amount: originalAmount },
              description: `Applied ${formatCurrency(offsetAmount)} material offset - reduced bill from ${formatCurrency(targetBill.bill_amount)} to ${formatCurrency(newBillAmount)}`,
            });
          }
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

  // Quick pay mutation for adding a single payment to a bill
  const quickPayMutation = useMutation({
    mutationFn: async ({ billId, payment }: { billId: string; payment: Omit<BillPayment, 'id' | 'bill_id'> }) => {
      // Insert the payment
      const { data: newPayment, error: paymentError } = await supabase
        .from("bill_payments")
        .insert({ ...payment, bill_id: billId, company_id: companyId })
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
          .insert({ ...agreement, project_id: projectId, company_id: companyId })
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
            company_id: companyId,
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

  // Track payments associated with invoice being deleted
  const [invoicePaymentsToDelete, setInvoicePaymentsToDelete] = useState<Payment[]>([]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) {
        throw new Error("Nothing selected to delete");
      }
      const table = deleteTarget.type === "invoice" ? "project_invoices" 
        : deleteTarget.type === "payment" ? "project_payments" 
        : deleteTarget.type === "agreement" ? "project_agreements"
        : deleteTarget.type === "phase" ? "project_payment_phases"
        : "project_bills";

      // If deleting an invoice with associated payments, delete payments first
      if (deleteTarget.type === "invoice" && invoicePaymentsToDelete.length > 0) {
        for (const payment of invoicePaymentsToDelete) {
          await logAudit({
            tableName: "project_payments",
            recordId: payment.id,
            action: 'DELETE',
            description: `Deleted payment (cascade from invoice delete)`,
          });
          const { error: paymentError } = await supabase.from("project_payments").delete().eq("id", payment.id);
          if (paymentError) throw paymentError;
        }
      }
      
      // If deleting a bill, handle offset relationships
      if (deleteTarget.type === "bill") {
        // Check if this bill is an offset bill (has offset_bill_id) - need to reverse the offset
        const billToDelete = bills.find(b => b.id === deleteTarget.id);
        if (billToDelete?.offset_bill_id) {
          // Get the target bill and reverse the offset
          const targetBill = bills.find(b => b.id === billToDelete.offset_bill_id);
          if (targetBill) {
            const offsetAmount = billToDelete.bill_amount || 0;
            const newBillAmount = (targetBill.bill_amount || 0) + offsetAmount;
            const newBalance = newBillAmount - (targetBill.amount_paid || 0);
            
            const { error: updateError } = await supabase
              .from("project_bills")
              .update({ 
                bill_amount: newBillAmount,
                balance: newBalance
              })
              .eq("id", billToDelete.offset_bill_id);
            
            if (updateError) throw updateError;
            
            await logAudit({
              tableName: 'project_bills',
              recordId: billToDelete.offset_bill_id,
              action: 'UPDATE',
              description: `Reversed ${formatCurrency(offsetAmount)} material offset - restored bill from ${formatCurrency(targetBill.bill_amount)} to ${formatCurrency(newBillAmount)}`,
            });
          }
        }
        
        // Check if any bills reference this one as offset_bill_id - clear those references first
        const { data: referencingBills } = await supabase
          .from("project_bills")
          .select("id, bill_amount")
          .eq("offset_bill_id", deleteTarget.id);
        
        if (referencingBills && referencingBills.length > 0) {
          for (const refBill of referencingBills) {
            const { error: clearError } = await supabase
              .from("project_bills")
              .update({ offset_bill_id: null })
              .eq("id", refBill.id);
            if (clearError) throw clearError;
          }
        }
      }
      
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
        // Also invalidate payments since we may have deleted associated payments
        queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
        queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
        // Invalidate sidebar AR total
        queryClient.invalidateQueries({ queryKey: ["sidebar-ar-total"] });
      } else if (deleteTarget?.type === "payment") {
        queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      } else if (deleteTarget?.type === "bill") {
        queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
        queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setInvoicePaymentsToDelete([]);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const handleDeleteClick = (type: string, id: string) => {
    // If deleting a phase, check for associated payments first
    if (type === "phase") {
      const paymentsForPhase = activePayments.filter(p => p.payment_phase_id === id);
      if (paymentsForPhase.length > 0) {
        const totalReceived = paymentsForPhase.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        toast.error(`Cannot delete phase: ${formatCurrency(totalReceived)} in payments have been recorded. Please void or remove payments first.`);
        return;
      }
    }
    
    // If deleting an invoice, check for associated payments
    if (type === "invoice") {
      const associatedPayments = payments.filter(p => p.invoice_id === id);
      setInvoicePaymentsToDelete(associatedPayments);
    } else {
      setInvoicePaymentsToDelete([]);
    }
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

  // Calculate offsets for each bill (material/equipment bills that offset subcontractor invoices)
  const billOffsets = useMemo(() => {
    const offsetMap: Record<string, { offsetBills: Bill[]; totalOffset: number }> = {};
    
    bills.forEach((bill) => {
      if (bill.offset_bill_id && !bill.is_voided) {
        if (!offsetMap[bill.offset_bill_id]) {
          offsetMap[bill.offset_bill_id] = { offsetBills: [], totalOffset: 0 };
        }
        offsetMap[bill.offset_bill_id].offsetBills.push(bill);
        offsetMap[bill.offset_bill_id].totalOffset += bill.bill_amount || 0;
      }
    });
    
    return offsetMap;
  }, [bills]);

  // Get which bill this offset bill is applied to
  const getOffsetTargetBill = (offsetBillId: string | null) => {
    if (!offsetBillId) return null;
    return bills.find(b => b.id === offsetBillId);
  };

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

      {/* Sold Amount, Estimated Costs & Summary Badges - Single row */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
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
        
        {/* Summary Cards - Right aligned */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5 border">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Sold:</span>
            <span className="text-xs font-semibold">{formatCurrency(totalAgreementsValue)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5 border">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Invoiced:</span>
            <span className="text-xs font-semibold">{formatCurrency(totalInvoiced)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded-md px-2 py-1.5 border border-emerald-200">
            <CreditCard className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] text-muted-foreground">Received:</span>
            <span className="text-xs font-semibold text-emerald-600">{formatCurrency(totalPaymentsReceived)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5 border">
            <Receipt className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Bills:</span>
            <span className="text-xs font-semibold">{formatCurrency(totalBills)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 rounded-md px-2 py-1.5 border border-amber-200">
            <AlertCircle className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] text-muted-foreground">Outstanding:</span>
            <span className="text-xs font-semibold text-amber-600">{formatCurrency(totalBills - totalBillsPaid)}</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs for Agreements, Phases, Invoices, Payments, Bills, Commission */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agreements" className="text-xs">
            Contracts
          </TabsTrigger>
          <TabsTrigger value="phases" className="text-xs">
            Phases
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            Invoices
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
                <CardTitle className="text-sm">Invoices & Payments</CardTitle>
                {activeInvoicesSubTab === "invoices" ? (
                  <Button size="sm" onClick={() => { setEditingInvoice(null); setInvoiceDialogOpen(true); }}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Invoice
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Payment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Sub-tabs for Invoices */}
              <div className="flex gap-2 mb-4 border-b">
                <button
                  onClick={() => setActiveInvoicesSubTab("invoices")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    activeInvoicesSubTab === "invoices"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Invoices ({invoices.length})
                </button>
                <button
                  onClick={() => setActiveInvoicesSubTab("payments")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    activeInvoicesSubTab === "payments"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pmts Rcvd ({payments.length})
                </button>
              </div>

              {activeInvoicesSubTab === "invoices" ? (
                // Invoices list
                <>
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
                          <TableRow 
                            key={inv.id}
                            className={cn(
                              highlightInvoiceId === inv.id && "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse"
                            )}
                          >
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
                </>
              ) : (
                // Payments list
                <>
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
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={
                                  pmt.payment_status === "Received" ? "bg-emerald-500/10 text-emerald-500" :
                                  pmt.payment_status === "Pending" ? "bg-amber-500/10 text-amber-500" :
                                  "bg-muted"
                                }>
                                  {pmt.payment_status || "Pending"}
                                </Badge>
                                {pmt.payment_status === "Received" && !pmt.is_voided && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "h-5 px-1.5 text-[10px] gap-1",
                                          pmt.deposit_verified 
                                            ? "text-emerald-600 hover:text-emerald-700" 
                                            : "text-amber-600 hover:text-amber-700"
                                        )}
                                        onClick={() => toggleDepositVerifiedMutation.mutate({ 
                                          paymentId: pmt.id, 
                                          depositVerified: !pmt.deposit_verified 
                                        })}
                                        disabled={toggleDepositVerifiedMutation.isPending}
                                      >
                                        <Checkbox 
                                          checked={pmt.deposit_verified ?? false} 
                                          className="h-3 w-3 pointer-events-none"
                                        />
                                        {pmt.deposit_verified ? "Deposited" : "Not Deposited"}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Click to {pmt.deposit_verified ? "unmark" : "mark"} as deposited</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Bills Tab */}
        <TabsContent value="bills" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Bills & Payments</CardTitle>
                {activeBillsSubTab === "bills" && (
                  <Button size="sm" onClick={() => { setEditingBill(null); setBillDialogOpen(true); }}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Bill
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Sub-tabs for Bills */}
              <div className="flex gap-2 mb-4 border-b">
                <button
                  onClick={() => setActiveBillsSubTab("bills")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    activeBillsSubTab === "bills"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bills ({bills.length})
                </button>
                <button
                  onClick={() => setActiveBillsSubTab("history")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    activeBillsSubTab === "history"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Payment History ({allBillPayments.length})
                </button>
              </div>

              {activeBillsSubTab === "bills" ? (
                // Bills list
                <>
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
                        {bills.map((bill) => {
                          const offsets = billOffsets[bill.id];
                          const offsetTarget = getOffsetTargetBill(bill.offset_bill_id);
                          const hasBeenOffset = bill.original_bill_amount !== null && bill.original_bill_amount !== bill.bill_amount;
                          
                          return (
                          <TableRow key={bill.id} className={cn(bill.is_voided && "opacity-50 bg-muted/30", bill.offset_bill_id && "bg-primary/5")}>
                            <TableCell className="text-xs">
                              {bill.is_voided ? (
                                <div>
                                  <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {bill.voided_at ? formatDate(bill.voided_at) : ""}
                                  </p>
                                </div>
                              ) : bill.offset_bill_id ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">Offset</Badge>
                              ) : (bill.balance || 0) <= 0 ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">Open</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>
                                {bill.installer_company || "-"}
                                {offsetTarget && (
                                  <p className="text-[10px] text-blue-600">
                                    → Offsets: {offsetTarget.installer_company}
                                  </p>
                                )}
                                {offsets && offsets.offsetBills.length > 0 && (
                                  <p className="text-[10px] text-amber-600">
                                    Materials offset applied
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{bill.category || "-"}</TableCell>
                            <TableCell className={cn("text-xs text-right", bill.is_voided && "line-through")}>
                              {hasBeenOffset ? (
                                <div>
                                  <span className="line-through text-muted-foreground">{formatCurrency(bill.original_bill_amount)}</span>
                                  <span className="ml-1 font-medium">{formatCurrency(bill.bill_amount)}</span>
                                </div>
                              ) : (
                                formatCurrency(bill.bill_amount)
                              )}
                            </TableCell>
                            <TableCell className={cn("text-xs text-right text-emerald-600", bill.is_voided && "line-through")}>{formatCurrency(bill.amount_paid)}</TableCell>
                            <TableCell className={cn("text-xs text-right", bill.is_voided && "line-through")}>
                              {formatCurrency(bill.balance)}
                            </TableCell>
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              ) : (
                // Payment History
                <>
                  {loadingBillPayments ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : allBillPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No payment history yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Company</TableHead>
                          <TableHead className="text-xs">Bill Ref</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Method</TableHead>
                          <TableHead className="text-xs">Reference</TableHead>
                          <TableHead className="text-xs">Bank</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allBillPayments.map((payment: any) => {
                          // Find the full bill record to pass to history dialog
                          const fullBill = bills.find(b => b.id === payment.bill_id);
                          return (
                            <TableRow 
                              key={payment.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => {
                                if (fullBill) {
                                  setHistoryBill(fullBill);
                                  setHistoryDialogOpen(true);
                                }
                              }}
                            >
                              <TableCell className="text-xs">{formatDate(payment.payment_date)}</TableCell>
                              <TableCell className="text-xs">{payment.bill?.installer_company || "-"}</TableCell>
                              <TableCell className="text-xs">{payment.bill?.bill_ref || "-"}</TableCell>
                              <TableCell className="text-xs text-right text-emerald-600 font-medium">
                                {formatCurrency(payment.payment_amount)}
                              </TableCell>
                              <TableCell className="text-xs">{payment.payment_method || "-"}</TableCell>
                              <TableCell className="text-xs">{payment.payment_reference || "-"}</TableCell>
                              <TableCell className="text-xs">{payment.bank_name || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {allBillPayments.length > 0 && (
                    <div className="mt-4 pt-3 border-t flex justify-end">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Paid: </span>
                        <span className="font-medium text-emerald-600">
                          {formatCurrency(allBillPayments.reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </>
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
                      const isBalanced = Math.abs(contractValue - phasesTotal) < 0.05;
                      
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
                        <TableCell className="text-xs text-right">{formatCurrencyWithDecimals(agreement.total_price)}</TableCell>
                        <TableCell className={`text-xs text-right ${isBalanced ? 'text-emerald-600' : phasesTotal > contractValue ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatCurrencyWithDecimals(phasesTotal)}
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
                    
                    // Calculate invoiced amount for this agreement's phases
                    const phaseIds = agreementPhases.map(p => p.id);
                    const invoicedForPhases = invoices
                      .filter(inv => inv.payment_phase_id && phaseIds.includes(inv.payment_phase_id))
                      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
                    const stillToInvoice = phasesTotal - invoicedForPhases;

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
                                <p className="text-xs text-muted-foreground">
                                  Phases Total: {formatCurrency(phasesTotal)} • 
                                  <span className="text-emerald-600"> Invoiced: {formatCurrency(invoicedForPhases)}</span> • 
                                  <span className={stillToInvoice > 0 ? "text-amber-600" : "text-muted-foreground"}> To Invoice: {formatCurrency(stillToInvoice)}</span>
                                </p>
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
                                            {!isFullyInvoiced && (
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
                                            )}
                                            {(() => {
                                              // Find the first invoice with open balance for this phase
                                              const phaseInvoice = invoices.find(inv => 
                                                inv.payment_phase_id === phase.id && (inv.open_balance || 0) > 0
                                              );
                                              return phaseInvoice ? (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-7 w-7 text-emerald-600" 
                                                  title={`Record Payment for Invoice #${phaseInvoice.invoice_number || 'N/A'}`}
                                                  onClick={() => { 
                                                    setEditingPayment(null);
                                                    setPrePopulatedPayment({
                                                      invoice_id: phaseInvoice.id,
                                                      payment_amount: phaseInvoice.open_balance || 0,
                                                    });
                                                    setPaymentDialogOpen(true); 
                                                  }}
                                                >
                                                  <DollarSign className="h-3 w-3" />
                                                </Button>
                                              ) : null;
                                            })()}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPhase(phase); setPhaseDialogOpen(true); }}>
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            {(() => {
                                              const phasePayments = activePayments.filter(p => p.payment_phase_id === phase.id);
                                              const hasPayments = phasePayments.length > 0;
                                              const paymentTotal = phasePayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
                                              return hasPayments ? (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="inline-flex">
                                                      <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-muted-foreground cursor-not-allowed opacity-50" 
                                                        disabled
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </span>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p className="text-xs">Cannot delete: {formatCurrency(paymentTotal)} in payments recorded</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              ) : (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-7 w-7 text-destructive" 
                                                  onClick={() => handleDeleteClick("phase", phase.id)}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              );
                                            })()}
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
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setPrePopulatedPayment(null);
            setEditingPayment(null);
          }
        }}
        payment={editingPayment}
        prePopulatedData={prePopulatedPayment}
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
        allBills={bills}
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
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={invoicePaymentsToDelete.length > 0 ? "flex items-center gap-2" : ""}>
              {invoicePaymentsToDelete.length > 0 && <AlertCircle className="h-5 w-5 text-amber-600" />}
              Delete {deleteTarget?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {invoicePaymentsToDelete.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-amber-600 font-medium">
                    Warning: This invoice has {invoicePaymentsToDelete.length} payment{invoicePaymentsToDelete.length > 1 ? 's' : ''} recorded against it totaling {formatCurrency(invoicePaymentsToDelete.reduce((sum, p) => sum + (p.payment_amount || 0), 0))}.
                  </p>
                  <p>If you proceed, the following payments will also be deleted:</p>
                  <ul className="list-disc list-inside text-sm">
                    {invoicePaymentsToDelete.map(p => (
                      <li key={p.id}>
                        {formatCurrency(p.payment_amount)} - {p.payment_status} ({formatDate(p.projected_received_date)})
                      </li>
                    ))}
                  </ul>
                  <p className="font-medium">This action cannot be undone.</p>
                </div>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteTarget(null);
              setInvoicePaymentsToDelete([]);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()} 
              className={invoicePaymentsToDelete.length > 0 ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {invoicePaymentsToDelete.length > 0 ? "Delete Invoice & Payments" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Pay Dialog */}
      <QuickPayDialog
        open={quickPayDialogOpen}
        onOpenChange={setQuickPayDialogOpen}
        bill={payingBill}
        offsetBills={payingBill ? billOffsets[payingBill.id]?.offsetBills || [] : []}
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
  // Use JSON.stringify to ensure we detect object content changes
  const prePopulatedKey = prePopulatedData ? JSON.stringify(prePopulatedData) : null;
  
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
  }, [open, invoice, prePopulatedKey, paymentPhases]);

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
                type="text"
                inputMode="decimal"
                value={formData.amount} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    handleAmountChange(val);
                  }
                }}
                disabled={!!prePopulatedData}
                className={prePopulatedData ? "opacity-70 bg-muted" : ""}
              />
              {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              {formData.payment_phase_id && !prePopulatedData && (
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {formatCurrency(uninvoicedBalance)}
                </p>
              )}
              {prePopulatedData && (
                <p className="text-xs text-muted-foreground mt-1">
                  Amount set from phase
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
  prePopulatedData,
  onSave, 
  isPending,
  invoices,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  payment: Payment | null;
  prePopulatedData?: Partial<Payment> | null;
  onSave: (data: Partial<Payment>) => void;
  isPending: boolean;
  invoices: Invoice[];
}) {
  const { companyId } = useCompanyContext();
  const [formData, setFormData] = useState({
    bank_name: "",
    projected_received_date: "",
    payment_schedule: "",
    payment_status: "Pending",
    payment_amount: "",
    payment_fee: "",
    check_number: "",
    invoice_id: "",
    deposit_verified: false,
  });
  const [amountError, setAmountError] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  // Fetch existing bank names from banks table scoped by company
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.map(b => b.name).filter((name): name is string => typeof name === 'string');
    },
    enabled: open && !!companyId,
  });

  const queryClient = useQueryClient();

  // Mutation to add new bank scoped by company
  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("banks")
        .insert({ name: bankName, company_id: companyId })
        .select()
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
    },
  });

  const handleAddBank = (bankName: string) => {
    setFormData(p => ({ ...p, bank_name: bankName }));
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank => 
    bank && typeof bank === 'string' && bank.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Initialize form data when dialog opens or payment changes
  useEffect(() => {
    if (!open) return;
    
    if (payment) {
      setFormData({
        bank_name: payment.bank_name || "",
        projected_received_date: payment.projected_received_date || "",
        payment_schedule: payment.payment_schedule || "",
        payment_status: payment.payment_status || "Pending",
        payment_amount: payment.payment_amount?.toString() || "",
        payment_fee: payment.payment_fee?.toString() || "",
        check_number: payment.check_number || "",
        invoice_id: payment.invoice_id || "",
        deposit_verified: payment.deposit_verified ?? false,
      });
    } else if (prePopulatedData) {
      setFormData({
        bank_name: "",
        projected_received_date: new Date().toISOString().split('T')[0],
        payment_schedule: "",
        payment_status: "Received",
        payment_amount: prePopulatedData.payment_amount?.toString() || "",
        payment_fee: "",
        check_number: "",
        invoice_id: prePopulatedData.invoice_id || "",
        deposit_verified: false, // New payments default to not deposited
      });
    } else {
      setFormData({ bank_name: "", projected_received_date: "", payment_schedule: "", payment_status: "Pending", payment_amount: "", payment_fee: "", check_number: "", invoice_id: "", deposit_verified: false });
    }
    setAmountError("");
    setBankSearch("");
  }, [open, payment, prePopulatedData]);

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
      deposit_verified: formData.deposit_verified,
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
              <Label>Bank Account <span className="text-destructive">*</span></Label>
              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankOpen}
                    className={cn("w-full justify-between font-normal", !formData.bank_name && "border-destructive")}
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
              {!formData.bank_name && (
                <p className="text-xs text-destructive mt-1">Bank account is required</p>
              )}
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
                type="text"
                inputMode="decimal"
                value={formData.payment_amount} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setFormData(p => ({ ...p, payment_amount: val }));
                    setAmountError("");
                  }
                }} 
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
              <Input type="text" inputMode="decimal" value={formData.payment_fee} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, payment_fee: val })); }} />
            </div>
            <div>
              <Label>Check #</Label>
              <Input value={formData.check_number} onChange={(e) => setFormData(p => ({ ...p, check_number: e.target.value }))} />
            </div>
          </div>
          {formData.payment_status === "Received" && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="deposit_verified" 
                checked={formData.deposit_verified} 
                onCheckedChange={(checked) => setFormData(p => ({ ...p, deposit_verified: !!checked }))} 
              />
              <Label htmlFor="deposit_verified" className="text-sm font-normal cursor-pointer">
                Deposit Verified
              </Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !formData.bank_name}>{isPending ? "Saving..." : "Save"}</Button>
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
  allBills,
  onAddSubcontractor,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (data: Partial<Bill>) => void;
  isPending: boolean;
  projectId: string;
  agreements: Agreement[];
  allBills: Bill[];
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
    offset_bill_id: "",
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Predefined categories
  const predefinedCategories = ["Materials", "Labor", "Permits", "Equipment", "Subcontractor"];

  // Categories that can offset subcontractor bills
  const offsetEligibleCategories = ["Materials", "Equipment"];
  const isOffsetEligible = offsetEligibleCategories.includes(formData.category);

  // Get subcontractor bills for the selected agreement (for offset dropdown)
  // Only show subcontractor invoices, never if the new bill vendor matches the subcontractor
  const subcontractorBillsForOffset = useMemo(() => {
    if (!formData.agreement_id || !isOffsetEligible) return [];
    return allBills.filter(b => 
      b.agreement_id === formData.agreement_id && 
      b.category === "Subcontractor" && // Must be a subcontractor invoice
      b.installer_company && // Must have a subcontractor name
      !b.is_voided &&
      b.id !== bill?.id && // Can't offset itself
      // Never show if the new bill's vendor is the same as the subcontractor
      (!formData.installer_company || b.installer_company !== formData.installer_company)
    );
  }, [allBills, formData.agreement_id, isOffsetEligible, bill?.id, formData.installer_company]);

  // Fetch active subcontractors from subcontractors table scoped by company
  const { companyId } = useCompanyContext();
  const { data: activeSubcontractors = [] } = useQuery({
    queryKey: ["active-subcontractors", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, company_name")
        .eq("is_active", true)
        .eq("company_id", companyId)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
  });

  // Fetch unique categories (combining predefined + existing) scoped by company
  const { data: existingCategories = [] } = useQuery({
    queryKey: ["bill-categories", companyId],
    queryFn: async () => {
      if (!companyId) return Array.from(new Set<string>(predefinedCategories)).sort();
      const { data, error } = await supabase
        .from("project_bills")
        .select("category")
        .eq("company_id", companyId);
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
          offset_bill_id: bill.offset_bill_id || "",
        });
      } else {
        setFormData({ 
          installer_company: "", 
          category: "", 
          bill_ref: "", 
          bill_amount: "", 
          memo: "", 
          attachment_url: null, 
          agreement_id: "",
          offset_bill_id: "",
        });
      }
    }
  }, [open, bill]);

  // Clear offset_bill_id when category changes to non-eligible
  useEffect(() => {
    if (!isOffsetEligible && formData.offset_bill_id) {
      setFormData(p => ({ ...p, offset_bill_id: "" }));
    }
  }, [isOffsetEligible, formData.offset_bill_id]);

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
      offset_bill_id: formData.offset_bill_id || null,
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
              <Label>Category <span className="text-destructive">*</span></Label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryOpen}
                    className={cn("w-full justify-between font-normal", !formData.category && "border-destructive")}
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
              {!formData.category && (
                <p className="text-xs text-destructive mt-1">Category is required</p>
              )}
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
              <Input type="text" inputMode="decimal" value={formData.bill_amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, bill_amount: val })); }} />
            </div>
            <div>
              <Label>Bill Reference</Label>
              <Input value={formData.bill_ref} onChange={(e) => setFormData(p => ({ ...p, bill_ref: e.target.value }))} placeholder="Invoice/PO number" />
            </div>
          </div>
          
          {/* Offset Subcontractor Bill - only show for Materials/Equipment */}
          {isOffsetEligible && subcontractorBillsForOffset.length > 0 && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Label className="text-sm font-medium">Apply as Offset to Subcontractor Invoice</Label>
              <p className="text-xs text-muted-foreground mb-2">
                This {formData.category.toLowerCase()} cost will reduce what you owe the selected subcontractor
              </p>
              <Select 
                value={formData.offset_bill_id} 
                onValueChange={(v) => setFormData(p => ({ ...p, offset_bill_id: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subcontractor invoice to offset..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="__none__">No offset (standalone bill)</SelectItem>
                  {subcontractorBillsForOffset.map((b) => {
                    const displayAmount = b.original_bill_amount ?? b.bill_amount;
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        {b.installer_company} - {b.bill_ref || 'No ref'} ({formatCurrency(displayAmount)}) - Balance: {formatCurrency(b.balance)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Memo/Description <span className="text-destructive">*</span></Label>
            <Input 
              value={formData.memo} 
              onChange={(e) => setFormData(p => ({ ...p, memo: e.target.value }))} 
              placeholder="Describe the work or expense"
              className={!formData.memo.trim() ? "border-destructive" : ""}
            />
            {!formData.memo.trim() && (
              <p className="text-xs text-destructive mt-1">Memo is required</p>
            )}
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
              disabled={isPending || !formData.agreement_id || !formData.category || !formData.memo.trim()}
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

  const [dateError, setDateError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required date for new agreements
    if (!agreement && !formData.agreement_signed_date) {
      setDateError("Date signed is required");
      return;
    }
    setDateError("");
    
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
              <Label>Date Signed <span className="text-destructive">*</span></Label>
              <Input 
                type="date" 
                value={formData.agreement_signed_date} 
                onChange={(e) => { setFormData(p => ({ ...p, agreement_signed_date: e.target.value })); setDateError(""); }} 
                required 
              />
              {dateError && <p className="text-xs text-destructive mt-1">{dateError}</p>}
            </div>
            <div>
              <Label>Total Value ($)</Label>
              <Input type="text" inputMode="decimal" value={formData.total_price} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, total_price: val })); }} />
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
            <Input type="text" inputMode="decimal" value={formData.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, amount: val })); }} />
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
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setValue(val); }}
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
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setValue(val); }}
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
  offsetBills = [],
  onSave, 
  isPending,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  offsetBills?: Bill[];
  onSave: (payment: Omit<BillPayment, 'id' | 'bill_id'>) => void;
  isPending: boolean;
}) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: "",
    payment_method: "",
    payment_reference: "",
    bank_name: "",
  });
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  // Fetch existing bank names scoped by company
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.map(b => b.name).filter((name): name is string => typeof name === 'string');
    },
    enabled: open && !!companyId,
  });

  // Mutation to add new bank scoped by company
  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("banks")
        .insert({ name: bankName, company_id: companyId })
        .select()
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
    },
  });

  const handleAddBank = (bankName: string) => {
    setFormData(p => ({ ...p, bank_name: bankName }));
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank => 
    bank && typeof bank === 'string' && bank.toLowerCase().includes(bankSearch.toLowerCase())
  );

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
      setBankSearch("");
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

  const hasBeenOffset = bill?.original_bill_amount !== null && bill?.original_bill_amount !== undefined && bill.original_bill_amount !== bill.bill_amount;
  const totalOffset = offsetBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <div>
                {bill?.installer_company && <span className="font-medium">{bill.installer_company}</span>}
                {bill?.installer_company && " • "}
                {hasBeenOffset && (
                  <>
                    Original: <span className="line-through text-muted-foreground">{formatCurrency(bill?.original_bill_amount)}</span>
                    {" → "}
                    Net: <span className="font-medium">{formatCurrency(bill?.bill_amount)}</span>
                    {" • "}
                  </>
                )}
                Balance: <span className="font-semibold text-amber-600">{formatCurrency(balance)}</span>
              </div>
              
              {/* Offset Details */}
              {offsetBills.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-700 mb-2">
                    Material/Equipment Offsets Applied ({formatCurrency(totalOffset)} total)
                  </p>
                  <div className="space-y-1.5">
                    {offsetBills.map((offsetBill) => (
                      <div key={offsetBill.id} className="text-xs text-blue-600 border-l-2 border-blue-300 pl-2">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{offsetBill.installer_company || "Unknown vendor"}</span>
                          <span className="font-semibold text-blue-700">{formatCurrency(offsetBill.bill_amount)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {offsetBill.created_at && formatDate(offsetBill.created_at)}
                          {offsetBill.bill_ref && ` • Ref: ${offsetBill.bill_ref}`}
                        </div>
                        {offsetBill.memo && (
                          <p className="text-[10px] text-muted-foreground italic mt-0.5 line-clamp-2">
                            {offsetBill.memo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bank Account - Required with add on the fly */}
          <div>
            <Label>Bank Account <span className="text-destructive">*</span></Label>
            <Popover open={bankOpen} onOpenChange={setBankOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={bankOpen}
                  className={cn("w-full justify-between font-normal", !formData.bank_name && "border-destructive")}
                >
                  {formData.bank_name || "Select or add bank..."}
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
                      {bankSearch ? `No bank found. Click below to add "${bankSearch}".` : "Type to search or add a bank."}
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
                type="text"
                inputMode="decimal"
                value={formData.payment_amount} 
                onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, payment_amount: val })); }} 
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

  const [activeTab, setActiveTab] = useState<string>("details");

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("details");
    }
  }, [open]);

  const isPaid = (bill?.balance || 0) <= 0;
  const paymentProgress = bill?.bill_amount ? ((bill?.amount_paid || 0) / bill.bill_amount) * 100 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Bill Details
            </DialogTitle>
            <DialogDescription>
              View bill information and payment history
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Bill Details
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs">
                <History className="h-3.5 w-3.5 mr-1.5" />
                Payment History ({payments.length})
              </TabsTrigger>
            </TabsList>

            {/* Bill Details Tab */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Status Banner */}
              <div className={cn(
                "rounded-lg p-4 border",
                isPaid ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      "text-xs",
                      isPaid 
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" 
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    )}>
                      {isPaid ? "Paid in Full" : "Outstanding Balance"}
                    </Badge>
                    {bill?.is_voided && (
                      <Badge variant="destructive" className="text-xs">Voided</Badge>
                    )}
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    isPaid ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                  )}>
                    {formatCurrency(bill?.bill_amount)}
                  </span>
                </div>
                {!isPaid && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Payment Progress</span>
                      <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bill Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Vendor / Company</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="font-semibold">{bill?.installer_company || "N/A"}</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Bill Reference</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="font-semibold">{bill?.bill_ref || "N/A"}</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Category</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <Badge variant="secondary" className="text-xs">{bill?.category || "Uncategorized"}</Badge>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Created</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="font-semibold">{formatDate(bill?.created_at || null)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card className="border">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Amount:</span>
                    <span className="font-medium">{formatCurrency(bill?.original_bill_amount || bill?.bill_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Bill Amount:</span>
                    <span className="font-medium">{formatCurrency(bill?.bill_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(bill?.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-medium">Balance Due:</span>
                    <span className={cn(
                      "font-bold",
                      (bill?.balance || 0) > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {formatCurrency(bill?.balance)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Memo */}
              {bill?.memo && (
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Memo / Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bill.memo}</p>
                  </CardContent>
                </Card>
              )}

              {/* Attachment */}
              {bill?.attachment_url && (
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attachment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(bill.attachment_url!, '_blank')}
                    >
                      View Attachment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Payment History Tab */}
            <TabsContent value="payments" className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No payments recorded yet</p>
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
            </TabsContent>
          </Tabs>

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
  const { companyId } = useCompanyContext();
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
          company_id: companyId,
          salesperson_name: payment.salesperson_name!,
          payment_date: payment.payment_date,
          payment_amount: payment.payment_amount || 0,
          payment_method: payment.payment_method,
          payment_reference: payment.payment_reference,
          notes: payment.notes,
          bank_name: payment.bank_name,
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
            {formatCurrencyWithDecimals(commissionPool)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            (Contracts - Lead - Bills) × {commissionSplitPct}%
          </p>
        </Card>
        <Card className="p-3 border-emerald-500/20">
          <div className="text-xs text-muted-foreground">Company Profit (After Comm)</div>
          <p className={cn("text-lg font-bold", companyProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
            {formatCurrencyWithDecimals(companyProfit)}
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
                      {formatCurrencyWithDecimals(sp.commissionAmount)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {formatCurrencyWithDecimals(sp.paid)}
                    </TableCell>
                    <TableCell className={cn("text-xs text-right font-medium", sp.balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {formatCurrencyWithDecimals(sp.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">{totalCommissionPct}%</TableCell>
                  <TableCell className="text-xs text-right text-emerald-600">{formatCurrencyWithDecimals(totalCommissionOwed)}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{formatCurrencyWithDecimals(totalCommissionPaid)}</TableCell>
                  <TableCell className={cn("text-xs text-right", totalCommissionBalance > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {formatCurrencyWithDecimals(totalCommissionBalance)}
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
                  <TableHead className="text-xs">Bank / Reference</TableHead>
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
                    <TableCell className="text-xs">
                      {[payment.bank_name, payment.payment_reference].filter(Boolean).join(" / ") || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold text-emerald-600">
                      {formatCurrencyWithDecimals(payment.payment_amount)}
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

  // Fetch existing bank names from banks table scoped by company
  const { companyId } = useCompanyContext();
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.map(b => b.name).filter((name): name is string => typeof name === 'string');
    },
    enabled: open && !!companyId,
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
  // Allow overpayment by up to $1 (for rounding), but block anything more
  const overpaymentAmount = paymentAmount - selectedSalespersonBalance;
  const isOverpayingBlocked = formData.salesperson_name && overpaymentAmount > 1;

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
                type="text"
                inputMode="decimal"
                value={formData.payment_amount}
                onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(p => ({ ...p, payment_amount: val })); }}
                className={isOverpayingBlocked ? "border-destructive" : ""}
              />
              {isOverpayingBlocked && (
                <p className="text-xs text-destructive mt-1">
                  Payment exceeds balance by {formatCurrency(overpaymentAmount)}. Cannot exceed balance by more than $1.
                </p>
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
              disabled={isPending || !formData.salesperson_name || !formData.bank_name || paymentAmount <= 0 || isOverpayingBlocked}
            >
              {isPending ? "Saving..." : editingPayment ? "Update Payment" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
