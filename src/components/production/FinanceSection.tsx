import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { cn, formatCurrency, formatCurrency2, formatCurrencyWithDecimals, formatDate } from "@/lib/utils";
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
  History,
  GripVertical,
  Download,
  Eye,
  Sparkles,
  ExternalLink,
  X,
  MoreVertical,
  Send,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileUpload } from "./FileUpload";
import { QuickAddSubcontractorDialog } from "./QuickAddSubcontractorDialog";
import { PdfViewerDialog } from "./PdfViewerDialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { VendorMappingDialog } from "./VendorMappingDialog";
import { SalespersonVendorMappingDialog } from "./SalespersonVendorMappingDialog";
import { QBDuplicateReviewDialog, type QBDuplicateCandidate } from "./analytics/QBDuplicateReviewDialog";
import { QBCustomerMappingDialog } from "./analytics/QBCustomerMappingDialog";
import { InvoicePdfDialog } from "./InvoicePdfDialog";
import { CommissionInvoiceDialog } from "./CommissionInvoiceDialog";
import { InvoiceConfirmDialog } from "./InvoiceConfirmDialog";
import { usePersistedDialog } from "@/hooks/usePersistedDialog";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { SendProposalDialog } from "@/components/estimates/SendProposalDialog";

interface SalespersonData {
  name: string | null;
  commissionPct: number;
}

interface FinanceSectionProps {
  projectId: string;
  estimatedCost: number | null;
  soldDispatchValue: number | null;
  estimatedProjectCost: number | null;
  totalPl: number | null;
  leadCostPercent: number;
  commissionSplitPct: number;
  salespeople: SalespersonData[];
  onUpdateProject: (updates: Record<string, unknown>) => void;
  onNavigateToSubcontractors?: () => void; // kept for backward compat but no longer used by BillDialog
  autoOpenBillDialog?: boolean;
  /** Auto-open a specific dialog when the component mounts (invoice, payment, bill, refund) */
  autoOpenFinanceDialog?: 'invoice' | 'payment' | 'bill' | 'change-order' | 'refund' | null;
  /** Initial sub-tab for Finance section (agreements, phases, invoices, bills, commission) */
  initialSubTab?: string;
  initialBillsSubTab?: 'bills' | 'history';
  highlightInvoiceId?: string | null;
  highlightBillId?: string | null;
  highlightPaymentId?: string | null;
  /** Callback when inner sub-tabs change (for syncing URL state) */
  onSubTabChange?: (subTab: string, billsSubTab?: 'bills' | 'history') => void;
  projectStatus?: string | null;
  projectName?: string | null;
  projectAddress?: string | null;
  customerName?: string | null;
  onPdfPreviewStateChange?: (open: boolean) => void;
  onFinanceSummaryChange?: (summary: { sold: number; invoiced: number; received: number; outstandingAR: number; bills: number; billsPaid: number; outstandingAP: number; hasAgreements: boolean }) => void;
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
  bank_id: string | null;
  projected_received_date: string | null;
  payment_schedule: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_fee: number | null;
  check_number: string | null;
  payment_method: string | null;
  deposit_verified: boolean | null;
  invoice_id: string | null;
  payment_phase_id: string | null;
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  // Joined from banks table
  bank?: { name: string } | null;
}

interface PaymentPhase {
  id: string;
  project_id: string | null;
  agreement_id: string | null;
  phase_name: string;
  description: string | null;
  due_date: string | null;
  amount: number | null;
  display_order: number | null;
}

interface BillPayment {
  id: string;
  bill_id: string;
  payment_date: string | null;
  payment_amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  bank_name: string | null;
  bank_id: string | null;
  // Joined from banks table
  bank?: { name: string } | null;
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
  nickname: string | null;
  agreement_signed_date: string | null;
  created_at: string | null;
  total_price: number | null;
  description_of_work: string | null;
  attachment_url: string | null;
}

interface Refund {
  id: string;
  refund_amount: number;
  refund_date: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  bank_id: string | null;
  bank_name: string | null;
  reason: string | null;
  notes: string | null;
  refund_status: string | null;
  exclude_from_qb: boolean | null;
  is_voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  bank?: { name: string } | null;
}

interface ExtractedPhase {
  phase_name: string;
  description: string | null;
  amount: number | string | null;
  display_order: number;
}


export function FinanceSection({ projectId, estimatedCost, soldDispatchValue, estimatedProjectCost, totalPl, leadCostPercent, commissionSplitPct, salespeople, onUpdateProject, onNavigateToSubcontractors, autoOpenBillDialog, autoOpenFinanceDialog, initialSubTab, initialBillsSubTab, highlightInvoiceId, highlightBillId, highlightPaymentId, onSubTabChange, projectStatus, projectName, projectAddress, customerName, onPdfPreviewStateChange, onFinanceSummaryChange }: FinanceSectionProps) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  // Initialize based on props priority: initialBillsSubTab (explicit bills focus) > initialSubTab > default
  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (initialBillsSubTab) return "bills";
    if (initialSubTab) return initialSubTab;
    return "agreements";
  });
  const [activeBillsSubTab, setActiveBillsSubTab] = useState<"bills" | "history">(initialBillsSubTab || "bills");
  const [activeInvoicesSubTab, setActiveInvoicesSubTab] = useState<"invoices" | "payments">("invoices");
  const [selectedAgreementFilter, setSelectedAgreementFilter] = useState<string | null>(null);
  const [invoiceContractFilter, setInvoiceContractFilter] = useState<string>("all");
  const [hasAutoOpenedBill, setHasAutoOpenedBill] = useState(false);

  // Notify parent when sub-tabs change
  const handleSubTabChange = (subTab: string) => {
    setActiveSubTab(subTab);
    onSubTabChange?.(subTab, subTab === "bills" ? activeBillsSubTab : undefined);
  };

  const handleBillsSubTabChange = (billsSubTab: "bills" | "history") => {
    setActiveBillsSubTab(billsSubTab);
    onSubTabChange?.(activeSubTab, billsSubTab);
  };
  
  // Dialog states
  const { open: invoiceDialogOpen, setOpen: setInvoiceDialogOpen } = usePersistedDialog("finance-invoice-dialog", projectId);
  const { open: paymentDialogOpen, setOpen: setPaymentDialogOpen } = usePersistedDialog("finance-payment-dialog", projectId);
  const { open: billDialogOpen, setOpen: setBillDialogOpen } = usePersistedDialog("finance-bill-dialog", projectId);
  const { open: agreementDialogOpen, setOpen: setAgreementDialogOpen } = usePersistedDialog("finance-agreement-dialog", projectId);
  const { open: phaseDialogOpen, setOpen: setPhaseDialogOpen } = usePersistedDialog("finance-phase-dialog", projectId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quickPayDialogOpen, setQuickPayDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidingBill, setVoidingBill] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPaymentDialogOpen, setVoidPaymentDialogOpen] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidPaymentReason, setVoidPaymentReason] = useState("");
  const [profitabilityDialogOpen, setProfitabilityDialogOpen] = useState(false);
  const [extractedPhasesDialogOpen, setExtractedPhasesDialogOpen] = useState(false);
  const [extractedPhases, setExtractedPhases] = useState<ExtractedPhase[]>([]);
  const [extractedPhasesAgreementId, setExtractedPhasesAgreementId] = useState<string | null>(null);
  
  // QuickBooks new entity confirmation state
  const [qbConfirmDialogOpen, setQbConfirmDialogOpen] = useState(false);
  const [pendingQbSync, setPendingQbSync] = useState<{
    recordType: "invoice" | "payment" | "bill" | "bill_payment" | "refund";
    recordId: string;
    pendingEntities: { type: string; name: string }[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  
  // Pending save state for pre-save QB confirmation
  const [pendingBillSave, setPendingBillSave] = useState<{
    bill: Partial<Bill>;
    pendingEntities: { type: string; name: string }[];
  } | null>(null);

  // QB duplicate detection state
  const [qbDuplicateDialogOpen, setQbDuplicateDialogOpen] = useState(false);
  const [qbDuplicateLinking, setQbDuplicateLinking] = useState(false);
  const [qbDuplicateState, setQbDuplicateState] = useState<{
    duplicates: any[];
    recordType: string;
    recordId: string;
    localAmount: number;
    localDate: string;
    localReference: string | null;
    onLink: (qbId: string, qbReference: string | null) => void;
    onCreateNew: () => void;
    onCancel: () => void;
  } | null>(null);

  // QB customer mapping state (shown before creating a new customer in QB)
  const [qbCustomerMappingOpen, setQbCustomerMappingOpen] = useState(false);
  const [qbCustomerMappingContext, setQbCustomerMappingContext] = useState<{
    customerName: string;
    onMapped: () => void;
    onCreateNew: () => void;
    onCancel: () => void;
  } | null>(null);

  // Auto-open bill dialog when returning from subcontractor add
  useEffect(() => {
    if (autoOpenBillDialog && !hasAutoOpenedBill) {
      setActiveSubTab("bills");
      setBillDialogOpen(true);
      setHasAutoOpenedBill(true);
    }
  }, [autoOpenBillDialog, hasAutoOpenedBill]);

  // Auto-open specific finance dialog from Quick Create
  const [hasAutoOpenedFinanceDialog, setHasAutoOpenedFinanceDialog] = useState(false);
  useEffect(() => {
    if (autoOpenFinanceDialog && !hasAutoOpenedFinanceDialog) {
      setHasAutoOpenedFinanceDialog(true);
      if (autoOpenFinanceDialog === 'invoice') {
        setActiveSubTab("invoices");
        setActiveInvoicesSubTab("invoices");
        setEditingInvoice(null);
        setInvoiceDialogOpen(true);
      } else if (autoOpenFinanceDialog === 'payment') {
        setActiveSubTab("invoices");
        setActiveInvoicesSubTab("payments");
        setPaymentDialogOpen(true);
      } else if (autoOpenFinanceDialog === 'bill') {
        setActiveSubTab("bills");
        setBillDialogOpen(true);
      } else if (autoOpenFinanceDialog === 'change-order') {
        setActiveSubTab("agreements");
        setEditingAgreement(null);
        setPreselectedAgreementType("Change Order");
        setAgreementDialogOpen(true);
      } else if (autoOpenFinanceDialog === 'refund') {
        setActiveSubTab("invoices");
        setActiveInvoicesSubTab("payments");
        setEditingRefund(null);
        setRefundDialogOpen(true);
      }
      // Clear the autoOpen param from the URL to prevent re-triggering on tab switches
      const url = new URL(window.location.href);
      if (url.searchParams.has('autoOpen')) {
        url.searchParams.delete('autoOpen');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [autoOpenFinanceDialog, hasAutoOpenedFinanceDialog]);

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
  const [invoiceSelectForPayment, setInvoiceSelectForPayment] = useState<Invoice[] | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [preselectedAgreementType, setPreselectedAgreementType] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<PaymentPhase | null>(null);
  const [editingRefund, setEditingRefund] = useState<Refund | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [voidRefundDialogOpen, setVoidRefundDialogOpen] = useState(false);
  const [voidingRefund, setVoidingRefund] = useState<Refund | null>(null);
  const [deleteRefundDialogOpen, setDeleteRefundDialogOpen] = useState(false);
  const [deletingRefund, setDeletingRefund] = useState<Refund | null>(null);
  const [voidRefundReason, setVoidRefundReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [historyBill, setHistoryBill] = useState<Bill | null>(null);
  const [offsetDetailsBill, setOffsetDetailsBill] = useState<{ bill: Bill; offsets: { offsetBills: Bill[]; totalOffset: number } } | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    onPdfPreviewStateChange?.(pdfViewerOpen && !!selectedAttachment);
    return () => onPdfPreviewStateChange?.(false);
  }, [onPdfPreviewStateChange, pdfViewerOpen, selectedAttachment]);
  const [invoicePdfDialogOpen, setInvoicePdfDialogOpen] = useState(false);
  const [invoicePdfData, setInvoicePdfData] = useState<{
    invoice_id?: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    amount: number | null;
    payments_received?: number | null;
    agreement_number?: string | null;
    phase_name?: string | null;
    description_of_work?: string | null;
  } | null>(null);
  const [invoicePdfOnSave, setInvoicePdfOnSave] = useState<(() => Promise<void> | void) | undefined>(undefined);
  const [syncingBillId, setSyncingBillId] = useState<string | null>(null);

  // Invoice confirm dialog state (for badge click flow)
  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [invoiceConfirmPhase, setInvoiceConfirmPhase] = useState<{ id: string; name: string; agreementId: string | null; maxAmount: number } | null>(null);

  // Phase drag-and-drop state
  const [draggedPhaseId, setDraggedPhaseId] = useState<string | null>(null);
  const [dragOverPhaseId, setDragOverPhaseId] = useState<string | null>(null);

  // Subscribe to Realtime changes on project_invoices for this project
  // We use separate subscriptions: one for INSERT/UPDATE with filter, and one unfiltered for DELETE
  // because DELETE events only contain the old row data which may not match the filter
  useEffect(() => {
    const filteredChannel = supabase
      .channel(`project-invoices-filtered-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_invoices",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "project_invoices",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
        }
      )
      .subscribe();

    // Separate channel for DELETE events
    const deleteChannel = supabase
      .channel(`project-invoices-delete-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "project_invoices",
        },
        (payload) => {
          if (payload.old && (payload.old as { project_id?: string }).project_id === projectId) {
            queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filteredChannel);
      supabase.removeChannel(deleteChannel);
    };
  }, [projectId, queryClient]);

  // Subscribe to Realtime changes on project_payments for this project
  // We use two subscriptions: one filtered for INSERT/UPDATE, and one unfiltered for DELETE
  // because DELETE events only contain the old row data which may not match the filter
  useEffect(() => {
    const filteredChannel = supabase
      .channel(`project-payments-filtered-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_payments",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "project_payments",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
        }
      )
      .subscribe();

    // Separate channel for DELETE events - check if the deleted row was for this project
    const deleteChannel = supabase
      .channel(`project-payments-delete-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "project_payments",
        },
        (payload) => {
          // Only invalidate if the deleted payment was for this project
          if (payload.old && (payload.old as { project_id?: string }).project_id === projectId) {
            queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filteredChannel);
      supabase.removeChannel(deleteChannel);
    };
  }, [projectId, queryClient]);

  // Subscribe to Realtime changes on project_refunds for this project
  useEffect(() => {
    const channel = supabase
      .channel(`project-refunds-realtime-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_refunds", filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-refunds", projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  // Subscribe to Realtime changes on project_bills for this project
  // We listen to all events and filter in the callback because:
  // 1. New bills from QB may initially have project_id=null, then get updated
  // 2. DELETE events don't reliably include filter-matching data
  useEffect(() => {
    const channel = supabase
      .channel(`project-bills-realtime-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_bills",
        },
        (payload) => {
          // Check if the inserted bill is for this project
          const newRow = payload.new as { project_id?: string } | undefined;
          if (newRow?.project_id === projectId) {
            queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "project_bills",
        },
        (payload) => {
          // Check if the bill is now or was previously for this project
          const newRow = payload.new as { project_id?: string } | undefined;
          const oldRow = payload.old as { project_id?: string } | undefined;
          if (newRow?.project_id === projectId || oldRow?.project_id === projectId) {
            queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-bill-payments", projectId] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "project_bills",
        },
        (payload) => {
          if (payload.old && (payload.old as { project_id?: string }).project_id === projectId) {
            queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-bill-payments", projectId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  // Subscribe to Realtime changes on bill_payments (no project_id filter - uses bill_id)
  useEffect(() => {
    // We need to listen to all bill_payment changes and filter in the callback
    const channel = supabase
      .channel(`bill-payments-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bill_payments",
        },
        () => {
          // Since bill_payments don't have project_id, we just invalidate and let React Query handle it
          queryClient.invalidateQueries({ queryKey: ["project-bill-payments", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

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
        .select("*, bank:banks!project_payments_bank_id_fkey(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ["project-refunds", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_refunds")
        .select("*, bank:banks!project_refunds_bank_id_fkey(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Refund[];
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

  // Fetch subcontractor contact names mapped by company_name
  const { data: subcontractorContactMap = {} } = useQuery({
    queryKey: ["subcontractor-contacts", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from("subcontractors")
        .select("company_name, contact_name")
        .eq("company_id", companyId);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        if (s.contact_name) map[s.company_name] = s.contact_name;
      });
      return map;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-switch to correct bills sub-tab when highlight IDs are set
  useEffect(() => {
    if (highlightPaymentId && bills.length > 0) {
      setActiveSubTab("bills");
      setActiveBillsSubTab("history");
    } else if (highlightBillId && bills.length > 0) {
      setActiveSubTab("bills");
      setActiveBillsSubTab("bills");
    }
  }, [highlightPaymentId, highlightBillId, bills]);

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
        .select("*, bank:banks!bill_payments_bank_id_fkey(name)")
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

  // Check QB connection at FinanceSection level
  const { data: mainQbConnection } = useQuery({
    queryKey: ["qb-connection-status", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("id, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 60000,
  });
  const isQBConnectedMain = !!mainQbConnection?.is_active;

  // Fetch QB sync status for bill payments (only when QB is connected)
  const { data: billPaymentSyncStatuses = {} } = useQuery({
    queryKey: ["bill-payment-sync-statuses", projectId, companyId, allBillPayments.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      if (!companyId) return {};
      const billIds = allBillPayments.map((p: any) => p.id);
      if (billIds.length === 0) return {};
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .in("record_id", billIds);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnectedMain && allBillPayments.length > 0,
    staleTime: 30000,
  });

  // Fetch QB sync status for invoices
  const { data: invoiceSyncStatuses = {} } = useQuery({
    queryKey: ["invoice-sync-statuses", projectId, companyId],
    queryFn: async () => {
      if (!companyId || invoices.length === 0) return {};
      const ids = invoices.map((inv: any) => inv.id);
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "invoice")
        .in("record_id", ids);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnectedMain && invoices.length > 0,
    staleTime: 30000,
  });

  // Fetch QB sync status for payments received
  const { data: paymentSyncStatuses = {} } = useQuery({
    queryKey: ["payment-sync-statuses", projectId, companyId],
    queryFn: async () => {
      if (!companyId || payments.length === 0) return {};
      const ids = payments.map((p: any) => p.id);
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .in("record_id", ids);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnectedMain && payments.length > 0,
    staleTime: 30000,
  });

  // Fetch QB sync status for bills
  const { data: billSyncStatuses = {} } = useQuery({
    queryKey: ["bill-sync-statuses", projectId, companyId],
    queryFn: async () => {
      if (!companyId || bills.length === 0) return {};
      const ids = bills.map((b: any) => b.id);
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .in("record_id", ids);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnectedMain && bills.length > 0,
    staleTime: 30000,
  });

  // Fetch QB sync status for refunds
  const { data: refundSyncStatuses = {} } = useQuery({
    queryKey: ["refund-sync-statuses", projectId, companyId],
    queryFn: async () => {
      if (!companyId || refunds.length === 0) return {};
      const ids = refunds.map((r: any) => r.id);
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "refund")
        .in("record_id", ids);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnectedMain && refunds.length > 0,
    staleTime: 30000,
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
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as PaymentPhase[];
    },
  });

  // Calculate totals - exclude voided bills, payments, and refunds
  const activeBills = bills.filter(b => !b.is_voided);
  const activePayments = payments.filter(p => !p.is_voided);
  const activeRefunds = refunds.filter(r => !r.is_voided);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaymentsReceived = activePayments.filter(p => p.payment_status === "Received").reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalRefunds = activeRefunds.filter(r => r.refund_status === "Issued").reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalPendingRefunds = activeRefunds.filter(r => r.refund_status === "Pending").reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalBills = activeBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
  const totalBillsPaid = activeBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const totalAgreementsValue = agreements.reduce((sum, a) => sum + (a.total_price || 0), 0);
  const netPaymentsReceived = totalPaymentsReceived - totalRefunds;

  // Report financial summary to parent
  useEffect(() => {
    onFinanceSummaryChange?.({
      sold: totalAgreementsValue,
      invoiced: totalInvoiced,
      received: netPaymentsReceived,
      outstandingAR: totalInvoiced - totalPaymentsReceived - totalPendingRefunds,
      bills: totalBills,
      billsPaid: totalBillsPaid,
      outstandingAP: Math.max(0, totalBills - totalBillsPaid),
      hasAgreements: agreements.length > 0,
    });
  }, [totalInvoiced, netPaymentsReceived, totalPaymentsReceived, totalRefunds, totalBills, totalBillsPaid, totalAgreementsValue, agreements.length, onFinanceSummaryChange]);

  // Helper functions to check phase status
  const getPhaseInvoiceStatus = (phaseId: string) => {
    const phaseInvoices = invoices.filter(inv => inv.payment_phase_id === phaseId);
    const totalInvoicedForPhase = phaseInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return { invoices: phaseInvoices, totalInvoiced: totalInvoicedForPhase };
  };

  const getPhasePaymentStatus = (phaseId: string) => {
    const phasePayments = activePayments.filter(p => p.payment_phase_id === phaseId && p.payment_status === "Received");
    const totalReceivedForPhase = phasePayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    // Get the latest payment date (projected_received_date or created_at)
    const latestPaymentDate = phasePayments.reduce<string | null>((latest, p) => {
      const d = (p as any).projected_received_date || (p as any).created_at;
      if (!d) return latest;
      if (!latest) return d;
      return d > latest ? d : latest;
    }, null);
    return { payments: phasePayments, totalReceived: totalReceivedForPhase, latestPaymentDate };
  };

  // Calculate phases total by contract
  const getPhasesTotalByAgreement = (agreementId: string) => {
    return paymentPhases
      .filter(p => p.agreement_id === agreementId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  // Helper to check if QB sync will create new entities (customer/vendor)
  const checkQbSyncEntities = async (recordType: "invoice" | "payment" | "bill" | "bill_payment" | "refund", recordId: string): Promise<{ requiresConfirmation: boolean; pendingEntities: { type: string; name: string }[]; unmappedEntities: { type: string; name: string }[] }> => {
    if (!companyId || !isQBConnectedMain) return { requiresConfirmation: false, pendingEntities: [], unmappedEntities: [] };
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: {
          companyId,
          syncType: recordType,
          recordId,
          checkOnly: true,
        },
      });
      
      if (error) {
        console.error("QuickBooks check error:", error);
        return { requiresConfirmation: false, pendingEntities: [], unmappedEntities: [] };
      }
      
      return { 
        requiresConfirmation: data?.requiresConfirmation || false, 
        pendingEntities: data?.pendingEntities || [],
        unmappedEntities: data?.unmappedEntities || [],
      };
    } catch (err) {
      console.error("Failed to check QuickBooks entities:", err);
      return { requiresConfirmation: false, pendingEntities: [], unmappedEntities: [] };
    }
  };

  // Pre-save check for vendor existence (before bill is created)
  const checkVendorBeforeSave = async (vendorName: string): Promise<{ requiresConfirmation: boolean; pendingEntities: { type: string; name: string }[] }> => {
    if (!companyId || !vendorName || !isQBConnectedMain) return { requiresConfirmation: false, pendingEntities: [] };
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: {
          companyId,
          syncType: "bill",
          checkOnly: true,
          checkVendorName: vendorName,
        },
      });
      
      if (error) {
        console.error("QuickBooks vendor check error:", error);
        return { requiresConfirmation: false, pendingEntities: [] };
      }
      
      return { 
        requiresConfirmation: data?.requiresConfirmation || false, 
        pendingEntities: data?.pendingEntities || [] 
      };
    } catch (err) {
      console.error("Failed to check QuickBooks vendor:", err);
      return { requiresConfirmation: false, pendingEntities: [] };
    }
  };

  // Helper to sync a record to QuickBooks after create/update - returns true if synced successfully
  const syncRecordToQuickBooks = async (recordType: "invoice" | "payment" | "bill" | "bill_payment" | "refund", recordId: string): Promise<{ synced: boolean; message?: string; newEntities?: { type: string; name: string }[] }> => {
    if (!companyId || !isQBConnectedMain) return { synced: false };
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: {
          companyId,
          syncType: recordType,
          recordId,
        },
      });
      
      if (error) {
        console.error("QuickBooks sync error:", error);
        return { synced: false, message: error.message };
      } else if (data?.synced > 0) {

        return { synced: true, newEntities: data?.newEntities || [] };
      }
      const errorMessage = Array.isArray(data?.errors) && data.errors.length > 0 ? String(data.errors[0]) : undefined;
      return { synced: false, message: errorMessage };
    } catch (err) {
      console.error("Failed to sync to QuickBooks:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return { synced: false, message: errMsg };
    }
  };

   // Helper to sync with confirmation for new entities
  const syncWithConfirmation = async (
    recordType: "invoice" | "payment" | "bill" | "bill_payment" | "refund", 
    recordId: string
  ): Promise<{ synced: boolean; message?: string; newEntities?: { type: string; name: string }[] }> => {
    // First check if sync would create new entities
    const check = await checkQbSyncEntities(recordType, recordId);
    
    // Combine pending (new) customer entities and unmapped customer entities for the mapping dialog
    const customerEntity = check.pendingEntities.find(e => e.type === "customer") 
      || check.unmappedEntities.find(e => e.type === "customer");
    const nonCustomerPendingEntities = check.pendingEntities.filter(e => e.type !== "customer");
    const hasCustomerToMap = !!customerEntity;
    const hasPendingNonCustomer = nonCustomerPendingEntities.length > 0;
    
    if (hasCustomerToMap || check.pendingEntities.length > 0) {
      if (hasCustomerToMap) {
        // Show customer mapping dialog first
        return new Promise((resolve) => {
          const proceedWithSync = async () => {
            // After mapping (or skipping), check if there are still non-customer entities to confirm
            if (hasPendingNonCustomer) {
              setPendingQbSync({
                recordType,
                recordId,
                pendingEntities: nonCustomerPendingEntities,
                onConfirm: async () => {
                  setQbConfirmDialogOpen(false);
                  setPendingQbSync(null);
                  const result = await syncRecordToQuickBooks(recordType, recordId);
                  resolve(result);
                },
                onCancel: () => {
                  setQbConfirmDialogOpen(false);
                  setPendingQbSync(null);
                  resolve({ synced: false, message: "Sync cancelled by user" });
                },
              });
              setQbConfirmDialogOpen(true);
            } else {
              const result = await syncRecordToQuickBooks(recordType, recordId);
              resolve(result);
            }
          };

          setQbCustomerMappingContext({
            customerName: customerEntity!.name,
            onMapped: async () => {
              setQbCustomerMappingOpen(false);
              setQbCustomerMappingContext(null);
              await proceedWithSync();
            },
            onCreateNew: async () => {
              setQbCustomerMappingOpen(false);
              setQbCustomerMappingContext(null);
              await proceedWithSync();
            },
            onCancel: () => {
              setQbCustomerMappingOpen(false);
              setQbCustomerMappingContext(null);
              resolve({ synced: false, message: "Sync cancelled by user" });
            },
          });
          setQbCustomerMappingOpen(true);
        });
      }
      
      // No customer entity - show standard confirmation dialog for vendors etc.
      return new Promise((resolve) => {
        setPendingQbSync({
          recordType,
          recordId,
          pendingEntities: check.pendingEntities,
          onConfirm: async () => {
            setQbConfirmDialogOpen(false);
            setPendingQbSync(null);
            const result = await syncRecordToQuickBooks(recordType, recordId);
            resolve(result);
          },
          onCancel: () => {
            setQbConfirmDialogOpen(false);
            setPendingQbSync(null);
            resolve({ synced: false, message: "Sync cancelled by user" });
          },
        });
        setQbConfirmDialogOpen(true);
      });
    }
    
    // No new entities and no unmapped - sync directly
    return syncRecordToQuickBooks(recordType, recordId);
  };

  // Helper to check for QB duplicates before syncing a bill or bill payment
  const checkQbDuplicatesAndSync = async (
    recordType: "bill" | "bill_payment" | "payment" | "invoice" | "refund",
    recordId: string,
    checkData: { amount: number; date: string; reference: string | null; vendorName?: string | null; paymentMethod?: string | null }
  ): Promise<{ synced: boolean; message?: string; newEntities?: { type: string; name: string }[] }> => {
    if (!companyId) return { synced: false };

    // First check if already synced (has existing sync log) — skip duplicate check
    const { data: existingLog } = await supabase
      .from("quickbooks_sync_log")
      .select("quickbooks_id, sync_status")
      .eq("company_id", companyId)
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .in("sync_status", ["synced", "pending_refresh", "deleted_in_qb"])
      .maybeSingle();

    if (existingLog?.quickbooks_id && existingLog.sync_status !== "deleted_in_qb" && !existingLog.quickbooks_id.startsWith("backfill-")) {
      // Already has a real QB record and it's not deleted — just resync
      return syncRecordToQuickBooks(recordType, recordId);
    }
    // If deleted_in_qb, fall through to duplicate check so user can link to existing QB record

    // Check for duplicates in QB
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-find-duplicates", {
        body: {
          companyId,
          recordType,
          amount: checkData.amount,
          date: checkData.date,
          reference: checkData.reference,
          vendorName: checkData.vendorName,
          paymentMethod: checkData.paymentMethod || null,
        },
      });

      if (error || !data?.duplicates?.length) {
        // No duplicates found or error checking — proceed with customer/vendor confirmation flow
        return syncWithConfirmation(recordType, recordId);
      }

      // Duplicates found — show review dialog
      return new Promise((resolve) => {
        setQbDuplicateState({
          duplicates: data.duplicates,
          recordType,
          recordId,
          localAmount: checkData.amount,
          localDate: checkData.date,
          localReference: checkData.reference,
          onLink: async (qbId: string, qbReference: string | null) => {
            setQbDuplicateLinking(true);
            try {
              // Create sync log linking this local record to the existing QB record
              const { error: linkError } = await supabase.from("quickbooks_sync_log").upsert({
                company_id: companyId,
                record_type: recordType,
                record_id: recordId,
                quickbooks_id: qbId,
                sync_status: "synced",
                sync_error: null,
                synced_at: new Date().toISOString(),
              }, {
                onConflict: "company_id,record_type,record_id",
              });

              if (linkError) throw linkError;

              toast.success("Linked to existing QuickBooks record");
              queryClient.invalidateQueries({ queryKey: ["qb-sync-status"] });
              queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });
              queryClient.invalidateQueries({ queryKey: ["bill-sync-statuses"] });

              // If local has a reference that differs from QB's, push it to QB
              const localRef = checkData.reference;
              if (localRef && localRef !== qbReference) {
                toast.info("Updating QuickBooks with reference #...");
                const { data: syncResult, error: syncErr } = await supabase.functions.invoke("sync-to-quickbooks", {
                  body: { companyId, syncType: recordType, recordId },
                });
                if (!syncErr && syncResult?.synced > 0) {
                  toast.success("Reference # updated in QuickBooks");
                } else if (syncResult?.errors?.length) {
                  toast.error(`QB update error: ${syncResult.errors[0]}`, { duration: Infinity });
                }
              }

              setQbDuplicateDialogOpen(false);
              setQbDuplicateState(null);
              setQbDuplicateLinking(false);
              resolve({ synced: true, message: "Linked to existing QB record" });
            } catch (err) {
              console.error("Failed to link QB record:", err);
              toast.error("Failed to link to QuickBooks record");
              setQbDuplicateLinking(false);
              resolve({ synced: false, message: "Link failed" });
            }
          },
          onCreateNew: async () => {
            setQbDuplicateDialogOpen(false);
            setQbDuplicateState(null);
            const result = await syncWithConfirmation(recordType, recordId);
            resolve(result);
          },
          onCancel: async () => {
            // User confirmed they want to cancel the entry — delete the saved record
            try {
              const tableMap: Record<string, string> = {
                bill: "project_bills",
                bill_payment: "bill_payments",
                payment: "project_payments",
                invoice: "project_invoices",
                refund: "project_refunds",
              };
              const table = tableMap[recordType];
              if (table) {
                await (supabase.from(table as any).delete() as any).eq("id", recordId);
                toast.info("Entry cancelled — nothing was saved");
                // Invalidate relevant queries
                queryClient.invalidateQueries({ queryKey: ["project-refunds"] });
                queryClient.invalidateQueries({ queryKey: ["project-invoices"] });
                queryClient.invalidateQueries({ queryKey: ["project-payments"] });
                queryClient.invalidateQueries({ queryKey: ["project-bills"] });
                queryClient.invalidateQueries({ queryKey: ["bill-payments"] });
              }
            } catch (err) {
              console.error("Failed to delete cancelled record:", err);
              toast.error("Failed to remove the entry");
            }
            setQbDuplicateDialogOpen(false);
            setQbDuplicateState(null);
            resolve({ synced: false, message: "Entry cancelled by user" });
          },
        });
        setQbDuplicateDialogOpen(true);
      });
    } catch (err) {
      console.error("Duplicate check failed, proceeding with sync:", err);
      return syncWithConfirmation(recordType, recordId);
    }
  };

  const syncDeleteToQuickBooks = async (recordType: string, recordId: string): Promise<{ synced: boolean; message?: string }> => {

    if (!companyId || !isQBConnectedMain) {

      return { synced: false };
    }
    
    try {

      const { data, error } = await supabase.functions.invoke("delete-quickbooks-record", {
        body: {
          companyId,
          recordType,
          recordId,
          action: "void",
        },
      });
      

      if (error) {
        console.error("QuickBooks delete sync error:", error);
        return { synced: false };
      } else if (data?.success && !data?.skipped && !data?.manual_action_required) {
        // Only consider it synced if it actually voided in QB (not just marked locally)

        return { synced: true, message: data.message };
      } else if (data?.manual_action_required) {
        // QB rejected the void - manual action required

        return { synced: false, message: data.message };
      }

      return { synced: false };
    } catch (err) {
      console.error("Failed to sync delete to QuickBooks:", err);
      return { synced: false };
    }
  };

  // Next invoice number for confirm-dialog flow
  const { data: nextInvoiceNumberForConfirm } = useQuery({
    queryKey: ["next-invoice-number", companyId],
    queryFn: async () => {
      if (!companyId) return "1001";
      const { data } = await supabase
        .from("project_invoices")
        .select("invoice_number")
        .eq("company_id", companyId)
        .not("invoice_number", "is", null);
      if (!data || data.length === 0) return "1001";
      let maxNumber = 1000;
      for (const inv of data) {
        const numMatch = inv.invoice_number?.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (num > maxNumber) maxNumber = num;
        }
      }
      return (maxNumber + 1).toString();
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  // Handler for badge-click confirm dialog
  const handleInvoiceConfirm = (amount: number) => {
    if (!invoiceConfirmPhase) return;
    const phase = paymentPhases.find(p => p.id === invoiceConfirmPhase.id);
    const agreement = agreements.find(a => a.id === (invoiceConfirmPhase.agreementId || phase?.agreement_id));
    const invoiceNumber = nextInvoiceNumberForConfirm || "1001";
    const invoiceDate = new Date().toISOString().split('T')[0];

    const invoiceData: Partial<Invoice> = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      amount: amount,
      agreement_id: agreement?.id || null,
      payment_phase_id: invoiceConfirmPhase.id,
    };

    setInvoicePdfData({
      invoice_id: null,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      amount: amount,
      payments_received: 0,
      agreement_number: agreement?.agreement_number || null,
      phase_name: invoiceConfirmPhase.name,
      description_of_work: agreement?.description_of_work || null,
    });

    // Set the onSave callback that will save to DB when user clicks a save button
    // Close the PDF dialog first so QB duplicate review dialog (if any) isn't hidden behind it
    setInvoicePdfOnSave(() => async () => {
      setInvoicePdfDialogOpen(false);
      setInvoicePdfOnSave(undefined);
      setEditingInvoice(null);
      saveInvoiceMutation.mutate(invoiceData);
    });

    setInvoicePdfDialogOpen(true);
  };

  // Invoice mutations
  const saveInvoiceMutation = useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      let savedInvoiceData = { ...invoice };
      let qbMessage: string | undefined;
      let savedRecordId: string | undefined;
      
      if (editingInvoice?.id) {
        const { data: updatedInvoice, error } = await supabase
          .from("project_invoices")
          .update(invoice)
          .eq("id", editingInvoice.id)
          .select("id")
          .single();

        if (error) throw error;
        if (!updatedInvoice?.id) {
          throw new Error("Invoice not found (it may have been deleted). Refresh and try again.");
        }

        await logAudit({
          tableName: 'project_invoices',
          recordId: updatedInvoice.id,
          action: 'UPDATE',
          oldValues: editingInvoice,
          newValues: invoice,
          description: `Updated invoice ${invoice.invoice_number || editingInvoice.invoice_number}`,
        });

        savedRecordId = updatedInvoice.id;
      } else {
        const { data: newInvoice, error } = await supabase
          .from("project_invoices")
          .insert({ ...invoice, project_id: projectId, company_id: companyId })
          .select()
          .single();
        if (error) throw error;
        savedInvoiceData = { ...newInvoice, ...invoice };
        await logAudit({
          tableName: 'project_invoices',
          recordId: newInvoice.id,
          action: 'INSERT',
          newValues: newInvoice,
          description: `Created invoice ${invoice.invoice_number}`,
        });
        savedRecordId = newInvoice.id;
      }

      // Sync to QuickBooks if connected (with duplicate detection)
      let qbSynced = false;
      let qbNewEntities: { type: string; name: string }[] = [];
      if (savedRecordId) {
        const qbResult = await checkQbDuplicatesAndSync("invoice", savedRecordId, {
          amount: invoice.amount || editingInvoice?.amount || 0,
          date: (editingInvoice?.invoice_date || invoice.invoice_date || new Date().toISOString()).slice(0, 10),
          reference: invoice.invoice_number || editingInvoice?.invoice_number || null,
        });
        qbSynced = qbResult.synced;
        qbNewEntities = qbResult.newEntities || [];
        qbMessage = qbResult.message;
      }

      return { qbSynced, isEdit: !!editingInvoice?.id, qbNewEntities, qbMessage, savedInvoiceData };
    },
    onSuccess: (result) => {
      const baseMsg = result?.isEdit ? "Invoice updated" : "Invoice created";
      if (result?.qbSynced) {
        const newCustomer = result.qbNewEntities?.find(e => e.type === "customer");
        if (newCustomer) {
          toast.success(`${baseMsg} and synced to QuickBooks (new customer "${newCustomer.name}" created)`);
        } else {
          toast.success(`${baseMsg} and synced to QuickBooks`);
        }
      } else if (result?.qbMessage) {
        const short = result.qbMessage.length > 220 ? `${result.qbMessage.slice(0, 220)}…` : result.qbMessage;
        toast.error(`${baseMsg} but QuickBooks sync failed: ${short}`);
      } else {
        toast.success(baseMsg);
      }
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["all-project-invoices"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["next-invoice-number"] });
      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
      
      // Show PDF preview for newly created invoices (not edits, not deferred-save flow)
      if (!result?.isEdit && result?.savedInvoiceData && !invoicePdfDialogOpen) {
        const inv = result.savedInvoiceData;
        const phase = paymentPhases.find(p => p.id === inv.payment_phase_id);
        const agreement = agreements.find(a => a.id === (inv.agreement_id || phase?.agreement_id));
        setInvoicePdfData({
          invoice_id: inv.id || null,
          invoice_number: inv.invoice_number || null,
          invoice_date: inv.invoice_date || null,
          amount: typeof inv.amount === 'number' ? inv.amount : (typeof inv.amount === 'string' ? parseFloat(inv.amount) : null),
          payments_received: 0,
          agreement_number: agreement?.agreement_number || null,
          phase_name: phase?.phase_name || null,
          description_of_work: agreement?.description_of_work || null,
        });
        setInvoicePdfOnSave(undefined); // Already saved, no deferred save needed
        setInvoicePdfDialogOpen(true);
      }
      setPrePopulatedInvoice(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Payment mutations
  const savePaymentMutation = useMutation({
    mutationFn: async (payment: Partial<Payment>) => {
      let savedRecordId: string | undefined;
      
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
        savedRecordId = editingPayment.id;
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
        savedRecordId = newPayment.id;
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

      // Sync to QuickBooks if connected — check for duplicates first
      let qbSynced = false;
      let qbNewEntities: { type: string; name: string }[] = [];
      if (savedRecordId) {
        const qbResult = await checkQbDuplicatesAndSync("payment", savedRecordId, {
          amount: payment.payment_amount || 0,
          date: (editingPayment?.projected_received_date || payment.projected_received_date || new Date().toISOString()).slice(0, 10),
          reference: payment.check_number || null,
          vendorName: null,
          paymentMethod: payment.payment_schedule || null,
        });
        qbSynced = qbResult.synced;
        qbNewEntities = qbResult.newEntities || [];
      }

      return { qbSynced, isEdit: !!editingPayment?.id, qbNewEntities };
    },
    onSuccess: (result) => {
      const baseMsg = result?.isEdit ? "Payment updated" : "Payment created";
      if (result?.qbSynced) {
        const newCustomer = result.qbNewEntities?.find(e => e.type === "customer");
        if (newCustomer) {
          toast.success(`${baseMsg} and synced to QuickBooks (new customer "${newCustomer.name}" created)`);
        } else {
          toast.success(`${baseMsg} and synced to QuickBooks`);
        }
      } else {
        toast.success(baseMsg);
      }
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
      queryClient.invalidateQueries({ queryKey: ["pending-deposits-count"] });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits-count-tab"] });
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Bill mutations - simplified (payments handled via QuickPay only)
  const saveBillMutation = useMutation({
    mutationFn: async (bill: Partial<Bill>) => {
      let savedRecordId: string | undefined;
      
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
        savedRecordId = editingBill.id;
      } else {
        // Deduplication guard: check if an identical bill was just created (within last 30 seconds)
        if (bill.bill_ref && bill.installer_company) {
          const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
          const { data: existingDupe } = await supabase
            .from("project_bills")
            .select("id")
            .eq("project_id", projectId)
            .eq("bill_ref", bill.bill_ref)
            .eq("installer_company", bill.installer_company)
            .eq("bill_amount", bill.bill_amount || 0)
            .gte("created_at", thirtySecondsAgo)
            .limit(1);
          if (existingDupe && existingDupe.length > 0) {
            throw new Error("This bill was already saved. Duplicate prevented.");
          }
        }

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

        savedRecordId = newBill.id;

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
              description: `Applied ${formatCurrency(offsetAmount)} credit offset - reduced bill from ${formatCurrency(targetBill.bill_amount)} to ${formatCurrency(newBillAmount)}`,
            });

            // Sync the updated target bill to QuickBooks so the reduced amount is reflected
            try {
              // Fetch the full target bill record to get vendor/date info for QB sync
              const { data: fullTargetBill } = await supabase
                .from("project_bills")
                .select("id, bill_amount, bill_ref, installer_company, created_at")
                .eq("id", bill.offset_bill_id)
                .single();

              if (fullTargetBill) {
                const targetQbResult = await checkQbDuplicatesAndSync("bill", fullTargetBill.id, {
                  amount: fullTargetBill.bill_amount || 0,
                  date: (fullTargetBill.created_at || new Date().toISOString()).slice(0, 10),
                  reference: fullTargetBill.bill_ref || null,
                  vendorName: fullTargetBill.installer_company || null,
                });
                if (targetQbResult.synced) {

                }
              }
            } catch (qbErr) {
              console.error("Failed to sync target bill to QB after credit offset:", qbErr);
            }
          }
        }
      }

      // Sync to QuickBooks if connected — check for duplicates first
      let qbSynced = false;
      let qbNewEntities: { type: string; name: string }[] = [];
      if (savedRecordId) {
        const qbResult = await checkQbDuplicatesAndSync("bill", savedRecordId, {
          amount: bill.bill_amount || 0,
          date: (editingBill?.created_at || bill.created_at || new Date().toISOString()).slice(0, 10),
          reference: bill.bill_ref || null,
          vendorName: bill.installer_company || null,
        });
        qbSynced = qbResult.synced;
        qbNewEntities = qbResult.newEntities || [];
      }

      return { qbSynced, isEdit: !!editingBill?.id, qbNewEntities };
    },
    onSuccess: (result) => {
      const baseMsg = result?.isEdit ? "Bill updated" : "Bill created";
      if (result?.qbSynced) {
        const newVendor = result.qbNewEntities?.find(e => e.type === "vendor");
        if (newVendor) {
          toast.success(`${baseMsg} and synced to QuickBooks (new vendor "${newVendor.name}" created)`);
        } else {
          toast.success(`${baseMsg} and synced to QuickBooks`);
        }
      } else {
        toast.success(baseMsg);
      }
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-sync-statuses"] });
      setBillDialogOpen(false);
      setEditingBill(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Handler to check QB before saving bill - shows confirmation dialog if new vendor needed
  const handleBillSaveWithQbCheck = async (billData: Partial<Bill>) => {
    // Prevent double-submit: if mutation is already in-flight, ignore
    if (saveBillMutation.isPending) return;

    // For new bills with a vendor, check if vendor exists in QB first
    if (!editingBill?.id && billData.installer_company) {
      const check = await checkVendorBeforeSave(billData.installer_company);
      
      if (check.requiresConfirmation && check.pendingEntities.length > 0) {
        // Store pending data and show confirmation dialog
        setPendingBillSave({
          bill: billData,
          pendingEntities: check.pendingEntities,
        });
        setQbConfirmDialogOpen(true);
        return; // Don't save yet - wait for user confirmation
      }
    }
    
    // No confirmation needed - proceed with save
    saveBillMutation.mutate(billData);
  };

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

      // Sync the bill to QuickBooks first
      const billQbResult = await syncRecordToQuickBooks("bill", billId);
      let billPaymentQbResult = { synced: false };
      if (billQbResult.synced) {
        // Get bill info for vendor name
        const billForVendor = bills.find(b => b.id === billId);
        // Check for duplicates before syncing the bill payment
        billPaymentQbResult = await checkQbDuplicatesAndSync("bill_payment", newPayment.id, {
          amount: payment.payment_amount || 0,
          date: payment.payment_date || "",
          reference: payment.payment_reference || null,
          vendorName: billForVendor?.installer_company || null,
          paymentMethod: payment.payment_method || null,
        });
      }
      return { qbSynced: billPaymentQbResult.synced || billQbResult.synced };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Payment recorded and synced to QuickBooks");
      } else {
        toast.success("Payment recorded");
      }
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      queryClient.invalidateQueries({ queryKey: ["project-bill-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });
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

      // Sync void to QuickBooks first
      const qbResult = await syncDeleteToQuickBooks("bill", billId);

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

      return { qbSynced: qbResult.synced };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Bill voided and synced to QuickBooks");
      } else {
        toast.success("Bill voided");
      }
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
      // Sync void to QuickBooks first
      const qbResult = await syncDeleteToQuickBooks("payment", paymentId);

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

      return { qbSynced: qbResult.synced };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Payment voided and synced to QuickBooks");
      } else {
        toast.success("Payment voided");
      }
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
      setVoidPaymentDialogOpen(false);
      setVoidingPayment(null);
      setVoidPaymentReason("");
    },
    onError: (error) => toast.error(`Failed to void payment: ${error.message}`),
  });

  // Save (create/update) a refund
  const saveRefundMutation = useMutation({
    mutationFn: async (refund: Partial<Refund>) => {
      let savedRecordId: string | null = null;
      if (editingRefund?.id) {
        const { error } = await supabase
          .from("project_refunds")
          .update(refund)
          .eq("id", editingRefund.id);
        if (error) throw error;
        savedRecordId = editingRefund.id;
      } else {
        const { data: newRefund, error } = await supabase
          .from("project_refunds")
          .insert({ ...refund, project_id: projectId, company_id: companyId } as any)
          .select()
          .single();
        if (error) throw error;
        savedRecordId = newRefund.id;
      }

      // Sync to QuickBooks if connected
      let qbSynced = false;
      let qbNewEntities: { type: string; name: string }[] = [];
      if (savedRecordId) {
        const qbResult = await checkQbDuplicatesAndSync("refund", savedRecordId, {
          amount: refund.refund_amount || 0,
          date: (refund.refund_date || new Date().toISOString()).slice(0, 10),
          reference: refund.refund_reference || null,
          vendorName: null,
          paymentMethod: refund.refund_method || null,
        });
        qbSynced = qbResult.synced;
        qbNewEntities = qbResult.newEntities || [];
        // If user cancelled the entry from the duplicate dialog, the record was already deleted
        if (qbResult.message === "Entry cancelled by user") {
          return { qbSynced: false, isEdit: !!editingRefund?.id, qbNewEntities: [], cancelled: true };
        }
      }

      return { qbSynced, isEdit: !!editingRefund?.id, qbNewEntities, cancelled: false };
    },
    onSuccess: (result) => {
      // If user cancelled from duplicate dialog, don't show success toast
      if (result?.cancelled) {
        queryClient.invalidateQueries({ queryKey: ["project-refunds", projectId] });
        setRefundDialogOpen(false);
        setEditingRefund(null);
        return;
      }
      const baseMsg = result?.isEdit ? "Refund updated" : "Refund created";
      if (result?.qbSynced) {
        const newCustomer = result.qbNewEntities?.find(e => e.type === "customer");
        if (newCustomer) {
          toast.success(`${baseMsg} and synced to QuickBooks (new customer "${newCustomer.name}" created)`);
        } else {
          toast.success(`${baseMsg} and synced to QuickBooks`);
        }
      } else {
        toast.success(baseMsg);
      }
      queryClient.invalidateQueries({ queryKey: ["project-refunds", projectId] });
      setRefundDialogOpen(false);
      setEditingRefund(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Void a refund
  const voidRefundMutation = useMutation({
    mutationFn: async ({ refundId, reason, userId }: { refundId: string; reason: string; userId: string }) => {
      const qbResult = await syncDeleteToQuickBooks("refund", refundId);

      const { error } = await supabase
        .from("project_refunds")
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: userId,
          void_reason: reason,
        })
        .eq("id", refundId);
      if (error) throw error;

      return { qbSynced: qbResult.synced };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Refund voided and synced to QuickBooks");
      } else {
        toast.success("Refund voided");
      }
      queryClient.invalidateQueries({ queryKey: ["project-refunds", projectId] });
      setVoidRefundDialogOpen(false);
      setVoidingRefund(null);
      setVoidRefundReason("");
    },
    onError: (error) => toast.error(`Failed to void refund: ${error.message}`),
  });

  const deleteRefundMutation = useMutation({
    mutationFn: async (refundId: string) => {
      const qbResult = await syncDeleteToQuickBooks("refund", refundId);
      const { error } = await supabase
        .from("project_refunds")
        .delete()
        .eq("id", refundId);
      if (error) throw error;
      return { qbSynced: qbResult.synced };
    },
    onSuccess: (result) => {
      toast.success(result?.qbSynced ? "Refund deleted and removed from QuickBooks" : "Refund deleted");
      queryClient.invalidateQueries({ queryKey: ["project-refunds", projectId] });
      setDeleteRefundDialogOpen(false);
      setDeletingRefund(null);
    },
    onError: (error) => toast.error(`Failed to delete refund: ${error.message}`),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: async ({
      agreement,
    }: {
      agreement: Partial<Agreement>;
      closeOnSuccess?: boolean;
    }): Promise<Agreement> => {
      if (editingAgreement?.id) {
        await logAudit({
          tableName: 'project_agreements',
          recordId: editingAgreement.id,
          action: 'UPDATE',
          oldValues: editingAgreement,
          newValues: agreement,
          description: `Updated agreement ${agreement.agreement_number || editingAgreement.agreement_number}`,
        });
        const { data: updatedAgreement, error } = await supabase
          .from("project_agreements")
          .update(agreement)
          .eq("id", editingAgreement.id)
          .select()
          .single();
        if (error) throw error;
        return updatedAgreement as Agreement;
      }

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

      return newAgreement as Agreement;
    },
    onSuccess: async (savedAgreement, variables) => {
      const shouldClose = variables?.closeOnSuccess !== false;
      const isNewContract = !editingAgreement?.id && savedAgreement.agreement_type === "Contract";

      setExtractedPhases([]);
      setExtractedPhasesAgreementId(null);
      toast.success(editingAgreement?.id ? "Agreement updated" : "Agreement created");
      queryClient.invalidateQueries({ queryKey: ["project-agreements", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-agreements"] });

      // When admin manually creates a Contract agreement, mark the linked estimate as accepted
      if (isNewContract) {
        try {
          // Extract estimate number from agreement number (e.g., "CNT-2106" → 2106)
          const agreementNum = savedAgreement.agreement_number || "";
          const match = agreementNum.match(/(\d+)/);
          const estimateNumber = match ? Number(match[1]) : null;

          let estimateQuery = supabase
            .from("estimates")
            .select("id, status")
            .eq("project_id", projectId);

          if (estimateNumber) {
            estimateQuery = estimateQuery.eq("estimate_number", estimateNumber);
          } else {
            // Fallback: find the first sent estimate for this project
            estimateQuery = estimateQuery.eq("status", "sent");
          }

          const { data: estimateRow } = await estimateQuery.maybeSingle();

          if (estimateRow && estimateRow.status !== "accepted") {
            await supabase
              .from("estimates")
              .update({
                status: "accepted",
                signed_at: savedAgreement.agreement_signed_date || new Date().toISOString().split("T")[0],
              })
              .eq("id", estimateRow.id);
          }
        } catch (err) {
          console.error("Failed to auto-mark estimate as accepted:", err);
        }
      }

      if (shouldClose) {
        setAgreementDialogOpen(false);
        setEditingAgreement(null);
      } else {
        setEditingAgreement(savedAgreement);
      }
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
      toast.success(editingPhase?.id ? "Progress payment updated" : "Progress payment created");
      queryClient.invalidateQueries({ queryKey: ["project-payment-phases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
      setPhaseDialogOpen(false);
      setEditingPhase(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Reorder phases mutation
  const reorderPhasesMutation = useMutation({
    mutationFn: async ({ phases }: { phases: { id: string; display_order: number }[] }) => {
      // Update each phase's display_order
      const updates = phases.map((phase) =>
        supabase
          .from("project_payment_phases")
          .update({ display_order: phase.display_order })
          .eq("id", phase.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-payment-phases", projectId] });
    },
    onError: (error) => toast.error(`Failed to reorder: ${error.message}`),
  });

  // Track payments associated with invoice being deleted
  const [invoicePaymentsToDelete, setInvoicePaymentsToDelete] = useState<Payment[]>([]);
  // Track invoices/payments associated with phase being deleted
  const [phaseInvoicesToDelete, setPhaseInvoicesToDelete] = useState<Invoice[]>([]);
  const [phasePaymentsToDelete, setPhasePaymentsToDelete] = useState<Payment[]>([]);

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

      let qbSynced = false;

      // Sync delete to QuickBooks for financial records
      if (["invoice", "payment", "bill"].includes(deleteTarget.type)) {
        const qbResult = await syncDeleteToQuickBooks(deleteTarget.type, deleteTarget.id);
        qbSynced = qbResult.synced;
      }

      // If deleting a phase, cascade-delete associated invoices and their payments
      if (deleteTarget.type === "phase" && phaseInvoicesToDelete.length > 0) {
        for (const phaseInv of phaseInvoicesToDelete) {
          // Delete payments linked to this invoice first
          const invPayments = phasePaymentsToDelete.filter(p => p.invoice_id === phaseInv.id);
          for (const payment of invPayments) {
            const paymentQbResult = await syncDeleteToQuickBooks("payment", payment.id);
            if (paymentQbResult.synced) qbSynced = true;
            await logAudit({
              tableName: "project_payments",
              recordId: payment.id,
              action: 'DELETE',
              description: `Deleted payment (cascade from phase delete)`,
            });
            const { error: paymentError } = await supabase.from("project_payments").delete().eq("id", payment.id);
            if (paymentError) throw paymentError;
          }
          // Delete the invoice
          const invQbResult = await syncDeleteToQuickBooks("invoice", phaseInv.id);
          if (invQbResult.synced) qbSynced = true;
          await logAudit({
            tableName: "project_invoices",
            recordId: phaseInv.id,
            action: 'DELETE',
            description: `Deleted invoice #${phaseInv.invoice_number} (cascade from phase delete)`,
          });
          const { error: invError } = await supabase.from("project_invoices").delete().eq("id", phaseInv.id);
          if (invError) throw invError;
        }
      }

      // If deleting an invoice with associated payments, delete payments first
      if (deleteTarget.type === "invoice" && invoicePaymentsToDelete.length > 0) {
        for (const payment of invoicePaymentsToDelete) {
          // Sync each payment deletion to QuickBooks
          const paymentQbResult = await syncDeleteToQuickBooks("payment", payment.id);
          if (paymentQbResult.synced) qbSynced = true;
          
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
              description: `Reversed ${formatCurrency(offsetAmount)} credit offset - restored bill from ${formatCurrency(targetBill.bill_amount)} to ${formatCurrency(newBillAmount)}`,
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
      
      // If deleting a payment, update the associated invoice's open_balance first
      if (deleteTarget.type === "payment") {
        const paymentToDelete = payments.find(p => p.id === deleteTarget.id);
        if (paymentToDelete?.invoice_id && paymentToDelete.payment_amount) {
          // Get the current invoice
          const { data: invoice, error: invoiceError } = await supabase
            .from("project_invoices")
            .select("open_balance")
            .eq("id", paymentToDelete.invoice_id)
            .single();
          
          if (!invoiceError && invoice) {
            // Add the payment amount back to the open_balance
            const newBalance = (invoice.open_balance || 0) + paymentToDelete.payment_amount;
            const { error: updateError } = await supabase
              .from("project_invoices")
              .update({ open_balance: newBalance })
              .eq("id", paymentToDelete.invoice_id);
            
            if (updateError) {
              console.error("Failed to update invoice balance:", updateError);
            } else {

            }
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

      return { qbSynced, recordType: deleteTarget.type };
    },
    onSuccess: (result) => {
      const isFinancialRecord = ["invoice", "payment", "bill"].includes(result?.recordType || "");
      if (isFinancialRecord && result?.qbSynced) {
        toast.success("Deleted and synced to QuickBooks");
      } else {
        toast.success("Deleted successfully");
      }
      const queryKey = deleteTarget?.type === "phase" 
        ? ["project-payment-phases", projectId]
        : [`project-${deleteTarget?.type}s`, projectId];
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate global queries for main list refresh
      if (deleteTarget?.type === "phase") {
        queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
        // Also invalidate invoices/payments if we cascade-deleted them
        if (phaseInvoicesToDelete.length > 0) {
          queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
          queryClient.invalidateQueries({ queryKey: ["all-project-invoices"] });
          queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
          queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
          queryClient.invalidateQueries({ queryKey: ["next-invoice-number"] });
        }
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
        // Also invalidate invoices since we updated the balance
        queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
        queryClient.invalidateQueries({ queryKey: ["all-project-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar-ar-total"] });
        // Only warn when QuickBooks is connected and QB void failed
        if (isQBConnectedMain && !result?.qbSynced) {
          toast.warning("Payment could not be voided in QuickBooks. Please void or delete this payment manually in QuickBooks.", {
            duration: 8000,
          });
        }
      } else if (deleteTarget?.type === "bill") {
        queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
        queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setInvoicePaymentsToDelete([]);
      setPhaseInvoicesToDelete([]);
      setPhasePaymentsToDelete([]);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const handleDeleteClick = (type: string, id: string) => {
    // If deleting a phase, check for associated payments first
    if (type === "phase") {
      const phaseInvs = invoices.filter(inv => inv.payment_phase_id === id);
      const phaseInvIds = phaseInvs.map(inv => inv.id);
      const phasePmts = payments.filter(p => p.invoice_id && phaseInvIds.includes(p.invoice_id));
      setPhaseInvoicesToDelete(phaseInvs);
      setPhasePaymentsToDelete(phasePmts);
    } else {
      setPhaseInvoicesToDelete([]);
      setPhasePaymentsToDelete([]);
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

  // Allow editing bill metadata even if payments exist
  const handleEditBillClick = async (bill: Bill) => {
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

  // Calculate offsets for each bill (bills that offset/credit other bills)
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

  const financeContent = (
    <div className="space-y-4 max-w-6xl overflow-auto h-full">

      {/* Sub-tabs for Agreements, Phases, Invoices, Payments, Bills, Commission */}
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
        <div className="w-full overflow-x-auto">
          <div className="inline-flex items-center rounded-xl bg-muted p-1" role="tablist">
            {[
              { value: "agreements", label: "Contracts" },
              { value: "phases", label: "Progress Payments" },
              { value: "invoices", label: "Invoices" },
              { value: "refunds", label: "Refunds" },
              { value: "bills", label: "Bills" },
              { value: "statements", label: "Financial Statements" },
              { value: "commission", label: "Commission" },
            ].map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeSubTab === tab.value}
                aria-current={activeSubTab === tab.value ? "true" : undefined}
                tabIndex={activeSubTab === tab.value ? 0 : -1}
                className={cn(
                  "relative whitespace-nowrap px-4 py-1.5 text-xs rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  activeSubTab === tab.value
                    ? "bg-background shadow-sm text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleSubTabChange(tab.value)}
              >
                {tab.label}
                {activeSubTab === tab.value && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Statements Tab - Project P&L and Balance Sheet */}
        <TabsContent value="statements" className="mt-4">
          <ProjectFinancialStatements
            totalRevenue={totalAgreementsValue}
            totalCOGS={totalBills}
            totalBillsPaid={totalBillsPaid}
            totalCollected={totalPaymentsReceived}
            totalRefunded={totalRefunds}
            totalInvoiced={totalInvoiced}
            leadCostPercent={leadCostPercent}
            commissionSplitPct={commissionSplitPct}
            isCompleted={projectStatus === "Completed"}
            isCancelled={projectStatus === "Cancelled"}
            projectName={projectName}
            projectAddress={projectAddress}
            customerName={customerName}
          />
        </TabsContent>

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
                  ) : (
                    <>
                      {/* Uninvoiced phases section */}
                      {(() => {
                        const invoicedPhaseIds = new Set(invoices.map(inv => inv.payment_phase_id).filter(Boolean));
                        const uninvoicedPhases = paymentPhases
                          .filter(p => !invoicedPhaseIds.has(p.id) && (p.amount || 0) > 0)
                          .sort((a, b) => {
                            const agrA = agreements.find(ag => ag.id === a.agreement_id);
                            const agrB = agreements.find(ag => ag.id === b.agreement_id);
                            const cmp = (agrA?.agreement_number || '').localeCompare(agrB?.agreement_number || '');
                            if (cmp !== 0) return cmp;
                            return (a.display_order || 0) - (b.display_order || 0);
                          })
                          .filter(p => {
                            if (invoiceContractFilter === "all") return true;
                            return p.agreement_id === invoiceContractFilter;
                          });

                        if (uninvoicedPhases.length === 0) return null;

                        return (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Uninvoiced Phases</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs text-left w-[18%]">Contract #<br />/ Nickname</TableHead>
                                  <TableHead className="text-xs text-left w-[25%]">Phase</TableHead>
                                  <TableHead className="text-xs text-center w-[12%]">Due Date</TableHead>
                                  <TableHead className="text-xs text-center w-[12%]">Amount</TableHead>
                                  <TableHead className="text-xs w-[12%]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uninvoicedPhases.map(phase => {
                                  const agr = agreements.find(a => a.id === phase.agreement_id);
                                  return (
                                    <TableRow key={phase.id} className="bg-amber-50/50 dark:bg-amber-900/10">
                                      <TableCell className="text-xs text-left text-muted-foreground">
                                        {agr ? `${agr.agreement_number || ""}${agr.nickname ? ` / ${agr.nickname}` : ""}`.trim() || "-" : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-left">{phase.phase_name}</TableCell>
                                      <TableCell className="text-xs text-center">{phase.due_date ? formatDate(phase.due_date) : "-"}</TableCell>
                                      <TableCell className="text-xs text-center">{formatCurrency2(phase.amount)}</TableCell>
                                      <TableCell>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-[10px] px-2"
                                          onClick={() => {
                                            setEditingInvoice(null);
                                            setInvoiceDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Invoice
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}

                      {/* Contract filter toggle */}
                      {(() => {
                        // Include agreements from both invoices and uninvoiced phases
                        const invoicedPhaseIds = new Set(invoices.map(inv => inv.payment_phase_id).filter(Boolean));
                        const uninvoicedPhases = paymentPhases.filter(p => !invoicedPhaseIds.has(p.id) && (p.amount || 0) > 0);
                        const allAgreementIds = new Set([
                          ...invoices.map(inv => {
                            const phase = paymentPhases.find(p => p.id === inv.payment_phase_id);
                            return inv.agreement_id || phase?.agreement_id;
                          }).filter(Boolean),
                          ...uninvoicedPhases.map(p => p.agreement_id).filter(Boolean),
                        ]);
                        const contractOptions = agreements
                          .filter(a => allAgreementIds.has(a.id))
                          .sort((a, b) => (a.agreement_number || '').localeCompare(b.agreement_number || ''));
                        
                        if (contractOptions.length <= 1) return null;
                        
                        return (
                          <div className="flex gap-1.5 mb-3 flex-wrap">
                            <button
                              onClick={() => setInvoiceContractFilter("all")}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                                invoiceContractFilter === "all"
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              All
                            </button>
                            {contractOptions.map(agr => {
                              const label = agr.nickname || agr.agreement_number || 'Contract';
                              return (
                                <button
                                  key={agr.id}
                                  onClick={() => setInvoiceContractFilter(agr.id)}
                                  className={cn(
                                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                                    invoiceContractFilter === agr.id
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {invoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
                      ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs text-center w-[12%]">Date</TableHead>
                            <TableHead className="text-xs text-center w-[10%]">Invoice #</TableHead>
                            <TableHead className="text-xs text-left w-[18%]">Contract #<br />/ Nickname</TableHead>
                            <TableHead className="text-xs text-center w-[18%]">Progress<br />Payment</TableHead>
                            <TableHead className="text-xs text-center w-[12%]">Amount</TableHead>
                            <TableHead className="text-xs text-center w-[12%]">Balance<br />Due</TableHead>
                            {isQBConnectedMain && <TableHead className="text-xs text-center w-[10%]">QB</TableHead>}
                            <TableHead className="text-xs w-[12%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...invoices]
                            .filter(inv => {
                              if (invoiceContractFilter === "all") return true;
                              const phase = paymentPhases.find(p => p.id === inv.payment_phase_id);
                              const agrId = inv.agreement_id || phase?.agreement_id;
                              return agrId === invoiceContractFilter;
                            })
                            .sort((a, b) => {
                              // Sort by contract # first, then invoice date asc
                              const phaseA = paymentPhases.find(p => p.id === a.payment_phase_id);
                              const phaseB = paymentPhases.find(p => p.id === b.payment_phase_id);
                              const agrA = agreements.find(ag => ag.id === (a.agreement_id || phaseA?.agreement_id));
                              const agrB = agreements.find(ag => ag.id === (b.agreement_id || phaseB?.agreement_id));
                              const numA = agrA?.agreement_number || '';
                              const numB = agrB?.agreement_number || '';
                              const cmp = numA.localeCompare(numB);
                              if (cmp !== 0) return cmp;
                              return (a.invoice_date || '').localeCompare(b.invoice_date || '');
                            })
                            .map((inv) => (
                            <TableRow 
                              key={inv.id}
                              className={cn(
                                highlightInvoiceId === inv.id && "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse"
                              )}
                            >
                              <TableCell className="text-xs text-center">{formatDate(inv.invoice_date)}</TableCell>
                              <TableCell className="text-xs text-center">{inv.invoice_number || "-"}</TableCell>
                              <TableCell className="text-xs text-left text-muted-foreground">
                                {(() => {
                                  const phase = paymentPhases.find(p => p.id === inv.payment_phase_id);
                                  const agr = agreements.find(a => a.id === (inv.agreement_id || phase?.agreement_id));
                                  return agr ? `${agr.agreement_number || ""}${agr.nickname ? ` / ${agr.nickname}` : ""}`.trim() || "-" : "-";
                                })()}
                              </TableCell>
                              <TableCell className="text-xs text-center text-muted-foreground">{inv.payment_phase_id ? (paymentPhases.find(p => p.id === inv.payment_phase_id)?.phase_name || "-") : "-"}</TableCell>
                              <TableCell className="text-xs text-center">{formatCurrency2(inv.amount)}</TableCell>
                              <TableCell className="text-xs text-center">{formatCurrency2(inv.open_balance)}</TableCell>
                              {isQBConnectedMain && (
                                <TableCell className="text-xs">
                                  {(() => {
                                    const syncInfo = (invoiceSyncStatuses as Record<string, { status: string; qbId: string | null }>)[inv.id];
                                    if (syncInfo?.status === "synced") return (
                                      <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                        <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                      </Badge>
                                    );
                                    if (syncInfo) return (
                                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{syncInfo.status}</Badge>
                                    );
                                    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not synced</Badge>;
                                  })()}
                                </TableCell>
                              )}
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(inv.open_balance || 0) > 0 && (
                                      <DropdownMenuItem onClick={() => { 
                                        setEditingPayment(null); 
                                        setPrePopulatedPayment({ invoice_id: inv.id, payment_amount: inv.open_balance || 0 }); 
                                        setPaymentDialogOpen(true); 
                                      }}>
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Record Payment
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => {
                                      const phase = paymentPhases.find(p => p.id === inv.payment_phase_id);
                                      const agreement = agreements.find(a => a.id === (inv.agreement_id || phase?.agreement_id));
                                      setInvoicePdfData({
                                        invoice_id: inv.id,
                                        invoice_number: inv.invoice_number,
                                        invoice_date: inv.invoice_date,
                                        amount: inv.amount,
                                        payments_received: inv.payments_received,
                                        agreement_number: agreement?.agreement_number || null,
                                        phase_name: phase?.phase_name || null,
                                        description_of_work: agreement?.description_of_work || null,
                                      });
                                      setInvoicePdfDialogOpen(true);
                                    }}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      Preview Invoice
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setEditingInvoice(inv); setInvoiceDialogOpen(true); }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("invoice", inv.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
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
                          <TableHead className="text-xs text-left w-[12%]">Bank</TableHead>
                          <TableHead className="text-xs text-left w-[12%]">Date</TableHead>
                          <TableHead className="text-xs text-left w-[10%]">Ref #</TableHead>
                          <TableHead className="text-xs text-center w-[22%]">Payment<br />Status</TableHead>
                          <TableHead className="text-xs text-right w-[12%]">Amount</TableHead>
                          {isQBConnectedMain && <TableHead className="text-xs text-center w-[10%]">QB</TableHead>}
                          <TableHead className="text-xs w-[12%]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((pmt) => (
                          <TableRow key={pmt.id} className={pmt.is_voided ? "opacity-50 bg-muted/30" : ""}>
                            <TableCell className="text-xs text-left">{pmt.bank?.name || pmt.bank_name || "-"}</TableCell>
                            <TableCell className="text-xs text-left">{formatDate(pmt.projected_received_date)}</TableCell>
                            <TableCell className="text-xs text-left">{pmt.check_number || "-"}</TableCell>
                            <TableCell className="text-xs">
              <div className="flex items-center gap-1 flex-wrap">
                                {pmt.is_voided ? (
                                  <div>
                                    <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {formatDate(pmt.voided_at)}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <Badge variant="outline" className={cn(
                                      "px-1.5 py-0 text-[10px]",
                                      pmt.payment_status === "Received" ? "bg-emerald-500/10 text-emerald-500" :
                                      pmt.payment_status === "Pending" ? "bg-amber-500/10 text-amber-500" :
                                      "bg-muted"
                                    )}>
                                      {pmt.payment_status || "Pending"}
                                    </Badge>
                                    {pmt.payment_status === "Received" && (
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
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn("text-xs text-right", pmt.is_voided && "line-through")}>{formatCurrency2(pmt.payment_amount)}</TableCell>
                            {isQBConnectedMain && (
                              <TableCell className="text-xs">
                                {(() => {
                                  const syncInfo = (paymentSyncStatuses as Record<string, { status: string; qbId: string | null }>)[pmt.id];
                                  if (syncInfo?.status === "synced") return (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                      <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                    </Badge>
                                  );
                                  if (syncInfo) return (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{syncInfo.status}</Badge>
                                  );
                                  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not synced</Badge>;
                                })()}
                              </TableCell>
                            )}
                            <TableCell>
                              {pmt.is_voided ? (
                                <p className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={pmt.void_reason || ""}>
                                  {pmt.void_reason || "No reason"}
                                </p>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setEditingPayment(pmt); setPaymentDialogOpen(true); }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setVoidingPayment(pmt); setVoidPaymentDialogOpen(true); }}>
                                      <X className="h-4 w-4 mr-2" />
                                      Void
                                    </DropdownMenuItem>
                                    {(isAdmin || isSuperAdmin) && (
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("payment", pmt.id)}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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


        {/* Refunds Tab */}
        <TabsContent value="refunds" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Refunds</CardTitle>
                <Button size="sm" onClick={() => { setEditingRefund(null); setRefundDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Issue Refund
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRefunds ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : refunds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No refunds yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-left w-[14%]">Date</TableHead>
                      <TableHead className="text-xs text-left w-[12%]">Method</TableHead>
                      <TableHead className="text-xs text-left w-[12%]">Ref #</TableHead>
                      <TableHead className="text-xs text-left w-[20%]">Reason</TableHead>
                      <TableHead className="text-xs text-center w-[12%]">Status</TableHead>
                      <TableHead className="text-xs text-right w-[12%]">Amount</TableHead>
                      {isQBConnectedMain && <TableHead className="text-xs text-center w-[8%]">QB</TableHead>}
                      <TableHead className="text-xs w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((ref) => (
                      <TableRow key={ref.id} className={ref.is_voided ? "opacity-50 bg-muted/30" : ""}>
                        <TableCell className="text-xs text-left">{formatDate(ref.refund_date)}</TableCell>
                        <TableCell className="text-xs text-left">{ref.refund_method || "-"}</TableCell>
                        <TableCell className="text-xs text-left">{ref.refund_reference || "-"}</TableCell>
                        <TableCell className="text-xs text-left truncate max-w-[180px]" title={ref.reason || ""}>{ref.reason || "-"}</TableCell>
                        <TableCell className="text-xs text-center">
                          {ref.is_voided ? (
                            <div>
                              <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(ref.voided_at)}</p>
                            </div>
                          ) : (
                            <Badge variant="outline" className={cn(
                              "px-1.5 py-0 text-[10px]",
                              ref.refund_status === "Issued" ? "bg-emerald-500/10 text-emerald-500" :
                              ref.refund_status === "Pending" ? "bg-amber-500/10 text-amber-500" :
                              "bg-muted"
                            )}>
                              {ref.refund_status || "Pending"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-xs text-right", ref.is_voided && "line-through")}>{formatCurrency2(ref.refund_amount)}</TableCell>
                        {isQBConnectedMain && (
                          <TableCell className="text-xs">
                            {(() => {
                              const syncInfo = (refundSyncStatuses as Record<string, { status: string; qbId: string | null }>)[ref.id];
                              if (syncInfo?.status === "synced") return (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                  <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                </Badge>
                              );
                              if (syncInfo) return (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{syncInfo.status}</Badge>
                              );
                              return (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const result = await checkQbDuplicatesAndSync("refund", ref.id, {
                                      amount: ref.refund_amount || 0,
                                      date: (ref.refund_date || new Date().toISOString()).slice(0, 10),
                                      reference: ref.refund_reference || null,
                                      vendorName: null,
                                      paymentMethod: ref.refund_method || null,
                                    });
                                    if (result.synced) {
                                      toast.success("Refund synced to QuickBooks");
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["refund-sync-statuses", projectId, companyId] });
                                  }}
                                >
                                  <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                                  Sync
                                </Button>
                              );
                            })()}
                          </TableCell>
                        )}
                        <TableCell>
                          {ref.is_voided ? (
                            <p className="text-[10px] text-muted-foreground italic max-w-[120px] truncate" title={ref.void_reason || ""}>
                              {ref.void_reason || "No reason"}
                            </p>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingRefund(ref); setRefundDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setVoidingRefund(ref); setVoidRefundDialogOpen(true); }}>
                                  <X className="h-4 w-4 mr-2" />
                                  Void
                                </DropdownMenuItem>
                                {(isAdmin || isSuperAdmin) && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingRefund(ref); setDeleteRefundDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                  onClick={() => handleBillsSubTabChange("bills")}
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
                  onClick={() => handleBillsSubTabChange("history")}
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
                // Bills list - grouped by company
                <>
                  {loadingBills ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : bills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No bills yet</p>
                  ) : (() => {
                    // Group bills by installer_company
                    const grouped = bills.reduce<Record<string, Bill[]>>((acc, bill) => {
                      const company = bill.installer_company || "Unassigned";
                      if (!acc[company]) acc[company] = [];
                      acc[company].push(bill);
                      return acc;
                    }, {});
                    const sortedCompanies = Object.keys(grouped).sort((a, b) => a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b));

                    return (
                      <div className="space-y-2">
                        {sortedCompanies.map((company) => {
                          const companyBills = grouped[company];
                          const totalAmount = companyBills.reduce((s, b) => s + (b.bill_amount || 0), 0);
                          const totalPaid = companyBills.reduce((s, b) => s + (b.amount_paid || 0), 0);
                          const totalBalance = companyBills.reduce((s, b) => s + (b.balance || 0), 0);
                          const hasHighlightedBill = highlightBillId && companyBills.some(b => b.id === highlightBillId);
                          return (
                            <Collapsible key={`${company}-${highlightBillId || ''}`} defaultOpen={!!hasHighlightedBill}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
                                <div className="flex items-center gap-2">
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [&[data-state=open]]:rotate-0 rotate-[-90deg]" />
                                  <span className="text-sm font-medium">{company}{subcontractorContactMap[company] && subcontractorContactMap[company] !== company ? ` (${subcontractorContactMap[company]})` : ''}</span>
                                  <Badge variant="secondary" className="text-[10px]">{companyBills.length}</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-muted-foreground">Amount: <span className="font-medium text-foreground">{formatCurrency2(totalAmount)}</span></span>
                                  <span className="text-muted-foreground">Paid: <span className="font-medium text-emerald-600">{formatCurrency2(totalPaid)}</span></span>
                                  {totalBalance <= 0 && totalPaid > 0 ? (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Paid in Full</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">Balance: <span className="font-medium text-foreground">{formatCurrency2(totalBalance)}</span></span>
                                  )}
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs text-center">Bill Ref</TableHead>
                                      <TableHead className="text-xs text-center">Category</TableHead>
                                      <TableHead className="text-xs text-center">Amount</TableHead>
                                      <TableHead className="text-xs text-center">Paid</TableHead>
                                      <TableHead className="text-xs text-center">Balance</TableHead>
                                      {isQBConnectedMain && <TableHead className="text-xs text-center">QB</TableHead>}
                                      <TableHead className="text-xs w-10"></TableHead>
                                      <TableHead className="text-xs w-40"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {companyBills.map((bill) => {
                                      const offsets = billOffsets[bill.id];
                                      const offsetTarget = getOffsetTargetBill(bill.offset_bill_id);
                                      const hasBeenOffset = bill.original_bill_amount !== null && bill.original_bill_amount !== bill.bill_amount;
                                      
                                      return (
                                      <TableRow key={bill.id} className={cn(bill.is_voided && "opacity-50 bg-muted/30", bill.offset_bill_id && "bg-primary/5", highlightBillId === bill.id && "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse")}>
                                        <TableCell className="text-xs">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-medium">{bill.bill_ref || "-"}</span>
                                            {bill.is_voided ? (
                                              <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                                            ) : bill.offset_bill_id ? (
                                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">Offset</Badge>
                                            ) : (bill.balance || 0) <= 0 ? (
                                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">Paid</Badge>
                                            ) : null}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          <div>
                                            {bill.category || "-"}
                                            {offsetTarget && (
                                              <p className="text-[10px] text-blue-600">
                                                → Offsets: {offsetTarget.installer_company}
                                              </p>
                                            )}
                                            {offsets && offsets.offsetBills.length > 0 && (
                                              <button
                                                type="button"
                                                className="block text-[10px] text-amber-600 hover:text-amber-800 hover:underline cursor-pointer bg-transparent border-none p-0 mt-0.5"
                                                onClick={(e) => { e.stopPropagation(); setOffsetDetailsBill({ bill, offsets }); }}
                                              >
                                                Credit offset applied ({offsets.offsetBills.length})
                                              </button>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className={cn("text-xs text-center", bill.is_voided && "line-through")}>
                                          {hasBeenOffset ? (
                                            <div>
                                              <span className="line-through text-muted-foreground">{formatCurrency2(bill.original_bill_amount)}</span>
                                              <span className="ml-1 font-medium">{formatCurrency2(bill.bill_amount)}</span>
                                            </div>
                                          ) : (
                                            formatCurrency2(bill.bill_amount)
                                          )}
                                        </TableCell>
                                        <TableCell className={cn("text-xs text-center text-emerald-600", bill.is_voided && "line-through")}>{formatCurrency2(bill.amount_paid)}</TableCell>
                                        <TableCell className={cn("text-xs text-center", bill.is_voided && "line-through")}>
                                          {!bill.is_voided && (bill.balance || 0) <= 0 && (bill.amount_paid || 0) > 0 ? (
                                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Paid in Full</Badge>
                                          ) : (
                                            formatCurrency2(bill.balance)
                                          )}
                                        </TableCell>
                                        {isQBConnectedMain && (
                                          <TableCell className="text-xs">
                                            {(() => {
                                              const syncInfo = (billSyncStatuses as Record<string, { status: string; qbId: string | null }>)[bill.id];
                                              if (syncInfo?.status === "synced") return (
                                                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                                  <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                                </Badge>
                                              );
                                              if (syncInfo?.status === "deleted_in_qb") return (
                                                <Badge 
                                                  variant="outline" 
                                                  className="text-[10px] text-destructive border-destructive/50 cursor-pointer hover:bg-destructive/10 transition-colors"
                                                  title="Deleted in QB — click to resync"
                                                  onClick={async () => {
                                                    if (syncingBillId) return;
                                                    setSyncingBillId(bill.id);
                                                    try {
                                                      const result = await syncRecordToQuickBooks("bill", bill.id);
                                                      if (result.synced) {
                                                        toast.success("Bill resynced to QuickBooks");
                                                        queryClient.invalidateQueries({ queryKey: ["bill-sync-statuses"] });
                                                      } else {
                                                        toast.error(result.message || "Failed to resync bill");
                                                      }
                                                    } catch {
                                                      toast.error("Failed to resync bill");
                                                    } finally {
                                                      setSyncingBillId(null);
                                                    }
                                                  }}
                                                >
                                                  {syncingBillId === bill.id ? (
                                                    <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                                                  ) : null}
                                                  QB Deleted
                                                </Badge>
                                              );
                                              if (syncInfo) return (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                                  {syncInfo.status}
                                                </Badge>
                                              );
                                              return (
                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                  Unsynced
                                                </Badge>
                                              );
                                            })()}
                                          </TableCell>
                                        )}
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
                                            <div className="flex items-center gap-2">
                                              <p className="text-[10px] text-muted-foreground italic max-w-[100px] truncate" title={bill.void_reason || ""}>
                                                {bill.void_reason || "Deleted in QB"}
                                              </p>
                                              {(isAdmin || isSuperAdmin) && (
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                      <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("bill", bill.id)}>
                                                      <Trash2 className="h-4 w-4 mr-2" />
                                                      Delete
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              )}
                                            </div>
                                          ) : (
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setHistoryBill(bill); setHistoryDialogOpen(true); }}>
                                                  <History className="h-4 w-4 mr-2" />
                                                  History
                                                </DropdownMenuItem>
                                                {(bill.balance || 0) > 0 && (
                                                  <DropdownMenuItem onClick={() => { setPayingBill(bill); setQuickPayDialogOpen(true); }}>
                                                    <CreditCard className="h-4 w-4 mr-2" />
                                                    Pay
                                                  </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => handleEditBillClick(bill)}>
                                                  <Pencil className="h-4 w-4 mr-2" />
                                                  Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setVoidingBill(bill); setVoidDialogOpen(true); }}>
                                                  <X className="h-4 w-4 mr-2" />
                                                  Void
                                                </DropdownMenuItem>
                                                {(isAdmin || isSuperAdmin) && (
                                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("bill", bill.id)}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              ) : (
                // Payment History - grouped by company
                <>
                  {loadingBillPayments ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : allBillPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No payment history yet</p>
                  ) : (() => {
                    const grouped = allBillPayments.reduce<Record<string, any[]>>((acc, payment: any) => {
                      const company = payment.bill?.installer_company || "Unassigned";
                      if (!acc[company]) acc[company] = [];
                      acc[company].push(payment);
                      return acc;
                    }, {});
                    const sortedCompanies = Object.keys(grouped).sort((a, b) => a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b));

                    return (
                      <div className="space-y-2">
                        {sortedCompanies.map((company) => {
                          const companyPayments = grouped[company];
                          const totalPaid = companyPayments.reduce((s: number, p: any) => s + (p.payment_amount || 0), 0);
                          const hasHighlightedPayment = highlightPaymentId && companyPayments.some((p: any) => p.id === highlightPaymentId);
                          return (
                            <Collapsible key={`${company}-${highlightPaymentId || ''}`} defaultOpen={!!hasHighlightedPayment}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
                                <div className="flex items-center gap-2">
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [&[data-state=open]]:rotate-0 rotate-[-90deg]" />
                                  <span className="text-sm font-medium">{company}</span>
                                  <Badge variant="secondary" className="text-[10px]">{companyPayments.length}</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-muted-foreground">Total Paid: <span className="font-medium text-emerald-600">{formatCurrency2(totalPaid)}</span></span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs text-center">Date</TableHead>
                                      <TableHead className="text-xs text-center">Bill Ref</TableHead>
                                      <TableHead className="text-xs text-center">Amount</TableHead>
                                      <TableHead className="text-xs text-center">Method</TableHead>
                                      <TableHead className="text-xs text-center">Reference</TableHead>
                                      <TableHead className="text-xs text-center">Bank</TableHead>
                                      {isQBConnectedMain && <TableHead className="text-xs text-center">QB</TableHead>}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {companyPayments.map((payment: any) => {
                                      const fullBill = bills.find(b => b.id === payment.bill_id);
                                      const syncInfo = (billPaymentSyncStatuses as Record<string, { status: string; qbId: string | null }>)[payment.id];
                                      return (
                                        <TableRow 
                                          key={payment.id} 
                                          className={cn(
                                            "cursor-pointer hover:bg-muted/50",
                                            highlightPaymentId === payment.id && "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse"
                                          )}
                                          onClick={() => {
                                            if (fullBill) {
                                              setHistoryBill(fullBill);
                                              setHistoryDialogOpen(true);
                                            }
                                          }}
                                        >
                                          <TableCell className="text-xs text-center">{formatDate(payment.payment_date)}</TableCell>
                                          <TableCell className="text-xs text-center">{payment.bill?.bill_ref || "-"}</TableCell>
                                          <TableCell className="text-xs text-center text-emerald-600 font-medium">
                                            {formatCurrency2(payment.payment_amount)}
                                          </TableCell>
                                          <TableCell className="text-xs text-center">{payment.payment_method || "-"}</TableCell>
                                          <TableCell className="text-xs text-center">{payment.payment_reference || "-"}</TableCell>
                                          <TableCell className="text-xs text-center">{payment.bank?.name || payment.bank_name || "-"}</TableCell>
                                          {isQBConnectedMain && (
                                            <TableCell className="text-xs">
                                              {syncInfo?.status === "synced" ? (
                                                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                                  <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                                </Badge>
                                              ) : syncInfo ? (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                                  {syncInfo.status}
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                  Not synced
                                                </Badge>
                                              )}
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                        <div className="mt-4 pt-3 border-t flex justify-end">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Total Paid: </span>
                            <span className="font-medium text-emerald-600">
                              {formatCurrency2(allBillPayments.reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
                  {agreements.some(a => a.agreement_type === "Contract") ? "Add Change Order / Addendum" : "Add"}
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
                      <TableHead className="text-xs text-center">Agreement<br />#</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Nickname</TableHead>
                      <TableHead className="text-xs text-center">Date<br />Signed</TableHead>
                      <TableHead className="text-xs text-center">Contract<br />Value</TableHead>
                      <TableHead className="text-xs text-center">Progress Payments<br />Total</TableHead>
                      <TableHead className="text-xs text-center">Total Collected<br />To Date</TableHead>
                      <TableHead className="text-xs text-center">Unpaid<br />Balance</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...agreements].sort((a, b) => {
                      // Contract type first, then by signed date ascending
                      const aIsContract = a.agreement_type === 'Contract';
                      const bIsContract = b.agreement_type === 'Contract';
                      if (aIsContract && !bIsContract) return -1;
                      if (!aIsContract && bIsContract) return 1;
                      const dateA = new Date(a.agreement_signed_date || a.created_at).getTime();
                      const dateB = new Date(b.agreement_signed_date || b.created_at).getTime();
                      return dateA - dateB;
                    }).map((agreement) => {
                      const phasesTotal = paymentPhases
                        .filter(p => p.agreement_id === agreement.id)
                        .reduce((sum, p) => sum + (p.amount || 0), 0);
                      const contractValue = agreement.total_price || 0;
                      const isBalanced = Math.abs(contractValue - phasesTotal) < 0.05;
                      const agreementPhaseIds = paymentPhases
                        .filter(p => p.agreement_id === agreement.id)
                        .map(p => p.id);
                      const totalCollected = activePayments
                        .filter(p => p.payment_phase_id && agreementPhaseIds.includes(p.payment_phase_id) && p.payment_status === "Received")
                        .reduce((sum, p) => sum + (p.payment_amount || 0), 0);
                      
                      return (
                      <TableRow 
                        key={agreement.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${!isBalanced ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                        onClick={() => {
                          setSelectedAgreementFilter(agreement.id);
                          setActiveSubTab("phases");
                        }}
                      >
                        <TableCell className="text-xs text-center font-medium text-primary underline">{agreement.agreement_number || "-"}</TableCell>
                        <TableCell className="text-xs">{agreement.agreement_type || "-"}</TableCell>
                        <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                          <InlineNicknameEdit
                            value={agreement.nickname || ""}
                            agreementId={agreement.id}
                            companyId={companyId}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-center">{formatDate(agreement.agreement_signed_date)}</TableCell>
                        <TableCell className="text-xs text-center">{formatCurrencyWithDecimals(agreement.total_price)}</TableCell>
                        <TableCell className={`text-xs text-center ${isBalanced ? 'text-emerald-600' : phasesTotal > contractValue ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatCurrencyWithDecimals(phasesTotal)}
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium">
                          {formatCurrencyWithDecimals(totalCollected)}
                        </TableCell>
                        <TableCell className={`text-xs text-center font-medium ${(contractValue - totalCollected) > 0 ? 'text-amber-600' : ''}`}>
                          {formatCurrencyWithDecimals(contractValue - totalCollected)}
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingAgreement(agreement); setAgreementDialogOpen(true); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("agreement", agreement.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

        {/* Progress Payments Tab */}
        <TabsContent value="phases" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Progress Payments</CardTitle>
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
                <p className="text-sm text-muted-foreground text-center py-4">No contracts yet. Add a contract first to create progress payments.</p>
              ) : (
                <div className="space-y-6">
                  {/* Unlinked/orphan phases warning */}
                  {(() => {
                    const orphanPhases = paymentPhases.filter(p => !p.agreement_id);
                    if (orphanPhases.length === 0) return null;
                    return (
                      <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            {orphanPhases.length} Unlinked Phase{orphanPhases.length > 1 ? 's' : ''} Found
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          These phases are not linked to any contract. They may have been created from a failed signing flow. You can delete them below.
                        </p>
                        <div className="space-y-1">
                          {orphanPhases.map(phase => (
                            <div key={phase.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50">
                              <span>{phase.phase_name} — ${(phase.amount || 0).toLocaleString()}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive hover:text-destructive" 
                                onClick={() => handleDeleteClick("phase", phase.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
                                    Contract Total: {formatCurrency(contractTotal)} • {agreementPhases.length} progress payment{agreementPhases.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              {agreement.attachment_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAttachment({ url: agreement.attachment_url!, name: agreement.agreement_number ? `Agreement #${agreement.agreement_number}` : (agreement.agreement_type || "Agreement") });
                                    setPdfViewerOpen(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                  Preview Contract
                                </Button>
                              )}
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
                                  <Badge variant="outline" className={`text-xs font-bold ${balance > 0 ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                                    {balance > 0 ? `⚠ Warning! Missing: ${formatCurrency(balance)}` : `⚠ Warning! Over: ${formatCurrency(Math.abs(balance))}`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          {/* Progress Payments Table - Collapsible Content */}
                          <CollapsibleContent>
                            {agreementPhases.length === 0 ? (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground">No progress payments for this contract</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => { setEditingPhase(null); setPhaseDialogOpen(true); }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Progress Payment
                                </Button>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs w-8"></TableHead>
                                    <TableHead className="text-xs text-left">Progress Payment</TableHead>
                                    <TableHead className="text-xs text-left">Due Date</TableHead>
                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                    <TableHead className="text-xs text-left">Status</TableHead>
                                    <TableHead className="text-xs w-20"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {agreementPhases.map((phase, phaseIndex) => {
                                    const invoiceStatus = getPhaseInvoiceStatus(phase.id);
                                    const paymentStatus = getPhasePaymentStatus(phase.id);
                                    const phaseAmount = phase.amount || 0;
                                    const isFullyInvoiced = invoiceStatus.totalInvoiced >= phaseAmount;
                                    const isFullyPaid = paymentStatus.totalReceived >= phaseAmount;
                                    const isDragging = draggedPhaseId === phase.id;
                                    const isDragOver = dragOverPhaseId === phase.id;
                                    
                                    return (
                                      <TableRow 
                                        key={phase.id}
                                        draggable
                                        onDragStart={(e) => {
                                          setDraggedPhaseId(phase.id);
                                          e.dataTransfer.effectAllowed = "move";
                                          e.dataTransfer.setData("text/plain", phase.id);
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          if (phase.id !== draggedPhaseId) {
                                            setDragOverPhaseId(phase.id);
                                          }
                                        }}
                                        onDragLeave={() => setDragOverPhaseId(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (draggedPhaseId && draggedPhaseId !== phase.id) {
                                            // Reorder phases within this agreement
                                            const draggedIndex = agreementPhases.findIndex(p => p.id === draggedPhaseId);
                                            const targetIndex = phaseIndex;
                                            if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
                                              const newOrder = [...agreementPhases];
                                              const [draggedItem] = newOrder.splice(draggedIndex, 1);
                                              newOrder.splice(targetIndex, 0, draggedItem);
                                              
                                              // Update display_order for all phases in this agreement
                                              const updates = newOrder.map((p, idx) => ({
                                                id: p.id,
                                                display_order: idx + 1,
                                              }));
                                              reorderPhasesMutation.mutate({ phases: updates });
                                            }
                                          }
                                          setDraggedPhaseId(null);
                                          setDragOverPhaseId(null);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedPhaseId(null);
                                          setDragOverPhaseId(null);
                                        }}
                                        className={cn(
                                          "transition-all",
                                          isDragging && "opacity-50",
                                          isDragOver && "ring-2 ring-primary ring-inset bg-primary/5"
                                        )}
                                      >
                                        <TableCell className="text-xs w-8 cursor-grab active:cursor-grabbing">
                                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        </TableCell>
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
                                            {(isFullyPaid || paymentStatus.totalReceived > 0 || invoiceStatus.totalInvoiced > 0) && (
                                            <Badge 
                                              variant="outline" 
                                              className={isFullyPaid ? "bg-emerald-500/10 text-emerald-500" : paymentStatus.totalReceived > 0 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"}
                                            >
                                              {isFullyPaid 
                                                ? `Paid${paymentStatus.latestPaymentDate ? ` ${new Date(paymentStatus.latestPaymentDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}` : ''}` 
                                                : paymentStatus.totalReceived > 0 
                                                  ? `Paid: ${formatCurrency(paymentStatus.totalReceived)}${paymentStatus.latestPaymentDate ? ` (${new Date(paymentStatus.latestPaymentDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })})` : ''}` 
                                                  : "Unpaid"}
                                            </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreVertical className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              {!isFullyInvoiced && (
                                                <DropdownMenuItem onClick={() => { 
                                                  const remainingAmount = (phase.amount || 0) - invoiceStatus.totalInvoiced;
                                                  setInvoiceConfirmPhase({
                                                    id: phase.id,
                                                    name: phase.phase_name,
                                                    agreementId: phase.agreement_id,
                                                    maxAmount: remainingAmount,
                                                  });
                                                  setInvoiceConfirmOpen(true); 
                                                }}>
                                                  <FileText className="h-4 w-4 mr-2" />
                                                  Invoice This Phase
                                                </DropdownMenuItem>
                                              )}
                                              {(() => {
                                                const unpaidInvoices = invoices
                                                  .filter(inv => inv.payment_phase_id === phase.id)
                                                  .map(inv => ({
                                                    ...inv,
                                                    open_balance: (inv.amount || 0) - (inv.payments_received || 0),
                                                  }))
                                                  .filter(inv => inv.open_balance > 0);
                                                if (unpaidInvoices.length === 0) return null;
                                                return (
                                                  <DropdownMenuItem onClick={() => { 
                                                    if (unpaidInvoices.length === 1) {
                                                      setEditingPayment(null);
                                                      setPrePopulatedPayment({
                                                        invoice_id: unpaidInvoices[0].id,
                                                        payment_amount: unpaidInvoices[0].open_balance || 0,
                                                      });
                                                      setPaymentDialogOpen(true);
                                                    } else {
                                                      setInvoiceSelectForPayment(unpaidInvoices);
                                                    }
                                                  }}>
                                                    <DollarSign className="h-4 w-4 mr-2" />
                                                    Record Payment
                                                  </DropdownMenuItem>
                                                );
                                              })()}
                                              <DropdownMenuItem onClick={() => { setEditingPhase(phase); setPhaseDialogOpen(true); }}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                              </DropdownMenuItem>
                                              {(() => {
                                                const phasePayments = activePayments.filter(p => p.payment_phase_id === phase.id);
                                                const hasPayments = phasePayments.length > 0;
                                                const paymentTotal = phasePayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
                                                return !hasPayments ? (
                                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick("phase", phase.id)}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                ) : (
                                                  <DropdownMenuItem disabled className="text-muted-foreground opacity-50">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Cannot delete ({formatCurrency(paymentTotal)} paid)
                                                  </DropdownMenuItem>
                                                );
                                              })()}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
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
          <ErrorBoundary context="CommissionTab">
            <CommissionTab
              projectId={projectId}
              totalContracts={totalAgreementsValue}
              leadCostPercent={leadCostPercent}
              commissionSplitPct={commissionSplitPct}
              totalBillsPaid={totalBillsPaid}
              totalPaymentsReceived={totalPaymentsReceived}
              totalRefunds={totalRefunds}
              salespeople={salespeople}
              projectName={projectName}
              projectAddress={projectAddress}
              isCancelled={projectStatus === "Cancelled"}
            />
          </ErrorBoundary>
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

      {/* Invoice PDF Preview Dialog */}
      <InvoicePdfDialog
        open={invoicePdfDialogOpen}
        onOpenChange={(open) => {
          setInvoicePdfDialogOpen(open);
          if (!open) setInvoicePdfOnSave(undefined);
        }}
        invoice={invoicePdfData}
        project={{
          project_name: projectName,
          customer_first_name: customerName?.split(' ')[0] || null,
          customer_last_name: customerName?.split(' ').slice(1).join(' ') || null,
          project_address: projectAddress,
        }}
        paymentRecords={
          invoicePdfData?.invoice_id
            ? payments
                .filter(p => p.invoice_id === invoicePdfData.invoice_id && p.payment_status === "Received" && !p.is_voided)
                .map(p => ({
                  id: p.id,
                  payment_amount: p.payment_amount,
                  projected_received_date: p.projected_received_date,
                  payment_method: p.payment_method,
                }))
            : []
        }
        onSave={invoicePdfOnSave}
      />

      {/* Invoice Confirm Dialog (badge click flow) */}
      <InvoiceConfirmDialog
        open={invoiceConfirmOpen}
        onOpenChange={setInvoiceConfirmOpen}
        phaseName={invoiceConfirmPhase?.name || ""}
        maxAmount={invoiceConfirmPhase?.maxAmount || 0}
        onConfirm={handleInvoiceConfirm}
      />

      {/* Invoice Selection for Payment (multi-invoice phase) */}
      <Dialog open={!!invoiceSelectForPayment} onOpenChange={(open) => { if (!open) setInvoiceSelectForPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Which invoice was paid?</DialogTitle>
            <DialogDescription>This progress payment has multiple invoices. Select the one to record payment against.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {invoiceSelectForPayment?.map(inv => (
              <Button
                key={inv.id}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => {
                  setInvoiceSelectForPayment(null);
                  setEditingPayment(null);
                  setPrePopulatedPayment({
                    invoice_id: inv.id,
                    payment_amount: inv.open_balance || 0,
                  });
                  setPaymentDialogOpen(true);
                }}
              >
                <div className="text-left">
                  <div className="font-medium">Invoice #{inv.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">
                    Amount: {formatCurrency(inv.amount)} · Balance: {formatCurrency(inv.open_balance || 0)}
                  </div>
                </div>
                <DollarSign className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Refund Dialog */}
      <RefundDialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          setRefundDialogOpen(open);
          if (!open) setEditingRefund(null);
        }}
        refund={editingRefund}
        onSave={(data) => saveRefundMutation.mutate(data)}
        isPending={saveRefundMutation.isPending}
      />

      {/* Void Refund Dialog */}
      <AlertDialog open={voidRefundDialogOpen} onOpenChange={(open) => { setVoidRefundDialogOpen(open); if (!open) { setVoidingRefund(null); setVoidRefundReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Void Refund
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The refund of {formatCurrency(voidingRefund?.refund_amount)} will be marked as voided and excluded from all financial calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="voidRefundReason">Reason for voiding <span className="text-destructive">*</span></Label>
            <Input
              id="voidRefundReason"
              value={voidRefundReason}
              onChange={(e) => setVoidRefundReason(e.target.value)}
              placeholder="Enter reason for voiding this refund..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (voidingRefund && user?.id && voidRefundReason.trim()) {
                  voidRefundMutation.mutate({
                    refundId: voidingRefund.id,
                    reason: voidRefundReason.trim(),
                    userId: user.id
                  });
                }
              }}
              disabled={!voidRefundReason.trim() || voidRefundMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {voidRefundMutation.isPending ? "Voiding..." : "Void Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Refund Dialog (Admin only) */}
      <AlertDialog open={deleteRefundDialogOpen} onOpenChange={(open) => { setDeleteRefundDialogOpen(open); if (!open) setDeletingRefund(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Refund
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the refund of {formatCurrency(deletingRefund?.refund_amount)}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingRefund) {
                  deleteRefundMutation.mutate(deletingRefund.id);
                }
              }}
              disabled={deleteRefundMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRefundMutation.isPending ? "Deleting..." : "Delete Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bill Dialog */}
      <BillDialog
        open={billDialogOpen}
        onOpenChange={setBillDialogOpen}
        bill={editingBill}
        onSave={handleBillSaveWithQbCheck}
        isPending={saveBillMutation.isPending}
        projectId={projectId}
        agreements={agreements}
        allBills={bills}
      />

      {/* Agreement Dialog */}
      <AgreementDialog
        open={agreementDialogOpen}
        onOpenChange={setAgreementDialogOpen}
        agreement={editingAgreement}
        onSave={async (data, options) => {
          const saved = await saveAgreementMutation.mutateAsync({
            agreement: data,
            closeOnSuccess: options?.closeOnSuccess,
          });
          return saved?.id || null;
        }}
        isPending={saveAgreementMutation.isPending}
        projectId={projectId}
        paymentPhases={paymentPhases}
        companyId={companyId}
        onPhasesExtracted={(phases, agreementId) => {
          setExtractedPhases(phases);
          setExtractedPhasesAgreementId(agreementId);
          setExtractedPhasesDialogOpen(true);
        }}
        existingAgreements={agreements}
        preselectedType={preselectedAgreementType}
        onPreselectedTypeConsumed={() => setPreselectedAgreementType(null)}
        customerName={customerName}
        projectAddress={projectAddress}
        projectName={projectName}
      />

      {/* Extracted Phases Review Dialog */}
      <ExtractedPhasesReviewDialog
        open={extractedPhasesDialogOpen}
        onOpenChange={setExtractedPhasesDialogOpen}
        phases={extractedPhases}
        agreementId={extractedPhasesAgreementId}
        agreements={agreements}
        onSave={async (phasesToSave) => {
          try {
            const inserts = phasesToSave.map((p, idx) => ({
              project_id: projectId,
              phase_name: p.phase_name,
              description: p.description || null,
              amount: typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount)) || 0,
              agreement_id: p.agreement_id || extractedPhasesAgreementId || null,
              company_id: companyId,
              display_order: idx + 1,
            }));
            const { error } = await supabase
              .from("project_payment_phases")
              .insert(inserts);
            if (error) throw error;
            toast.success(`${phasesToSave.length} payment phase(s) created`);
            queryClient.invalidateQueries({ queryKey: ["project-payment-phases", projectId] });
            queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
            setExtractedPhasesDialogOpen(false);
            setExtractedPhases([]);
          } catch (err: any) {
            toast.error(err.message || "Failed to save phases");
          }
        }}
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
            <AlertDialogTitle className={(invoicePaymentsToDelete.length > 0 || phasePaymentsToDelete.length > 0 || phaseInvoicesToDelete.length > 0) ? "flex items-center gap-2" : ""}>
              {(invoicePaymentsToDelete.length > 0 || phasePaymentsToDelete.length > 0) && <AlertCircle className="h-5 w-5 text-destructive" />}
              {(phaseInvoicesToDelete.length > 0 && phasePaymentsToDelete.length === 0) && <AlertCircle className="h-5 w-5 text-amber-600" />}
              Delete {deleteTarget?.type === "phase" ? "progress payment" : deleteTarget?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {/* Phase with payments = strict warning */}
                {deleteTarget?.type === "phase" && phasePaymentsToDelete.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-destructive font-bold">
                      ⚠ STRICT WARNING: This progress payment has {phaseInvoicesToDelete.length} invoice{phaseInvoicesToDelete.length > 1 ? 's' : ''} with {phasePaymentsToDelete.length} payment{phasePaymentsToDelete.length > 1 ? 's' : ''} recorded as received, totaling {formatCurrency(phasePaymentsToDelete.reduce((sum, p) => sum + (p.payment_amount || 0), 0))}.
                    </p>
                    <p className="text-sm">The following invoices and payments will be permanently deleted:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {phaseInvoicesToDelete.map(inv => (
                        <li key={inv.id}>
                          <span className="font-medium">Invoice #{inv.invoice_number}</span> — {formatCurrency(inv.amount)}
                          {phasePaymentsToDelete.filter(p => p.invoice_id === inv.id).map(p => (
                            <div key={p.id} className="ml-5 text-destructive">
                              └ Payment: {formatCurrency(p.payment_amount)} ({p.payment_status})
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                    <p className="font-bold text-destructive">This action cannot be undone. All financial records will be lost.</p>
                  </div>
                ) : deleteTarget?.type === "phase" && phaseInvoicesToDelete.length > 0 ? (
                  /* Phase with invoices only = warning */
                  <div className="space-y-2">
                    <p className="text-amber-600 font-medium">
                      Warning: This progress payment has {phaseInvoicesToDelete.length} invoice{phaseInvoicesToDelete.length > 1 ? 's' : ''} that will also be deleted:
                    </p>
                    <ul className="list-disc list-inside text-sm">
                      {phaseInvoicesToDelete.map(inv => (
                        <li key={inv.id}>Invoice #{inv.invoice_number} — {formatCurrency(inv.amount)}</li>
                      ))}
                    </ul>
                    <p className="font-medium">This action cannot be undone.</p>
                  </div>
                ) : invoicePaymentsToDelete.length > 0 ? (
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
                  <p>This action cannot be undone.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteTarget(null);
              setInvoicePaymentsToDelete([]);
              setPhaseInvoicesToDelete([]);
              setPhasePaymentsToDelete([]);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()} 
              className={
                phasePaymentsToDelete.length > 0 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : (invoicePaymentsToDelete.length > 0 || phaseInvoicesToDelete.length > 0) 
                    ? "bg-amber-600 text-white hover:bg-amber-700" 
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {phasePaymentsToDelete.length > 0 
                ? "Delete Phase, Invoices & Payments" 
                : phaseInvoicesToDelete.length > 0 
                  ? "Delete Phase & Invoices"
                  : invoicePaymentsToDelete.length > 0 
                    ? "Delete Invoice & Payments" 
                    : "Delete"}
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
        offsetBills={historyBill ? billOffsets[historyBill.id]?.offsetBills || [] : []}
        projectId={projectId}
        companyId={companyId}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        isQBConnected={isQBConnectedMain}
        onSyncPayment={async (paymentId, paymentDetails) => {
          if (paymentDetails) {
            const billForVendor = bills.find(b => b.id === historyBill?.id);
            const result = await checkQbDuplicatesAndSync("bill_payment", paymentId, {
              amount: paymentDetails.amount,
              date: paymentDetails.date,
              reference: paymentDetails.reference,
              vendorName: billForVendor?.installer_company || null,
              paymentMethod: paymentDetails.paymentMethod,
            });
            return { synced: result.synced };
          }
          const result = await syncRecordToQuickBooks("bill_payment", paymentId);
          return { synced: result.synced };
        }}
      />

      {/* Credit Offset Details Dialog */}
      <Dialog open={!!offsetDetailsBill} onOpenChange={(open) => { if (!open) setOffsetDetailsBill(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Credit Offsets Applied</DialogTitle>
            {offsetDetailsBill && (
              <p className="text-sm text-muted-foreground">
                {offsetDetailsBill.bill.installer_company} — {offsetDetailsBill.bill.bill_ref || "No ref"}
              </p>
            )}
          </DialogHeader>
          {offsetDetailsBill && (
            <div className="space-y-3">
              {offsetDetailsBill.bill.original_bill_amount != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Amount</span>
                  <span className="font-medium">{formatCurrency(offsetDetailsBill.bill.original_bill_amount)}</span>
                </div>
              )}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Credit From</TableHead>
                      <TableHead className="text-xs">Ref</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offsetDetailsBill.offsets.offsetBills.map((ob) => (
                      <TableRow key={ob.id}>
                        <TableCell className="text-xs">{ob.installer_company || "-"}</TableCell>
                        <TableCell className="text-xs">{ob.bill_ref || "-"}</TableCell>
                        <TableCell className="text-xs text-right font-medium text-amber-600">
                          -{formatCurrency(ob.bill_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t">
                <span className="text-muted-foreground">Total Credits</span>
                <span className="font-medium text-amber-600">-{formatCurrency(offsetDetailsBill.offsets.totalOffset)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Bill Amount</span>
                <span className="font-semibold">{formatCurrency(offsetDetailsBill.bill.bill_amount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QB Duplicate Review Dialog */}
      {qbDuplicateState && (
        <QBDuplicateReviewDialog
          open={qbDuplicateDialogOpen}
          onOpenChange={(open) => {
            setQbDuplicateDialogOpen(open);
            if (!open) qbDuplicateState.onCancel();
          }}
          duplicates={qbDuplicateState.duplicates}
          recordType={qbDuplicateState.recordType}
          localAmount={qbDuplicateState.localAmount}
          localDate={qbDuplicateState.localDate}
          localReference={qbDuplicateState.localReference}
          onLink={qbDuplicateState.onLink}
          onCreateNew={qbDuplicateState.onCreateNew}
          onCancel={qbDuplicateState.onCancel}
          isLinking={qbDuplicateLinking}
        />
      )}

      {/* QB Customer Mapping Dialog (shown before creating a new customer in QB) */}
      {qbCustomerMappingContext && (
        <QBCustomerMappingDialog
          open={qbCustomerMappingOpen}
          onOpenChange={(open) => {
            if (!open) {
              qbCustomerMappingContext.onCancel();
            }
          }}
          projectId={projectId}
          projectName={projectName || ""}
          customerName={qbCustomerMappingContext.customerName}
          projectAddress={projectAddress || null}
          skipLabel="Create New in QB"
          onMapped={() => {
            qbCustomerMappingContext.onMapped();
          }}
          onSkipSync={() => {
            // "Skip" means create new customer in QB (don't map to existing)
            qbCustomerMappingContext.onCreateNew();
          }}
          onCancel={() => {
            qbCustomerMappingContext.onCancel();
          }}
        />
      )}

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

      {/* PDF viewer is now inline split-panel, not a dialog */}

      {/* QuickBooks New Entity Confirmation Dialog */}
      <AlertDialog open={qbConfirmDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Handle cancel for both pending sync and pending bill save
          if (pendingQbSync) {
            pendingQbSync.onCancel();
          }
          if (pendingBillSave) {
            setPendingBillSave(null);
          }
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New QuickBooks Entry?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {/* Show entities from pendingBillSave or pendingQbSync */}
                {(pendingBillSave?.pendingEntities || pendingQbSync?.pendingEntities)?.map((entity, idx) => (
                  <span key={idx} className="block">
                    {entity.type === "customer" 
                      ? `Customer "${entity.name}" does not exist in QuickBooks and will be created.`
                      : `Vendor "${entity.name}" does not exist in QuickBooks and will be created.`
                    }
                  </span>
                ))}
                <span className="block mt-2">Do you want to proceed?</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                // Cancel - discard pending data, don't save
                if (pendingBillSave) {
                  setPendingBillSave(null);
                }
                if (pendingQbSync) {
                  pendingQbSync.onCancel();
                }
                setQbConfirmDialogOpen(false);
              }}>
                Cancel
              </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              // Confirm - proceed with save (guard against double-click)
              if (pendingBillSave && !saveBillMutation.isPending) {
                saveBillMutation.mutate(pendingBillSave.bill);
                setPendingBillSave(null);
                setQbConfirmDialogOpen(false);
              } else if (pendingQbSync) {
                pendingQbSync.onConfirm();
              }
            }}>
              Create & Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // If PDF viewer is open, render split-panel layout
  if (pdfViewerOpen && selectedAttachment) {
    return (
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-8rem)] min-h-[400px]">
        <ResizablePanel defaultSize={45} minSize={25} maxSize={65}>
          <div className="h-full flex flex-col border-r">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{selectedAttachment.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(selectedAttachment.url, "_blank")}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setPdfViewerOpen(false);
                    setSelectedAttachment(null);
                  }}
                  title="Close preview"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={`${selectedAttachment.url}#toolbar=0&navpanes=0`}
                className="w-full h-full border-0 bg-white"
                title={selectedAttachment.name}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={35}>
          <div className="h-full overflow-auto p-4">
            {financeContent}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return financeContent;
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
  const getInitialFormData = () => {
    if (invoice) {
      let agreementId = invoice.agreement_id || "";
      if (!agreementId && invoice.payment_phase_id) {
        const phase = paymentPhases.find(p => p.id === invoice.payment_phase_id);
        if (phase) agreementId = phase.agreement_id || "";
      }
      return {
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        amount: invoice.amount?.toString() || "",
        agreement_id: agreementId,
        payment_phase_id: invoice.payment_phase_id || "",
      };
    }
    return {
      invoice_number: "",
      invoice_date: "",
      amount: "",
      agreement_id: "",
      payment_phase_id: "",
    };
  };

  const initialFormData = getInitialFormData();
  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "invoice-dialog",
    initialFormData,
    invoice?.id || "new",
    open
  );
  const [amountError, setAmountError] = useState("");
  const [phaseError, setPhaseError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { companyId: dialogCompanyId } = useCompanyContext();

  // Query to get the next invoice number for new invoices
  const { data: nextInvoiceNumber } = useQuery({
    queryKey: ["next-invoice-number", dialogCompanyId],
    queryFn: async () => {
      if (!dialogCompanyId) return "1001";
      
      // Get invoice numbers for this company
      const { data } = await supabase
        .from("project_invoices")
        .select("invoice_number")
        .eq("company_id", dialogCompanyId)
        .not("invoice_number", "is", null);
      
      if (!data || data.length === 0) return "1001";
      
      // Find the highest numeric invoice number
      let maxNumber = 1000;
      for (const inv of data) {
        const numMatch = inv.invoice_number?.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (num > maxNumber) maxNumber = num;
        }
      }
      
      return (maxNumber + 1).toString();
    },
    enabled: open && !invoice && !!dialogCompanyId,
    staleTime: 0, // Always fetch fresh
  });

  // Auto-fill invoice number for new invoices when nextInvoiceNumber loads
  useEffect(() => {
    if (open && !invoice && !prePopulatedData && nextInvoiceNumber && !formData.invoice_number) {
      updateFormData({ invoice_number: nextInvoiceNumber, invoice_date: formData.invoice_date || new Date().toISOString().split('T')[0] });
    }
  }, [open, invoice, prePopulatedData, nextInvoiceNumber]);

  // Reset form when invoice identity changes (not on every open — draft handles persistence)
  const lastInvoiceIdRef = useRef<string | null | undefined>(undefined);
  const prePopulatedKey = prePopulatedData ? JSON.stringify(prePopulatedData) : null;
  
  useEffect(() => {
    if (!open) {
      lastInvoiceIdRef.current = undefined;
      return;
    }
    const currentId = invoice?.id ?? (prePopulatedKey ?? null);
    if (lastInvoiceIdRef.current === currentId) return;
    lastInvoiceIdRef.current = currentId;
    
    if (invoice) {
      let agreementId = invoice.agreement_id || "";
      if (!agreementId && invoice.payment_phase_id) {
        const phase = paymentPhases.find(p => p.id === invoice.payment_phase_id);
        if (phase) agreementId = phase.agreement_id || "";
      }
      clearDraft();
      setFormData({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        amount: invoice.amount?.toString() || "",
        agreement_id: agreementId,
        payment_phase_id: invoice.payment_phase_id || "",
      });
    } else if (prePopulatedData) {
      clearDraft();
      setFormData({
        invoice_number: nextInvoiceNumber || "",
        invoice_date: prePopulatedData.invoice_date || new Date().toISOString().split('T')[0],
        amount: prePopulatedData.amount?.toString() || "",
        agreement_id: prePopulatedData.agreement_id || "",
        payment_phase_id: prePopulatedData.payment_phase_id || "",
      });
    }
    // For new invoices, draft will auto-load from sessionStorage — no reset needed
    setAmountError("");
    setPhaseError("");
  }, [open, invoice, prePopulatedKey, paymentPhases, nextInvoiceNumber]);

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
    updateFormData({ agreement_id: value, payment_phase_id: "" });
    setAmountError("");
  };

  const handlePhaseChange = (value: string) => {
    updateFormData({ payment_phase_id: value });
    setAmountError("");
    setPhaseError("");
  };

  const handleAmountChange = (value: string) => {
    updateFormData({ amount: value });
    setAmountError("");
  };

  // Wrap onOpenChange to clear draft when closing
  const handleOpenChange = (value: boolean) => {
    if (!value) clearDraft();
    onOpenChange(value);
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount) || 0;
    const errors: Record<string, string> = {};

    if (!formData.invoice_number.trim()) {
      errors.invoice_number = "Invoice number is required";
    }
    if (!formData.invoice_date) {
      errors.invoice_date = "Invoice date is required";
    }
    if (!formData.agreement_id) {
      errors.agreement_id = "Agreement is required";
    }
    if (!formData.payment_phase_id) {
      errors.payment_phase_id = "Payment phase is required";
    }
    if (!formData.amount || amount <= 0) {
      errors.amount = "Amount is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.payment_phase_id) setPhaseError(errors.payment_phase_id);
      if (errors.amount) setAmountError(errors.amount);
      return;
    }

    setFormErrors({});
    
    // Validate amount doesn't exceed uninvoiced balance for the phase
    if (formData.payment_phase_id && amount > uninvoicedBalance) {
      setAmountError(`Amount cannot exceed uninvoiced balance of ${formatCurrency(uninvoicedBalance)}`);
      return;
    }
    
    onSave({
      invoice_number: formData.invoice_number,
      invoice_date: formData.invoice_date,
      amount,
      total_expected: amount,
      payments_received: paymentsReceivedForInvoice,
      open_balance: amount - paymentsReceivedForInvoice,
      agreement_id: formData.agreement_id,
      payment_phase_id: formData.payment_phase_id,
    });
  };

  const invoiceAmount = parseFloat(formData.amount) || 0;
  const openBalance = invoiceAmount - paymentsReceivedForInvoice;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
          <DialogDescription>Enter invoice details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number <span className="text-destructive">*</span></Label>
              <Input 
                value={formData.invoice_number} 
                onChange={(e) => { updateFormData({ invoice_number: e.target.value }); setFormErrors(prev => ({ ...prev, invoice_number: "" })); }}
                aria-invalid={!!formErrors.invoice_number}
              />
              {formErrors.invoice_number && <p className="text-xs text-destructive mt-1">{formErrors.invoice_number}</p>}
            </div>
            <div>
              <Label>Invoice Date <span className="text-destructive">*</span></Label>
              <Input 
                type="date" 
                value={formData.invoice_date} 
                onChange={(e) => { updateFormData({ invoice_date: e.target.value }); setFormErrors(prev => ({ ...prev, invoice_date: "" })); }}
                aria-invalid={!!formErrors.invoice_date}
              />
              {formErrors.invoice_date && <p className="text-xs text-destructive mt-1">{formErrors.invoice_date}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Agreement <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.agreement_id} 
                onValueChange={(v) => { handleAgreementChange(v); setFormErrors(prev => ({ ...prev, agreement_id: "" })); }}
                disabled={!!prePopulatedData}
              >
                <SelectTrigger className={prePopulatedData ? "opacity-70" : ""} aria-invalid={!!formErrors.agreement_id}>
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
              {formErrors.agreement_id && <p className="text-xs text-destructive mt-1">{formErrors.agreement_id}</p>}
            </div>
            <div>
              <Label>Payment Phase <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.payment_phase_id} 
                onValueChange={(v) => { handlePhaseChange(v); setFormErrors(prev => ({ ...prev, payment_phase_id: "" })); setPhaseError(""); }}
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
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
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
  const { isAdmin: isAdminUser, isSuperAdmin: isSuperAdminUser } = useAuth();
  const canAddBank = isAdminUser || isSuperAdminUser;
  const initialFormData = {
    bank_id: "",
    projected_received_date: "",
    payment_schedule: "",
    payment_status: "Received",
    payment_amount: "",
    payment_fee: "",
    check_number: "",
    payment_method: "",
    invoice_id: "",
    deposit_verified: false,
  };
  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "payment-dialog",
    initialFormData,
    payment?.id || "new",
    open
  );
  const [amountError, setAmountError] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  // Fetch existing banks with id and name from banks table scoped by company
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks-with-id", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.filter((b): b is { id: string; name: string } => typeof b.name === 'string');
    },
    enabled: open && !!companyId,
  });

  const queryClient = useQueryClient();

  // Mutation to add new bank scoped by company
  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { data, error } = await supabase
        .from("banks")
        .insert({ name: bankName, company_id: companyId })
        .select("id")
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
      return data?.id;
    },
    onSuccess: (newBankId) => {
      queryClient.invalidateQueries({ queryKey: ["banks-with-id", companyId] });
      if (newBankId) {
        updateFormData({ bank_id: newBankId });
      }
    },
  });

  const handleAddBank = (bankName: string) => {
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank => 
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const selectedBank = existingBanks.find(b => b.id === formData.bank_id);

  // Reset form when payment identity changes (not on every open — draft handles persistence)
  const lastPaymentIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      lastPaymentIdRef.current = undefined;
      return;
    }
    const currentId = payment?.id ?? (prePopulatedData ? JSON.stringify(prePopulatedData) : null);
    if (lastPaymentIdRef.current === currentId) return;
    lastPaymentIdRef.current = currentId;

    if (payment) {
      clearDraft();
      setFormData({
        bank_id: payment.bank_id || "",
        projected_received_date: payment.projected_received_date || "",
        payment_schedule: payment.payment_schedule || "",
        payment_status: payment.payment_status || "Pending",
        payment_amount: payment.payment_amount?.toString() || "",
        payment_fee: payment.payment_fee?.toString() || "",
        check_number: payment.check_number || "",
        payment_method: payment.payment_method || "",
        invoice_id: payment.invoice_id || "",
        deposit_verified: payment.deposit_verified ?? false,
      });
    } else if (prePopulatedData) {
      clearDraft();
      setFormData({
        bank_id: "",
        projected_received_date: new Date().toISOString().split('T')[0],
        payment_schedule: "",
        payment_status: "Received",
        payment_amount: prePopulatedData.payment_amount?.toString() || "",
        payment_fee: "",
        check_number: "",
        payment_method: "",
        invoice_id: prePopulatedData.invoice_id || "",
        deposit_verified: false,
      });
    }
    // For new payments, draft will auto-load from sessionStorage — no reset needed
    setAmountError("");
    setBankSearch("");
  }, [open, payment, prePopulatedData]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) clearDraft();
    onOpenChange(newOpen);
  };

  // Get selected invoice to validate amount and get phase
  const selectedInvoice = invoices.find(i => i.id === formData.invoice_id);
  
  // When editing an existing payment, add back the original payment amount to the available balance
  // since the current open_balance already has this payment deducted
  const originalPaymentAmount = payment?.invoice_id === formData.invoice_id ? (payment?.payment_amount || 0) : 0;
  const computedOpenBalance = selectedInvoice ? (selectedInvoice.amount || 0) - (selectedInvoice.payments_received || 0) : 0;
  const maxAmount = computedOpenBalance + originalPaymentAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const rawAmount = formData.payment_amount.replace(/[^0-9.]/g, '');
    const amount = parseFloat(rawAmount) || 0;
    
    if (!formData.bank_id || !formData.projected_received_date || amount <= 0) {
      if (amount <= 0) setAmountError("Amount is required");
      return;
    }
    
    // Validate amount doesn't exceed invoice balance (accounting for original payment when editing)
    if (formData.invoice_id && amount > maxAmount) {
      setAmountError(`Amount cannot exceed invoice balance of ${formatCurrency(maxAmount)}`);
      return;
    }
    
    // Get payment phase from selected invoice
    const paymentPhaseId = selectedInvoice?.payment_phase_id || null;
    
    // Get bank name for backwards compatibility
    const bankName = existingBanks.find(b => b.id === formData.bank_id)?.name || null;
    
    onSave({
      bank_name: bankName,
      bank_id: formData.bank_id || null,
      projected_received_date: formData.projected_received_date || null,
      payment_schedule: formData.payment_schedule || null,
      payment_status: formData.payment_status,
      payment_amount: amount,
      payment_fee: parseFloat(formData.payment_fee) || 0,
      check_number: (formData.payment_method === "Zelle/ACH" || formData.payment_method === "Wire") ? null : (formData.check_number || null),
      payment_method: formData.payment_method || null,
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
                    className={cn("w-full justify-between font-normal", !formData.bank_id && "border-destructive")}
                  >
                    {selectedBank?.name || "Select or add..."}
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
                        {canAddBank && bankSearch && !filteredBanks.some(b => b.name.toLowerCase() === bankSearch.toLowerCase()) && (
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
                            key={bank.id}
                            value={bank.name}
                            onSelect={() => {
                              updateFormData({ bank_id: bank.id });
                              setBankOpen(false);
                              setBankSearch("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.bank_id === bank.id ? "opacity-100" : "opacity-0")} />
                            {bank.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!formData.bank_id && (
                <p className="text-xs text-destructive mt-1">Bank account is required</p>
              )}
            </div>
            <div>
              <Label>Date Received <span className="text-destructive">*</span></Label>
              <Input 
                type="date" 
                value={formData.projected_received_date} 
                onChange={(e) => updateFormData({ projected_received_date: e.target.value })} 
                className={cn(!formData.projected_received_date && "border-destructive")}
              />
              {!formData.projected_received_date && (
                <p className="text-xs text-destructive mt-1">Date is required</p>
              )}
            </div>
          </div>
          <div>
            <Label>Invoice</Label>
            <Select value={formData.invoice_id} onValueChange={(v) => { updateFormData({ invoice_id: v }); setAmountError(""); }}>
              <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} - Balance: {formatCurrency2((inv.amount || 0) - (inv.payments_received || 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
              <Input 
                type="text"
                inputMode="decimal"
                value={formData.payment_amount} 
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                  if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                    updateFormData({ payment_amount: raw });
                    setAmountError("");
                  }
                }}
                onBlur={() => {
                  const raw = formData.payment_amount.replace(/[^0-9.]/g, '');
                  const num = parseFloat(raw);
                  if (!isNaN(num) && num > 0) {
                    updateFormData({ payment_amount: num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
                  }
                }}
                onFocus={() => {
                  const raw = formData.payment_amount.replace(/[^0-9.]/g, '');
                  updateFormData({ payment_amount: raw });
                }}
                className={!formData.payment_amount ? "border-destructive" : ""}
              />
              {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              {selectedInvoice && <p className="text-xs text-muted-foreground mt-1">Max: {formatCurrency2(maxAmount)}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.payment_status} onValueChange={(v) => updateFormData({ payment_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
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
              <Input type="text" inputMode="decimal" value={formData.payment_fee} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updateFormData({ payment_fee: val }); }} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={formData.payment_method} onValueChange={(v) => updateFormData({ payment_method: v, ...(v === "Zelle/ACH" || v === "Wire" ? { check_number: "" } : {}) })}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Zelle/ACH">Zelle/ACH</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check #</Label>
              <Input 
                value={formData.check_number} 
                onChange={(e) => updateFormData({ check_number: e.target.value })} 
                disabled={formData.payment_method === "Zelle/ACH" || formData.payment_method === "Wire"}
                placeholder={formData.payment_method === "Zelle/ACH" || formData.payment_method === "Wire" ? "N/A" : ""}
              />
            </div>
            <div />
          </div>
          {formData.payment_status === "Received" && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="deposit_verified" 
                checked={formData.deposit_verified} 
                onCheckedChange={(checked) => updateFormData({ deposit_verified: !!checked })} 
              />
              <Label htmlFor="deposit_verified" className="text-sm font-normal cursor-pointer">
                Deposit Verified
              </Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !formData.bank_id}>{isPending ? "Saving..." : "Save"}</Button>
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
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (data: Partial<Bill>) => void;
  isPending: boolean;
  projectId: string;
  agreements: Agreement[];
  allBills: Bill[];
}) {
  const initialFormData = {
    installer_company: "",
    category: "",
    bill_ref: "",
    bill_amount: "",
    memo: "",
    attachment_url: null as string | null,
    agreement_id: "",
    offset_bill_id: "",
  };

  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "bill-dialog",
    initialFormData,
    bill?.id || projectId,
    open
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [vendorMappingDialogOpen, setVendorMappingDialogOpen] = useState(false);
  const [quickAddSubOpen, setQuickAddSubOpen] = useState(false);
  const [pendingBillData, setPendingBillData] = useState<Partial<Bill> | null>(null);
  const [showOffsetConfirm, setShowOffsetConfirm] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Partial<Bill> | null>(null);

  // Predefined categories
  const predefinedCategories = ["Materials", "Labor", "Permits", "Equipment", "Subcontractor"];

  // Any bill can be applied as an offset/credit against another bill
  const isOffsetEligible = true;

  // Get bills for the selected agreement that can be offset (any bill from a different vendor)
  const billsForOffset = useMemo(() => {
    if (!formData.agreement_id) return [];
    return allBills.filter(b => 
      b.agreement_id === formData.agreement_id && 
      b.installer_company && // Must have a vendor name
      !b.is_voided &&
      b.id !== bill?.id && // Can't offset itself
      // Never show if the new bill's vendor is the same as the target
      (!formData.installer_company || b.installer_company !== formData.installer_company)
    );
  }, [allBills, formData.agreement_id, bill?.id, formData.installer_company]);

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

  // Check if QuickBooks is connected
  const { data: qbConnection } = useQuery({
    queryKey: ["qb-connection-status", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("id, is_active, realm_id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
    staleTime: 60000,
  });

  const isQBConnected = !!qbConnection?.is_active;

  // Fetch vendor mappings
  const { data: vendorMappings = [] } = useQuery({
    queryKey: ["qb-vendor-mappings", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("quickbooks_mappings")
        .select("source_value, qbo_id, qbo_name")
        .eq("company_id", companyId)
        .eq("mapping_type", "vendor");
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId && isQBConnected,
    staleTime: 30000,
  });

  // Reset form when dialog opens with a bill to edit (not on every open — draft handles persistence)
  const lastBillIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      lastBillIdRef.current = undefined;
      return;
    }
    // Only reset if bill identity changed (new open or different bill)
    const currentBillId = bill?.id ?? null;
    if (lastBillIdRef.current === currentBillId) return;
    lastBillIdRef.current = currentBillId;

    if (bill) {
      clearDraft();
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
    }
    // For new bills, draft will auto-load from sessionStorage — no reset needed
  }, [open, bill]);

  // Clear offset_bill_id when agreement changes and target bill no longer valid
  useEffect(() => {
    if (formData.offset_bill_id && !billsForOffset.find(b => b.id === formData.offset_bill_id)) {
      updateFormData({ offset_bill_id: "" });
    }
  }, [billsForOffset, formData.offset_bill_id]);

  const billAmount = parseFloat(formData.bill_amount) || 0;

  // Find the selected subcontractor's ID for mapping check
  const selectedSubcontractor = activeSubcontractors.find(
    s => s.company_name === formData.installer_company
  );

  // Check if vendor is already mapped
  const vendorIsMapped = selectedSubcontractor 
    ? vendorMappings.some(m => m.source_value === selectedSubcontractor.id)
    : true; // If no subcontractor selected, skip the check

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const billData: Partial<Bill> = {
      installer_company: formData.installer_company || null,
      category: formData.category || null,
      bill_ref: formData.bill_ref || null,
      bill_amount: billAmount,
      memo: formData.memo || null,
      attachment_url: formData.attachment_url,
      agreement_id: formData.agreement_id || null,
      offset_bill_id: formData.offset_bill_id || null,
    };

    // If QB is connected and vendor is not mapped, show mapping dialog
    if (isQBConnected && selectedSubcontractor && !vendorIsMapped) {
      setPendingBillData(billData);
      setVendorMappingDialogOpen(true);
      return;
    }

    // If no offset selected and there are bills available to offset, ask the user
    if (!formData.offset_bill_id && billsForOffset.length > 0 && !bill) {
      setPendingSaveData(billData);
      setShowOffsetConfirm(true);
      return;
    }

    onSave(billData);
  };

  // Handle mapping completion - proceed with saving the bill
  const handleMappingComplete = () => {
    setVendorMappingDialogOpen(false);
    if (pendingBillData) {
      onSave(pendingBillData);
      setPendingBillData(null);
    }
  };

  // Wrap onOpenChange to clear draft when dialog closes
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      clearDraft();
    }
    onOpenChange(value);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                    setQuickAddSubOpen(true);
                  } else {
                    updateFormData({ installer_company: value });
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
                    activeSubcontractors.map((sub) => {
                      const isVendorMapped = vendorMappings.some(m => m.source_value === sub.id);
                      return (
                        <SelectItem key={sub.id} value={sub.company_name}>
                          <span className="flex items-center gap-2">
                            {sub.company_name}
                            {isQBConnected && !isVendorMapped && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-amber-600 border-amber-300 bg-amber-50">
                                Not in QB
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })
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
                            updateFormData({ category: categorySearch });
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
                            updateFormData({ category: cat });
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
              <Select value={formData.agreement_id} onValueChange={(v) => updateFormData({ agreement_id: v })}>
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
              <Input type="text" inputMode="decimal" value={formData.bill_amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updateFormData({ bill_amount: val }); }} />
            </div>
            <div>
              <Label>Bill Reference</Label>
              <Input value={formData.bill_ref} onChange={(e) => updateFormData({ bill_ref: e.target.value })} placeholder="Invoice/PO number" />
            </div>
          </div>
          
          {/* Offset/Credit Against Another Bill */}
          {isOffsetEligible && billsForOffset.length > 0 && (
            <div className={`p-4 rounded-lg border-2 ${formData.offset_bill_id ? 'border-primary bg-primary/10' : 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Apply as Credit Against Another Bill</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Is this bill offsetting or reducing the balance on an existing bill? If so, select it below.
              </p>
              <Select 
                value={formData.offset_bill_id} 
                onValueChange={(v) => updateFormData({ offset_bill_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="border-primary/30">
                  <SelectValue placeholder="Select bill to offset..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="__none__">No offset (standalone bill)</SelectItem>
                  {billsForOffset.map((b) => {
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
              onChange={(e) => updateFormData({ memo: e.target.value })} 
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
              onUpload={(url) => updateFormData({ attachment_url: url })}
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

    {/* Vendor Mapping Dialog - shows when trying to save a bill with unmapped vendor */}
    {selectedSubcontractor && (
      <VendorMappingDialog
        open={vendorMappingDialogOpen}
        onOpenChange={(open) => {
          setVendorMappingDialogOpen(open);
          if (!open) setPendingBillData(null);
        }}
        subcontractorId={selectedSubcontractor.id}
        subcontractorName={selectedSubcontractor.company_name}
        onMappingComplete={handleMappingComplete}
      />
    )}

    <QuickAddSubcontractorDialog
      open={quickAddSubOpen}
      onOpenChange={setQuickAddSubOpen}
      onAdded={(companyName) => {
        updateFormData({ installer_company: companyName });
      }}
    />

    {/* Offset Confirmation Dialog */}
    <AlertDialog open={showOffsetConfirm} onOpenChange={setShowOffsetConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Should this bill offset another bill?</AlertDialogTitle>
          <AlertDialogDescription>
            This bill could be applied as a credit to reduce the balance on an existing bill. Would you like to go back and select a bill to offset?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            // "No" - proceed with save
            if (pendingSaveData) {
              onSave(pendingSaveData);
              setPendingSaveData(null);
            }
            setShowOffsetConfirm(false);
          }}>
            No, save as-is
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            // "Yes" - go back to edit the bill (scroll to offset section)
            setPendingSaveData(null);
            setShowOffsetConfirm(false);
          }}>
            Yes, go back and select
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// Inline Nickname Editor
function InlineNicknameEdit({ value, agreementId, companyId }: { value: string; agreementId: string; companyId: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => { setText(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (text === value) return;
    await supabase
      .from("project_agreements")
      .update({ nickname: text || null })
      .eq("id", agreementId);
    queryClient.invalidateQueries({ queryKey: ["project-agreements"] });
  };

  if (!editing) {
    return (
      <span
        className="text-muted-foreground cursor-pointer hover:text-foreground hover:underline truncate max-w-[120px] inline-block"
        onClick={() => setEditing(true)}
        title="Click to edit nickname"
      >
        {value || "—"}
      </span>
    );
  }

  return (
    <Input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setText(value); setEditing(false); } }}
      className="h-6 text-xs px-1 py-0 w-[120px]"
      placeholder="Add nickname"
    />
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
  paymentPhases,
  companyId,
  onPhasesExtracted,
  existingAgreements = [],
  preselectedType,
  onPreselectedTypeConsumed,
  customerName,
  projectAddress,
  projectName,
}: {
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  agreement: Agreement | null;
  onSave: (data: Partial<Agreement>, options?: { closeOnSuccess?: boolean }) => Promise<string | null>;
  isPending: boolean;
  projectId: string;
  paymentPhases: PaymentPhase[];
  companyId: string;
  onPhasesExtracted?: (phases: ExtractedPhase[], agreementId: string | null) => void;
  existingAgreements?: Agreement[];
  preselectedType?: string | null;
  onPreselectedTypeConsumed?: () => void;
  customerName?: string | null;
  projectAddress?: string | null;
  projectName?: string | null;
}) {
  const initialFormData = {
    agreement_number: "",
    agreement_type: "",
    nickname: "",
    agreement_signed_date: "",
    created_at: "",
    total_price: "",
    description_of_work: "",
    attachment_url: null as string | null,
  };
  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "agreement-dialog",
    initialFormData,
    agreement?.id || "new",
    open
  );

  const [isExtracting, setIsExtracting] = useState(false);

  // Proposal workflow state
  const [showProposalForm, setShowProposalForm] = useState(false);
  const proposalTotal = parseFloat(formData.total_price) || 0;
  const [proposalEstimatedCost, setProposalEstimatedCost] = useState<number>(0);
  const [proposalPayments, setProposalPayments] = useState<Array<{ phaseName: string; amount: number }>>([
    { phaseName: "Deposit", amount: 0 },
  ]);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [proposalEstimateId, setProposalEstimateId] = useState<string | null>(null);
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const queryClientAgreement = useQueryClient();

  // Fetch customer email for proposal sending
  const { data: projectCustomerEmail } = useQuery({
    queryKey: ["project-customer-email", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("customer_email")
        .eq("id", projectId)
        .single();
      return data?.customer_email || "";
    },
    enabled: open && showProposalForm,
  });

  const proposalPaymentsTotal = proposalPayments.reduce((s, p) => s + p.amount, 0);
  const proposalPaymentsBalanced = proposalTotal > 0 && Math.abs(proposalPaymentsTotal - proposalTotal) < 0.01;
  const proposalPaymentsDifference = proposalTotal - proposalPaymentsTotal;

  // Required fields validation — disable action buttons until all filled
  const requiredFieldsFilled = !!(
    formData.agreement_type &&
    formData.agreement_signed_date &&
    formData.total_price &&
    parseFloat(formData.total_price) > 0 &&
    formData.description_of_work?.trim()
  );

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

  // Auto-fill agreement number for new agreements when nextAgreementNumber loads
  useEffect(() => {
    if (open && !agreement && nextAgreementNumber && !formData.agreement_number) {
      updateFormData({ agreement_number: nextAgreementNumber });
    }
  }, [open, agreement, nextAgreementNumber]);

  // Reset form when agreement identity changes (not on every open — draft handles persistence)
  const lastAgreementIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      lastAgreementIdRef.current = undefined;
      return;
    }
    const currentId = agreement?.id ?? null;
    if (lastAgreementIdRef.current === currentId) return;
    lastAgreementIdRef.current = currentId;

    if (agreement) {
      clearDraft();
      setFormData({
        agreement_number: agreement.agreement_number || "",
        agreement_type: agreement.agreement_type || "",
        nickname: agreement.nickname || "",
        agreement_signed_date: agreement.agreement_signed_date || "",
        created_at: agreement.created_at ? agreement.created_at.split('T')[0] : "",
        total_price: agreement.total_price?.toString() || "",
        description_of_work: agreement.description_of_work || "",
        attachment_url: agreement.attachment_url || null,
      });
    }
    // For new agreements, draft will auto-load from sessionStorage
  }, [open, agreement]);

  // Determine available agreement types based on existing agreements
  const hasContract = existingAgreements.some(a => a.agreement_type === "Contract");
  const availableTypes = useMemo(() => {
    // When editing, show all types
    if (agreement) return ["Contract", "Change Order", "Addendum"];
    // First agreement must be Contract
    if (!hasContract) return ["Contract"];
    // After contract exists, only Change Order and Addendum
    return ["Change Order", "Addendum"];
  }, [agreement, hasContract]);

  // Apply preselected type or auto-select when only one option available
  useEffect(() => {
    if (!open || agreement) return;
    if (preselectedType && !formData.agreement_type) {
      updateFormData({ agreement_type: preselectedType });
      onPreselectedTypeConsumed?.();
    } else if (availableTypes.length === 1 && !formData.agreement_type) {
      updateFormData({ agreement_type: availableTypes[0] });
    }
  }, [open, agreement, preselectedType, availableTypes]);

  const [dateError, setDateError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.agreement_type) errors.agreement_type = "Type is required";
    if (!formData.agreement_signed_date) errors.agreement_signed_date = "Date signed is required";
    if (!formData.total_price || parseFloat(formData.total_price) <= 0) errors.total_price = "Total value is required";
    if (!formData.description_of_work?.trim()) errors.description_of_work = "Description of work is required";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setDateError("");

    await onSave(
      {
        agreement_number: formData.agreement_number || null,
        agreement_type: formData.agreement_type || null,
        nickname: formData.nickname || null,
        agreement_signed_date: formData.agreement_signed_date || null,
        created_at: formData.created_at ? formData.created_at + 'T00:00:00' : null,
        total_price: parseFloat(formData.total_price) || 0,
        description_of_work: formData.description_of_work || null,
        attachment_url: formData.attachment_url,
      },
      { closeOnSuccess: true }
    );
  };

  const handleExtractPhases = async () => {
    if (!formData.attachment_url) return;

    const isPdf = formData.attachment_url.toLowerCase().includes('.pdf');
    if (!isPdf) {
      toast.error("Phase extraction only works with PDF files");
      return;
    }

    if (!agreement?.id && !formData.agreement_signed_date) {
      setDateError("Date signed is required before AI extraction");
      toast.error("Save the contract date first");
      return;
    }

    setIsExtracting(true);
    try {
      const ensuredAgreementId = agreement?.id || await onSave(
        {
          agreement_number: formData.agreement_number || null,
          agreement_type: formData.agreement_type || null,
          nickname: formData.nickname || null,
          agreement_signed_date: formData.agreement_signed_date || null,
          total_price: parseFloat(formData.total_price) || 0,
          description_of_work: formData.description_of_work || null,
          attachment_url: formData.attachment_url,
        },
        { closeOnSuccess: false }
      );

      if (!ensuredAgreementId) {
        throw new Error("Contract must be saved before extracting phases");
      }

      const { data, error } = await supabase.functions.invoke("extract-contract-phases", {
        body: { pdfUrl: formData.attachment_url },
      });

      if (error) throw error;

      if (!data?.phases || data.phases.length === 0) {
        toast.info(data?.notes || "No payment phases found in this document");
        return;
      }

      toast.success(`Found ${data.phases.length} payment phase(s)`);
      onPhasesExtracted?.(data.phases, ensuredAgreementId);
    } catch (err: any) {
      console.error("Extract phases error:", err);
      toast.error(err.message || "Failed to extract phases from PDF");
    } finally {
      setIsExtracting(false);
    }
  };

  // Create proposal estimate and show preview
  const handleCreateProposal = async () => {
    if (proposalTotal <= 0) { toast.error("Total must be greater than zero"); return; }
    if (proposalPayments.some(p => !p.phaseName.trim())) { toast.error("All progress payments must have a phase name"); return; }
    if (!proposalPaymentsBalanced) { toast.error("Payments must equal the total"); return; }
    if (!formData.description_of_work?.trim()) { toast.error("Description of work is required"); return; }

    setIsCreatingProposal(true);
    try {
      const estimateTitle = `Change Order for ${customerName || projectName || "Customer"}`;

      // Create estimate record
      const { data: estimate, error: estError } = await supabase
        .from("estimates")
        .insert({
          company_id: companyId,
          customer_name: customerName || projectName || "Customer",
          customer_email: projectCustomerEmail || null,
          job_address: projectAddress || "",
          estimate_title: estimateTitle,
          estimate_date: new Date().toISOString().split("T")[0],
          status: "draft",
          work_scope_description: formData.description_of_work?.trim() || "",
          project_id: projectId,
          total: proposalTotal,
          manual_total: proposalTotal,
          subtotal: proposalTotal,
          estimated_cost: proposalEstimatedCost || null,
          show_details_to_customer: false,
          show_scope_to_customer: true,
          show_line_items_to_customer: true,
        } as any)
        .select("id")
        .single();

      if (estError || !estimate) throw estError || new Error("Failed to create estimate");

      // Insert progress payments
      const paymentRows = proposalPayments
        .filter(p => p.phaseName.trim())
        .map((p, idx) => ({
          estimate_id: estimate.id,
          phase_name: p.phaseName.slice(0, 255),
          amount: p.amount,
          percent: proposalTotal > 0 ? Math.round((p.amount / proposalTotal) * 10000) / 100 : 0,
          sort_order: idx,
          company_id: companyId,
        }));

      if (paymentRows.length > 0) {
        await supabase.from("estimate_payment_schedule").insert(paymentRows);
      }

      setProposalEstimateId(estimate.id);
      setShowProposalPreview(true);
      toast.success("Proposal created! Review before sending.");
    } catch (err: any) {
      console.error("Create proposal error:", err);
      toast.error(err.message || "Failed to create proposal");
    } finally {
      setIsCreatingProposal(false);
    }
  };

  // Reset proposal state
  const resetProposalState = () => {
    setShowProposalForm(false);
    // proposalTotal is derived from formData.total_price, no need to reset
    setProposalEstimatedCost(0);
    setProposalPayments([{ phaseName: "Deposit", amount: 0 }]);
    setProposalEstimateId(null);
    setShowProposalPreview(false);
    setShowSendDialog(false);
  };

  // Wrap onOpenChange to clear draft when closing
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      clearDraft();
      setValidationErrors({});
      setDateError("");
      resetProposalState();
    }
    onOpenChange(value);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{agreement ? "Edit Agreement" : "Add Agreement"}</DialogTitle>
          <DialogDescription>Enter agreement/contract details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
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
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={formData.agreement_type} onValueChange={(v) => { updateFormData({ agreement_type: v }); setValidationErrors(prev => ({ ...prev, agreement_type: "" })); }}>
                <SelectTrigger className={validationErrors.agreement_type ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.agreement_type && <p className="text-xs text-destructive mt-1">{validationErrors.agreement_type}</p>}
              {!agreement && !hasContract && (
                <p className="text-xs text-muted-foreground mt-1">First agreement must be a Contract</p>
              )}
            </div>
          </div>
          <div>
            <Label>Nickname</Label>
            <Input 
              value={formData.nickname} 
              onChange={(e) => updateFormData({ nickname: e.target.value })} 
              placeholder="e.g. Kitchen Remodel, Phase 2 Addition"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Date Signed <span className="text-destructive">*</span></Label>
              <Input 
                type="date" 
                value={formData.agreement_signed_date} 
                onChange={(e) => { updateFormData({ agreement_signed_date: e.target.value }); setDateError(""); setValidationErrors(prev => ({ ...prev, agreement_signed_date: "" })); }} 
                className={validationErrors.agreement_signed_date ? "border-destructive" : ""}
              />
              {(dateError || validationErrors.agreement_signed_date) && <p className="text-xs text-destructive mt-1">{dateError || validationErrors.agreement_signed_date}</p>}
            </div>
            {agreement && (
              <div>
                <Label>Created Date</Label>
                <Input 
                  type="date" 
                  value={formData.created_at} 
                  onChange={(e) => updateFormData({ created_at: e.target.value })} 
                />
                <p className="text-xs text-muted-foreground mt-1">Record creation date</p>
              </div>
            )}
            <div>
              <Label>Total Value ($) <span className="text-destructive">*</span></Label>
              <Input 
                type="text" 
                inputMode="decimal" 
                value={formData.total_price} 
                onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { updateFormData({ total_price: val }); setValidationErrors(prev => ({ ...prev, total_price: "" })); } }} 
                className={validationErrors.total_price ? "border-destructive" : ""}
              />
              {validationErrors.total_price && <p className="text-xs text-destructive mt-1">{validationErrors.total_price}</p>}
            </div>
          </div>
          {/* Warning when contract amount doesn't match phases total */}
          {agreement && (() => {
            const phasesTotal = paymentPhases
              .filter(p => p.agreement_id === agreement.id)
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            const newTotal = parseFloat(formData.total_price) || 0;
            if (phasesTotal > 0 && Math.abs(newTotal - phasesTotal) >= 0.01) {
              return (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Progress payments total <strong>${phasesTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> doesn't match the contract amount <strong>${newTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>. Please update the progress payments to match.
                  </span>
                </div>
              );
            }
            return null;
          })()}
          <div>
            <Label>Description of Work <span className="text-destructive">*</span></Label>
            <Input 
              value={formData.description_of_work} 
              onChange={(e) => { updateFormData({ description_of_work: e.target.value }); setValidationErrors(prev => ({ ...prev, description_of_work: "" })); }} 
              placeholder="Scope of work covered" 
              className={validationErrors.description_of_work ? "border-destructive" : ""}
            />
            {validationErrors.description_of_work && <p className="text-xs text-destructive mt-1">{validationErrors.description_of_work}</p>}
          </div>
          <div>
            <Label>Contract Document</Label>
            {!agreement && !formData.attachment_url && !showProposalForm && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground mb-2">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Upload an executed PDF contract and <strong className="text-foreground">AI will automatically generate progress payment phases</strong> from the document — no manual entry needed.
                </span>
              </div>
            )}
            {!showProposalForm && (
              <FileUpload
                projectId={projectId}
                currentUrl={formData.attachment_url}
                onUpload={(url) => updateFormData({ attachment_url: url })}
                folder="agreements"
                label="Upload Executed PDF File"
              />
            )}
          </div>
          {/* Extract Phases from PDF button */}
          {!showProposalForm && formData.attachment_url && formData.attachment_url.toLowerCase().includes('.pdf') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleExtractPhases}
              disabled={isExtracting || isPending || !requiredFieldsFilled}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving contract and extracting phases...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Save Contract & Generate AI Phases
                </>
              )}
            </Button>
          )}

          {/* Send Proposal for Signature - only for Change Order / Addendum */}
          {!agreement && hasContract && formData.agreement_type !== "Contract" && !showProposalForm && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowProposalForm(true)}
                disabled={!requiredFieldsFilled}
              >
                <Send className="h-4 w-4" />
                Send Proposal for Customer Signature
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Create and send a proposal for the customer to review and sign digitally
              </p>
            </div>
          )}

          {/* Proposal Form */}
          {showProposalForm && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Proposal Details</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowProposalForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estimated Costs ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={proposalEstimatedCost || ""}
                    onChange={(e) => setProposalEstimatedCost(parseFloat(e.target.value) || 0)}
                    placeholder="Your estimated cost"
                  />
              </div>

              {/* Progress Payments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Progress Payments <span className="text-destructive">*</span></Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (proposalPayments.length < 10) {
                        setProposalPayments([...proposalPayments, { phaseName: "", amount: 0 }]);
                      }
                    }}
                    disabled={proposalPayments.length >= 10}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {proposalPayments.map((payment, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={payment.phaseName}
                      onChange={(e) => setProposalPayments(prev => prev.map((p, i) => i === idx ? { ...p, phaseName: e.target.value } : p))}
                      placeholder="Phase name"
                      className={`h-8 text-sm flex-1 ${!payment.phaseName.trim() ? 'border-destructive' : ''}`}
                    />
                    <div className="relative w-28">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount || ""}
                        onChange={(e) => setProposalPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                        className={`h-8 text-sm pl-6 ${!payment.amount ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {proposalPayments.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                        onClick={() => setProposalPayments(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payments Total:</span>
                  <span className={proposalPaymentsBalanced ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                    ${proposalPaymentsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {!proposalPaymentsBalanced && proposalTotal > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {proposalPaymentsDifference > 0
                        ? `$${proposalPaymentsDifference.toFixed(2)} remaining to allocate`
                        : `$${Math.abs(proposalPaymentsDifference).toFixed(2)} over the estimate total`}
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleCreateProposal}
                disabled={isCreatingProposal || proposalTotal <= 0 || !proposalPaymentsBalanced || proposalPayments.some(p => !p.phaseName.trim())}
              >
                {isCreatingProposal ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Review & Preview Proposal
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {/* Hide Save button for new contracts when a PDF is uploaded (AI button handles save) or when proposal form is showing */}
            {!showProposalForm && (agreement || !formData.attachment_url || !formData.attachment_url.toLowerCase().includes('.pdf')) && (
              <Button type="submit" disabled={isPending || !requiredFieldsFilled}>{isPending ? "Saving..." : "Save"}</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Proposal Preview Dialog */}
    <EstimatePreviewDialog
      estimateId={proposalEstimateId}
      open={showProposalPreview}
      onOpenChange={setShowProposalPreview}
      onConfirmSend={() => {
        setShowProposalPreview(false);
        setShowSendDialog(true);
      }}
      confirmSendLabel="Confirm & Send to Customer"
    />

    {/* Send Proposal Dialog */}
    {proposalEstimateId && (
      <SendProposalDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        estimateId={proposalEstimateId}
        companyId={companyId}
        customerName={customerName || ""}
        customerEmail={projectCustomerEmail || null}
        jobAddress={projectAddress}
        onSuccess={() => {
          toast.success("Proposal sent to customer!");
          resetProposalState();
          clearDraft();
          setFormData(initialFormData);
          onOpenChange(false);
          queryClientAgreement.invalidateQueries({ queryKey: ["estimates"] });
          queryClientAgreement.invalidateQueries({ queryKey: ["company-estimates"] });
        }}
      />
    )}
  </>
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
  const initialFormData = {
    phase_name: "",
    description: "",
    due_date: "",
    amount: "",
    agreement_id: "",
  };
  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "phase-dialog",
    initialFormData,
    phase?.id || "new",
    open
  );
  const [validationWarning, setValidationWarning] = useState("");
  const [agreementError, setAgreementError] = useState("");
  const [phaseNameError, setPhaseNameError] = useState("");
  const [dueDateError, setDueDateError] = useState("");
  const [amountError, setAmountError] = useState("");

  // Check remaining balance for each agreement
  const getAgreementRemaining = (agreement: typeof agreements[0]) => {
    const contractTotal = agreement.total_price || 0;
    const phasesTotal = paymentPhases
      .filter(p => p.agreement_id === agreement.id && p.id !== phase?.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return contractTotal - phasesTotal;
  };

  const isAgreementFullyAllocated = (agreement: typeof agreements[0]) => {
    if (phase?.agreement_id === agreement.id) return false;
    return getAgreementRemaining(agreement) <= 0;
  };

  // Reset form when phase identity changes (not on every open — draft handles persistence)
  const lastPhaseIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      lastPhaseIdRef.current = undefined;
      return;
    }
    const currentId = phase?.id ?? null;
    if (lastPhaseIdRef.current === currentId) return;
    lastPhaseIdRef.current = currentId;

    if (phase) {
      clearDraft();
      setFormData({
        phase_name: phase.phase_name || "",
        description: phase.description || "",
        due_date: phase.due_date || "",
        amount: phase.amount?.toString() || "",
        agreement_id: phase.agreement_id || "",
      });
    }
    // For new phases, draft will auto-load from sessionStorage
    setValidationWarning("");
    setAgreementError("");
    setPhaseNameError("");
    setDueDateError("");
  }, [open, phase]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) clearDraft();
    setValidationWarning("");
    setAgreementError("");
    setPhaseNameError("");
    setDueDateError("");
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
    
    let hasError = false;
    
    if (!formData.agreement_id) {
      setAgreementError("Contract/Agreement is required");
      hasError = true;
    }
    
    if (!formData.phase_name.trim()) {
      setPhaseNameError("Progress payment name is required");
      hasError = true;
    }
    
    if (!formData.due_date) {
      setDueDateError("Due date is required");
      hasError = true;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setAmountError("Amount is required");
      hasError = true;
    }
    
    if (hasError) return;
    
    onSave({
      phase_name: formData.phase_name.trim(),
      description: formData.description || null,
      due_date: formData.due_date,
      amount: parseFloat(formData.amount) || 0,
      agreement_id: formData.agreement_id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase ? "Edit Progress Payment" : "Add Progress Payment"}</DialogTitle>
          <DialogDescription>Define a progress payment milestone for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Contract <span className="text-destructive">*</span></Label>
            <Select 
              value={formData.agreement_id} 
              onValueChange={(v) => {
                updateFormData({ agreement_id: v });
                setAgreementError("");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
              <SelectContent>
                {agreements.map((a) => {
                  const remaining = getAgreementRemaining(a);
                  const fullyAllocated = isAgreementFullyAllocated(a);
                  return (
                    <SelectItem key={a.id} value={a.id} className={fullyAllocated ? "opacity-50" : ""}>
                      {a.agreement_number} - {a.agreement_type || "Contract"} ({formatCurrency(a.total_price)}) - Remaining: {formatCurrency(remaining)}
                      {fullyAllocated && " (Fully Allocated)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {agreementError && <p className="text-xs text-destructive mt-1">{agreementError}</p>}
            {agreements.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No contracts found for this project.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Progress Payment Name <span className="text-destructive">*</span></Label>
              <Input value={formData.phase_name} onChange={(e) => { updateFormData({ phase_name: e.target.value }); setPhaseNameError(""); }} placeholder="e.g., Deposit, Progress, Final" />
              {phaseNameError && <p className="text-xs text-destructive mt-1">{phaseNameError}</p>}
            </div>
            <div>
              <Label>Due Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={formData.due_date} onChange={(e) => { updateFormData({ due_date: e.target.value }); setDueDateError(""); }} />
              {dueDateError && <p className="text-xs text-destructive mt-1">{dueDateError}</p>}
            </div>
          </div>
          <div>
            <Label>Amount ($) <span className="text-destructive">*</span></Label>
            <Input type="text" inputMode="decimal" value={formData.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { updateFormData({ amount: val }); setAmountError(""); } }} />
            {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
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
            <Input value={formData.description} onChange={(e) => updateFormData({ description: e.target.value })} placeholder="Additional details about this phase" />
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
  const { isAdmin: isAdminUser, isSuperAdmin: isSuperAdminUser } = useAuth();
  const canAddBank = isAdminUser || isSuperAdminUser;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: "",
    payment_method: "",
    payment_reference: "",
    bank_id: "",
  });
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  // Fetch existing banks with id and name scoped by company
  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks-with-id", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.filter((b): b is { id: string; name: string } => typeof b.name === 'string');
    },
    enabled: open && !!companyId,
  });

  // Mutation to add new bank scoped by company
  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { data, error } = await supabase
        .from("banks")
        .insert({ name: bankName, company_id: companyId })
        .select("id")
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
      return data?.id;
    },
    onSuccess: (newBankId) => {
      queryClient.invalidateQueries({ queryKey: ["banks-with-id", companyId] });
      if (newBankId) {
        setFormData(p => ({ ...p, bank_id: newBankId }));
      }
    },
  });

  const handleAddBank = (bankName: string) => {
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank => 
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const selectedBank = existingBanks.find(b => b.id === formData.bank_id);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && bill) {
      setFormData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: (bill.balance || 0).toString(),
        payment_method: "Check",
        payment_reference: "",
        bank_id: "",
      });
      setBankSearch("");
    }
  }, [open, bill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bankName = existingBanks.find(b => b.id === formData.bank_id)?.name || null;
    onSave({
      payment_date: formData.payment_date || null,
      payment_amount: parseFloat(formData.payment_amount) || 0,
      payment_method: formData.payment_method || null,
      payment_reference: formData.payment_reference || null,
      bank_name: bankName,
      bank_id: formData.bank_id || null,
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
                    Original: <span className="line-through text-muted-foreground">{formatCurrency2(bill?.original_bill_amount)}</span>
                    {" → "}
                    Net: <span className="font-medium">{formatCurrency2(bill?.bill_amount)}</span>
                    {" • "}
                  </>
                )}
                Balance: <span className="font-semibold text-amber-600">{formatCurrency2(balance)}</span>
              </div>
              
              {/* Offset Details */}
              {offsetBills.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-700 mb-2">
                    Credit Offsets Applied ({formatCurrency(totalOffset)} total)
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
                  className={cn("w-full justify-between font-normal", !formData.bank_id && "border-destructive")}
                >
                  {selectedBank?.name || "Select or add bank..."}
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
                      {canAddBank && bankSearch && !filteredBanks.some(b => b.name.toLowerCase() === bankSearch.toLowerCase()) && (
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
                          key={bank.id}
                          value={bank.name}
                          onSelect={() => {
                            setFormData(p => ({ ...p, bank_id: bank.id }));
                            setBankOpen(false);
                            setBankSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.bank_id === bank.id ? "opacity-100" : "opacity-0")} />
                          {bank.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {!formData.bank_id && (
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
              <Label>Payment Method <span className="text-destructive">*</span></Label>
              <Select value={formData.payment_method} onValueChange={(v) => setFormData(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger className={cn(!formData.payment_method && "border-destructive/50")}><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Zelle">Zelle</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Check # <span className="text-destructive">*</span></Label>
              <Input 
                value={formData.payment_reference} 
                onChange={(e) => setFormData(p => ({ ...p, payment_reference: e.target.value }))} 
                placeholder="Check #, confirmation..."
                className={cn(!formData.payment_reference.trim() && "border-destructive/50")}
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
            <Button type="submit" disabled={isPending || paymentAmount <= 0 || !formData.bank_id || !formData.payment_method || !formData.payment_reference.trim()}>
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
  offsetBills = [],
  projectId,
  companyId,
  isAdmin,
  isSuperAdmin,
  isQBConnected = false,
  onSyncPayment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
  offsetBills?: Bill[];
  projectId: string;
  companyId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isQBConnected?: boolean;
  onSyncPayment?: (paymentId: string, paymentDetails?: { amount: number; date: string; reference: string | null; paymentMethod: string | null }) => Promise<{ synced: boolean }>;
}) {
  const queryClient = useQueryClient();
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<BillPayment | null>(null);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    payment_date: "",
    payment_amount: 0,
    payment_method: "",
    payment_reference: "",
    bank_name: "",
  });

  // Stable reference to bill ID for query invalidation
  const billId = bill?.id;

  const { data: payments = [], isLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["bill-payments", billId],
    queryFn: async () => {
      if (!billId) return [];
      const { data, error } = await supabase
        .from("bill_payments")
        .select("*, bank:banks(name)")
        .eq("bill_id", billId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as (BillPayment & { bank?: { name: string } | null })[];
    },
    enabled: !!billId && open,
  });

  // Fetch QB sync statuses for bill payments in this dialog
  const { data: paymentSyncStatuses = {} } = useQuery({
    queryKey: ["bill-payment-history-sync-statuses", billId, companyId],
    queryFn: async () => {
      if (!companyId || payments.length === 0) return {};
      const ids = payments.map((p: any) => p.id);
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id, sync_status, quickbooks_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .in("record_id", ids);
      if (error) throw error;
      const map: Record<string, { status: string; qbId: string | null }> = {};
      for (const row of data || []) {
        map[row.record_id] = { status: row.sync_status, qbId: row.quickbooks_id };
      }
      return map;
    },
    enabled: isQBConnected && payments.length > 0 && open,
    staleTime: 30000,
  });

  // Fetch banks for dropdown
  const { data: banks = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!editingPayment,
  });

  // QB duplicate detection state for this dialog
  const [qbDupDialogOpen, setQbDupDialogOpen] = useState(false);
  const [qbDupLinking, setQbDupLinking] = useState(false);
  const [qbDupState, setQbDupState] = useState<{
    duplicates: any[];
    localAmount: number;
    localDate: string;
    localReference: string | null;
    paymentId: string;
  } | null>(null);

  // Helper to sync bill payment to QuickBooks
  const syncBillPaymentToQB = async (paymentId: string): Promise<{ synced: boolean }> => {
    if (!companyId || !isQBConnected) return { synced: false };
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: {
          companyId,
          syncType: "bill_payment",
          recordId: paymentId,
        },
      });
      if (error) {
        console.error("QuickBooks sync error:", error);
        return { synced: false };
      }
      if (data?.errors?.length) {
        toast.error(`QB sync error: ${data.errors[0]}`, { duration: Infinity });
        return { synced: false };
      }
      return { synced: data?.synced > 0 };
    } catch (err) {
      console.error("Failed to sync to QuickBooks:", err);
      return { synced: false };
    }
  };

  // Helper to check for QB duplicates before syncing a bill payment
  const checkAndSyncBillPayment = async (paymentId: string, amount: number, date: string, reference: string | null, paymentMethod?: string | null): Promise<{ synced: boolean }> => {
    if (!companyId) return { synced: false };

    // Check if sync log already exists (already synced)
    const { data: existingSync } = await supabase
      .from("quickbooks_sync_log")
      .select("id, quickbooks_id")
      .eq("company_id", companyId)
      .eq("record_type", "bill_payment")
      .eq("record_id", paymentId)
      .eq("sync_status", "synced")
      .maybeSingle();

    if (existingSync?.quickbooks_id) {
      // Already synced — just re-sync the update
      return syncBillPaymentToQB(paymentId);
    }

    // No existing sync — check for duplicates
    try {
      const { data: dupResult, error: dupError } = await supabase.functions.invoke("quickbooks-find-duplicates", {
        body: {
          companyId,
          recordType: "bill_payment",
          amount,
          date,
          reference,
          vendorName: bill?.installer_company || null,
          paymentMethod: paymentMethod || null,
        },
      });

      if (!dupError && dupResult?.duplicates?.length > 0) {
        // Show duplicate review dialog — return a promise that resolves after user choice
        return new Promise((resolve) => {
          setQbDupState({
            duplicates: dupResult.duplicates,
            localAmount: amount,
            localDate: date,
            localReference: reference,
            paymentId,
          });
          // Store resolve callback to use when user makes a choice
          qbDupResolveRef.current = resolve;
          setQbDupDialogOpen(true);
        });
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
    }

    // No duplicates found — sync directly
    return syncBillPaymentToQB(paymentId);
  };

  // Ref to store the resolve callback for the duplicate dialog promise
  const qbDupResolveRef = useRef<((result: { synced: boolean }) => void) | null>(null);

  const handleQbDupLink = async (qbId: string) => {
    if (!qbDupState || !companyId) return;
    setQbDupLinking(true);
    try {
      await supabase.from("quickbooks_sync_log").upsert({
        company_id: companyId,
        record_type: "bill_payment",
        record_id: qbDupState.paymentId,
        quickbooks_id: qbId,
        sync_status: "synced",
        synced_at: new Date().toISOString(),
      }, { onConflict: "company_id,record_type,record_id" });
      toast.success("Linked to existing QuickBooks record");
      queryClient.invalidateQueries({ queryKey: ["qb-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["bill-payment-history-sync-statuses"] });
      qbDupResolveRef.current?.({ synced: true });
    } catch (err) {
      console.error("Failed to link QB record:", err);
      toast.error("Failed to link to QuickBooks record");
      qbDupResolveRef.current?.({ synced: false });
    } finally {
      setQbDupLinking(false);
      setQbDupDialogOpen(false);
      setQbDupState(null);
      qbDupResolveRef.current = null;
    }
  };

  const handleQbDupCreateNew = async () => {
    if (!qbDupState) return;
    const paymentId = qbDupState.paymentId;
    setQbDupDialogOpen(false);
    setQbDupState(null);
    const result = await syncBillPaymentToQB(paymentId);
    if (result.synced) {
      queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["bill-payment-history-sync-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["qb-sync-status"] });
    }
    qbDupResolveRef.current?.(result);
    qbDupResolveRef.current = null;
  };

  const handleQbDupCancel = () => {
    setQbDupDialogOpen(false);
    setQbDupState(null);
    qbDupResolveRef.current?.({ synced: false });
    qbDupResolveRef.current = null;
  };

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

      let qbSynced = false;
      let qbManualRequired = false;
      let qbManualMessage = "";

      // Delete/void in QuickBooks first (before deleting locally)
      if (companyId) {
        try {
          const { data: qbResult, error: qbError } = await supabase.functions.invoke("delete-quickbooks-record", {
            body: {
              companyId,
              recordType: "bill_payment",
              recordId: paymentId,
              action: "void",
            },
          });
          if (qbError) {
            console.error("QuickBooks delete error:", qbError);
          } else if (qbResult?.manual_action_required) {
            qbManualRequired = true;
            qbManualMessage = qbResult.message || "Manual action required in QuickBooks";
          } else if (qbResult?.success) {

            qbSynced = true;
          }
        } catch (err) {
          console.error("Failed to delete from QuickBooks:", err);
        }
      }

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

      return { qbSynced, qbManualRequired, qbManualMessage };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Payment deleted and synced to QuickBooks");
      } else if (result?.qbManualRequired) {
        toast.success("Payment deleted locally");
        toast.warning(result.qbManualMessage, { duration: Infinity });
      } else {
        toast.success("Payment deleted");
      }
      // Use stable billId and also refetch directly for immediate update
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: ["bill-payments", billId] });
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setDeletePaymentId(null);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`, { duration: Infinity }),
  });

  // Edit bill payment mutation
  const editPaymentMutation = useMutation({
    mutationFn: async (data: { paymentId: string; updates: Partial<BillPayment>; originalPayment: BillPayment }) => {
      const { paymentId, updates, originalPayment } = data;

      // Update the payment record
      const { error } = await supabase
        .from("bill_payments")
        .update(updates)
        .eq("id", paymentId);
      if (error) throw error;

      await logAudit({
        tableName: 'bill_payments',
        recordId: paymentId,
        action: 'UPDATE',
        oldValues: originalPayment,
        newValues: { ...originalPayment, ...updates },
        description: `Updated bill payment`,
      });

      // Recalculate bill totals if amount changed
      if (updates.payment_amount !== undefined && bill?.id) {
        const { data: allPayments } = await supabase
          .from("bill_payments")
          .select("payment_amount")
          .eq("bill_id", bill.id);
        
        const newTotalPaid = (allPayments || []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        const newBalance = (bill.bill_amount || 0) - newTotalPaid;

        await supabase
          .from("project_bills")
          .update({ amount_paid: newTotalPaid, balance: newBalance })
          .eq("id", bill.id);
      }

      // Check for duplicates before syncing to QuickBooks
      const qbResult = await checkAndSyncBillPayment(
        paymentId,
        updates.payment_amount ?? originalPayment.payment_amount ?? 0,
        updates.payment_date ?? originalPayment.payment_date ?? "",
        updates.payment_reference ?? originalPayment.payment_reference ?? null,
        updates.payment_method ?? originalPayment.payment_method ?? null,
      );
      return { qbSynced: qbResult.synced };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Payment updated and synced to QuickBooks");
      } else {
        toast.success("Payment updated");
      }
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: ["bill-payments", billId] });
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      setEditingPayment(null);
    },
    onError: (error) => toast.error(`Failed to update: ${error.message}`),
  });

  const handleEditClick = (payment: BillPayment) => {
    setEditingPayment(payment);
    setEditForm({
      payment_date: payment.payment_date?.split("T")[0] || "",
      payment_amount: payment.payment_amount || 0,
      payment_method: payment.payment_method || "",
      payment_reference: payment.payment_reference || "",
      bank_name: payment.bank_name || "",
    });
  };

  const handleEditSubmit = () => {
    if (!editingPayment) return;
    editPaymentMutation.mutate({
      paymentId: editingPayment.id,
      updates: {
        payment_date: editForm.payment_date || null,
        payment_amount: editForm.payment_amount,
        payment_method: editForm.payment_method || null,
        payment_reference: editForm.payment_reference || null,
        bank_name: editForm.bank_name || null,
      },
      originalPayment: editingPayment,
    });
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const canEdit = isAdmin || isSuperAdmin;

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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
                    {formatCurrency2(bill?.bill_amount)}
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
                    <span className="font-medium">{formatCurrency2(bill?.original_bill_amount || bill?.bill_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Bill Amount:</span>
                    <span className="font-medium">{formatCurrency2(bill?.bill_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium text-emerald-600">{formatCurrency2(bill?.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-medium">Balance Due:</span>
                    <span className={cn(
                      "font-bold",
                      (bill?.balance || 0) > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {formatCurrency2(bill?.balance)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Offset Details */}
              {offsetBills.length > 0 && (
                <Card className="border border-blue-200">
                  <CardHeader className="pb-2 pt-3 px-4 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Receipt className="h-4 w-4" />
                      Credit Offsets Applied ({formatCurrency2(offsetBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0))} total)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-3 space-y-2">
                    {offsetBills.map((offsetBill) => (
                      <div key={offsetBill.id} className="text-sm border-l-2 border-blue-300 pl-3 py-1">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">{offsetBill.installer_company || "Unknown vendor"}</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">{formatCurrency2(offsetBill.bill_amount)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {offsetBill.created_at && formatDate(offsetBill.created_at)}
                          {offsetBill.bill_ref && ` • Ref: ${offsetBill.bill_ref}`}
                          {offsetBill.category && ` • ${offsetBill.category}`}
                        </div>
                        {offsetBill.memo && (
                          <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-2">
                            {offsetBill.memo}
                          </p>
                        )}
                      </div>
                    ))}
                    {bill?.original_bill_amount != null && bill.original_bill_amount !== bill.bill_amount && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 pt-2 border-t border-blue-200">
                        Original bill reduced from {formatCurrency2(bill.original_bill_amount)} to {formatCurrency2(bill.bill_amount)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                        {isQBConnected && <TableHead className="text-xs">QB</TableHead>}
                        {canEdit && <TableHead className="text-xs w-20"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs">{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="text-xs">
                            {(payment.bank?.name || payment.bank_name) ? (
                              <Badge variant="outline" className="text-[10px]">{payment.bank?.name || payment.bank_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{payment.payment_method || "-"}</TableCell>
                          <TableCell className="text-xs">{payment.payment_reference || "-"}</TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-medium">
                            {formatCurrency2(payment.payment_amount)}
                          </TableCell>
                          {isQBConnected && (
                            <TableCell className="text-xs">
                              {(() => {
                                const syncInfo = paymentSyncStatuses[payment.id];
                                if (syncInfo?.status === "synced") {
                                  return (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                                      <Check className="h-2.5 w-2.5 mr-0.5" />QB
                                    </Badge>
                                  );
                                } else if (syncInfo) {
                                  return (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                      {syncInfo.status}
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] text-muted-foreground cursor-pointer hover:bg-muted/80 hover:text-foreground transition-colors"
                                    onClick={async () => {
                                      if (!onSyncPayment || syncingPaymentId) return;
                                      setSyncingPaymentId(payment.id);
                                      try {
                                        const result = await onSyncPayment(payment.id, {
                                          amount: payment.payment_amount,
                                          date: payment.payment_date || "",
                                          reference: payment.payment_reference || null,
                                          paymentMethod: payment.payment_method || null,
                                        });
                                        if (result.synced) {
                                          toast.success("Payment synced to QuickBooks");
                                          queryClient.invalidateQueries({ queryKey: ["bill-payment-history-sync-statuses"] });
                                          queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });
                                        } else {
                                          toast.error("Failed to sync payment to QuickBooks");
                                        }
                                      } catch {
                                        toast.error("Failed to sync payment");
                                      } finally {
                                        setSyncingPaymentId(null);
                                      }
                                    }}
                                    title="Click to sync to QuickBooks"
                                  >
                                    {syncingPaymentId === payment.id ? (
                                      <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                                    ) : null}
                                    Unsynced
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                          )}
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  onClick={() => handleEditClick(payment)}
                                  title="Edit payment"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => setDeletePaymentId(payment.id)}
                                  title="Delete payment"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4} className="text-xs">Total Paid</TableCell>
                        <TableCell className="text-xs text-right text-emerald-600">{formatCurrency2(totalPaid)}</TableCell>
                        {isQBConnected && <TableCell />}
                        {canEdit && <TableCell />}
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <span className="text-muted-foreground">Remaining Balance:</span>
                    <span className={cn("font-semibold", (bill?.balance || 0) > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {formatCurrency2(bill?.balance)}
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

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => { if (!open) setEditingPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update payment details. Changes will sync to QuickBooks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-payment-date">Payment Date</Label>
              <Input
                id="edit-payment-date"
                type="date"
                value={editForm.payment_date}
                onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-amount">Amount</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                step="0.01"
                value={editForm.payment_amount}
                onChange={(e) => setEditForm({ ...editForm, payment_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank-name">Bank Account</Label>
              <Select
                value={editForm.bank_name}
                onValueChange={(value) => setEditForm({ ...editForm, bank_name: value })}
              >
                <SelectTrigger id="edit-bank-name">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.name}>{bank.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-method">Payment Method</Label>
              <Select
                value={editForm.payment_method}
                onValueChange={(value) => setEditForm({ ...editForm, payment_method: value })}
              >
                <SelectTrigger id="edit-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-reference">Reference / Check #</Label>
              <Input
                id="edit-payment-reference"
                value={editForm.payment_reference}
                onChange={(e) => setEditForm({ ...editForm, payment_reference: e.target.value })}
                placeholder="e.g., Check #1234"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit}
              disabled={editPaymentMutation.isPending}
            >
              {editPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QB Duplicate Review Dialog */}
      {qbDupState && (
        <QBDuplicateReviewDialog
          open={qbDupDialogOpen}
          onOpenChange={setQbDupDialogOpen}
          duplicates={qbDupState.duplicates}
          recordType="bill_payment"
          localAmount={qbDupState.localAmount}
          localDate={qbDupState.localDate}
          localReference={qbDupState.localReference}
          onLink={handleQbDupLink}
          onCreateNew={handleQbDupCreateNew}
          onCancel={handleQbDupCancel}
          isLinking={qbDupLinking}
        />
      )}
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
  totalPaymentsReceived,
  totalRefunds,
  salespeople,
  projectName,
  projectAddress,
  isCancelled,
}: {
  projectId: string;
  totalContracts: number;
  leadCostPercent: number;
  commissionSplitPct: number;
  totalBillsPaid: number;
  totalPaymentsReceived: number;
  totalRefunds: number;
  salespeople: SalespersonData[];
  projectName?: string | null;
  projectAddress?: string | null;
  isCancelled?: boolean;
}) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CommissionPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [vendorMappingDialogOpen, setVendorMappingDialogOpen] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<Partial<CommissionPayment> | null>(null);
  const [selectedSalespersonForMapping, setSelectedSalespersonForMapping] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [invoiceDialogSalesperson, setInvoiceDialogSalesperson] = useState<any | null>(null);

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

  // Fetch salespeople records to get IDs for mapping
  const { data: salespeopleRecords = [] } = useQuery({
    queryKey: ["salespeople", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Check QuickBooks connection status
  const { data: qbConnection } = useQuery({
    queryKey: ["quickbooks-connection", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("is_active, realm_id")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
  const isQBConnected = !!qbConnection?.is_active;

  // Fetch salesperson vendor mappings
  const { data: salespersonVendorMappings = [] } = useQuery({
    queryKey: ["qb-salesperson-vendor-mappings", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("quickbooks_mappings")
        .select("source_value, qbo_id, qbo_name")
        .eq("company_id", companyId)
        .eq("mapping_type", "salesperson_vendor");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && isQBConnected,
  });

  // Calculations: (Total Contracts - Lead Cost - Bills) × Split%
  const leadCostAmount = isCancelled ? 0 : totalContracts * (leadCostPercent / 100);
  const profit = isCancelled ? 0 : totalContracts - leadCostAmount - totalBillsPaid;
  const commissionPool = isCancelled ? 0 : (profit > 0 ? profit * (commissionSplitPct / 100) : 0);
  
  // Earned to date: (Amount Received - Bills Paid - Lead Cost on Received) × Split%
  const leadCostOnReceived = isCancelled ? 0 : totalPaymentsReceived * (leadCostPercent / 100);
  const earnedProfit = isCancelled ? 0 : totalPaymentsReceived - totalBillsPaid - leadCostOnReceived;
  const earnedPool = isCancelled ? 0 : earnedProfit * (commissionSplitPct / 100);
  
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
    // Find matching salesperson record for ID
    const salespersonRecord = salespeopleRecords.find(sr => sr.name === sp.name);
    // Check if mapped to vendor
    const vendorMapping = salespersonRecord 
      ? salespersonVendorMappings.find(m => m.source_value === salespersonRecord.id)
      : null;
    const earnedToDate = earnedPool * shareOfPool;
    return {
      ...sp,
      id: salespersonRecord?.id || null,
      shareOfPool,
      commissionAmount,
      earnedToDate,
      paid,
      balance: commissionAmount - paid,
      vendorMapped: !!vendorMapping,
      vendorName: vendorMapping?.qbo_name || null,
    };
  });

  const totalCommissionOwed = salespeopleWithCommission.reduce((sum, sp) => sum + sp.commissionAmount, 0);
  const totalCommissionPaid = commissionPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalCommissionBalance = totalCommissionOwed - totalCommissionPaid;
  const companyProfit = profit - totalCommissionOwed;

  // Helper to sync commission payment to QuickBooks
  const syncCommissionToQuickBooks = async (paymentId: string): Promise<{ synced: boolean; message?: string }> => {
    if (!companyId || !isQBConnected) return { synced: false };
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: {
          companyId,
          syncType: "commission_payment",
          recordId: paymentId,
        },
      });
      
      if (error) {
        console.error("QuickBooks sync error:", error);
        return { synced: false, message: error.message };
      } else if (data?.synced > 0) {

        return { synced: true };
      }
      const errorMessage = Array.isArray(data?.errors) && data.errors.length > 0 ? String(data.errors[0]) : undefined;
      return { synced: false, message: errorMessage };
    } catch (err) {
      console.error("Failed to sync to QuickBooks:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return { synced: false, message: errMsg };
    }
  };

  // Handle save payment with vendor mapping check
  const handleSavePayment = (payment: Partial<CommissionPayment>) => {
    // Find salesperson record to check mapping
    const salespersonRecord = salespeopleRecords.find(sr => sr.name === payment.salesperson_name);
    
    // If QB is connected, check if salesperson has vendor mapping
    if (isQBConnected && salespersonRecord) {
      const hasMapping = salespersonVendorMappings.some(m => m.source_value === salespersonRecord.id);
      
      if (!hasMapping) {
        // Show mapping dialog
        setPendingPaymentData(payment);
        setSelectedSalespersonForMapping({
          id: salespersonRecord.id,
          name: salespersonRecord.name || payment.salesperson_name || "",
        });
        setVendorMappingDialogOpen(true);
        return;
      }
    }
    
    // No mapping needed, proceed with save
    savePaymentMutation.mutate(payment);
  };

  // Save payment mutation
  const savePaymentMutation = useMutation({
    mutationFn: async (payment: Partial<CommissionPayment>) => {
      let savedRecordId: string | undefined;
      
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
        savedRecordId = editingPayment.id;
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
        savedRecordId = newPayment.id;
      }

      // Sync to QuickBooks if connected
      let qbSynced = false;
      let qbMessage: string | undefined;
      if (isQBConnected && savedRecordId) {
        const qbResult = await syncCommissionToQuickBooks(savedRecordId);
        qbSynced = qbResult.synced;
        qbMessage = qbResult.message;
      }

      return { qbSynced, isEdit: !!editingPayment?.id, qbMessage };
    },
    onSuccess: (result) => {
      const baseMsg = result?.isEdit ? "Payment updated" : "Payment recorded";
      if (result?.qbSynced) {
        toast.success(`${baseMsg} and synced to QuickBooks`);
      } else if (result?.qbMessage) {
        toast.success(baseMsg);
        toast.warning(`QuickBooks sync failed: ${result.qbMessage.slice(0, 100)}`);
      } else {
        toast.success(baseMsg);
      }
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
      
      let qbSynced = false;
      let qbManualRequired = false;
      let qbManualMessage = "";
      
      // Try to void in QuickBooks if connected
      if (companyId) {
        try {
          const { data: qbResult, error: qbError } = await supabase.functions.invoke("delete-quickbooks-record", {
            body: {
              companyId,
              recordType: "commission_payment",
              recordId: paymentId,
              action: "void",
            },
          });
          
          if (qbError) {
            console.error("QB delete error:", qbError);
          } else if (qbResult?.success) {
            qbSynced = true;
          } else if (qbResult?.manualRequired) {
            qbManualRequired = true;
            qbManualMessage = qbResult.message || "Manual deletion required in QuickBooks";
          }
        } catch (err) {
          console.error("Failed to sync delete to QuickBooks:", err);
        }
      }
      
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
      
      return { qbSynced, qbManualRequired, qbManualMessage };
    },
    onSuccess: (result) => {
      if (result?.qbSynced) {
        toast.success("Payment deleted and synced to QuickBooks");
      } else if (result?.qbManualRequired) {
        toast.success("Payment deleted");
        toast.info(result.qbManualMessage, { duration: 6000 });
      } else {
        toast.success("Payment deleted");
      }
      queryClient.invalidateQueries({ queryKey: ["commission-payments", projectId] });
      setDeleteDialogOpen(false);
      setDeletingPaymentId(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Contracts</div>
          <p className="text-lg font-semibold">{formatCurrency(totalContracts)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Collected to Date</div>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalPaymentsReceived)}</p>
        </Card>
        {totalRefunds > 0 && (
          <Card className="p-3 border-destructive/20">
            <div className="text-xs text-muted-foreground">Refunded</div>
            <p className="text-lg font-semibold text-destructive">-{formatCurrency(totalRefunds)}</p>
          </Card>
        )}
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
                  <TableHead className="text-xs text-right">Earned to Date</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Bal to Date</TableHead>
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
                    <TableCell className={cn("text-xs text-right font-medium", sp.earnedToDate < 0 ? "text-destructive" : "text-primary")}>
                      {formatCurrencyWithDecimals(sp.earnedToDate)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {formatCurrencyWithDecimals(sp.paid)}
                    </TableCell>
                    <TableCell className={cn("text-xs text-right font-medium", (sp.earnedToDate - sp.paid) > 0 ? "text-amber-600" : "text-emerald-600")}>
                      <span className="inline-flex items-center gap-1">
                        {formatCurrencyWithDecimals(sp.earnedToDate - sp.paid)}
                        {(sp.earnedToDate - sp.paid) > 0 && (
                          <button
                            onClick={() => setInvoiceDialogSalesperson({
                              salespersonName: sp.name || "",
                              commissionPct: sp.commissionPct,
                              commissionAmount: sp.commissionAmount,
                              earnedToDate: sp.earnedToDate,
                              paid: sp.paid,
                              balanceToDate: sp.earnedToDate - sp.paid,
                              balance: sp.balance,
                            })}
                            className="inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                            title="Generate commission invoice"
                          >
                            <FileText className="h-3 w-3" />
                          </button>
                        )}
                      </span>
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
                  <TableCell className={cn("text-xs text-right font-medium", earnedPool < 0 ? "text-destructive" : "text-primary")}>
                    {formatCurrencyWithDecimals(earnedPool)}
                  </TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{formatCurrencyWithDecimals(totalCommissionPaid)}</TableCell>
                  <TableCell className={cn("text-xs text-right", (earnedPool - totalCommissionPaid) > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {formatCurrencyWithDecimals(earnedPool - totalCommissionPaid)}
                  </TableCell>
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
        onSave={handleSavePayment}
        isPending={savePaymentMutation.isPending}
      />

      {/* Salesperson Vendor Mapping Dialog */}
      {selectedSalespersonForMapping && (
        <SalespersonVendorMappingDialog
          open={vendorMappingDialogOpen}
          onOpenChange={(open) => {
            setVendorMappingDialogOpen(open);
            if (!open) {
              setPendingPaymentData(null);
              setSelectedSalespersonForMapping(null);
            }
          }}
          salespersonId={selectedSalespersonForMapping.id}
          salespersonName={selectedSalespersonForMapping.name}
          onMappingComplete={() => {
            // Mapping complete - now save the pending payment
            if (pendingPaymentData) {
              savePaymentMutation.mutate(pendingPaymentData);
            }
            setPendingPaymentData(null);
            setSelectedSalespersonForMapping(null);
          }}
        />
      )}

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
      {/* Commission Invoice Dialog */}
      <CommissionInvoiceDialog
        open={!!invoiceDialogSalesperson}
        onOpenChange={(open) => !open && setInvoiceDialogSalesperson(null)}
        salesperson={invoiceDialogSalesperson}
        projectName={projectName}
        projectAddress={projectAddress}
        totalContracts={totalContracts}
        totalPaymentsReceived={totalPaymentsReceived}
        totalBillsPaid={totalBillsPaid}
        leadCostPercent={leadCostPercent}
        commissionSplitPct={commissionSplitPct}
      />
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

  // Fetch existing banks from banks table scoped by company
  const { companyId } = useCompanyContext();
  const { data: banksRaw = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId,
  });
  // Safely extract bank names regardless of cached data shape
  const existingBanks = banksRaw
    .map((b: any) => (typeof b === 'string' ? b : b?.name))
    .filter((name: unknown): name is string => typeof name === 'string');

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
                  <SelectItem value="Cash">Cash</SelectItem>
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

// --- Inline Project Financial Statements (P&L + Balance Sheet) ---
function ProjectFinancialStatements({
  totalRevenue,
  totalCOGS,
  totalBillsPaid,
  totalCollected,
  totalRefunded,
  totalInvoiced,
  leadCostPercent,
  commissionSplitPct,
  isCompleted,
  isCancelled,
  projectName,
  projectAddress,
  customerName,
}: {
  totalRevenue: number;
  totalCOGS: number;
  totalBillsPaid: number;
  totalCollected: number;
  totalRefunded: number;
  totalInvoiced: number;
  leadCostPercent: number;
  commissionSplitPct: number;
  isCompleted: boolean;
  isCancelled?: boolean;
  projectName?: string | null;
  projectAddress?: string | null;
  customerName?: string | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const now = new Date();
    const asOf = now.toLocaleDateString() + " " + now.toLocaleTimeString();
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Project Financial Statements</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      td { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
      .text-right, td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
      h2 { font-size: 15px; margin: 0 0 8px; }
      h1 { font-size: 18px; margin-bottom: 2px; }
      .meta { color: #374151; font-size: 13px; margin: 0; }
      .subtitle { color: #6b7280; font-size: 12px; margin-top: 8px; margin-bottom: 16px; }
      .section-header { background: #f3f4f6; padding: 4px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
      .badge { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #fef3c7; color: #92400e; margin-left: 6px; }
      .pnl-indent { padding-left: 32px; }
      .pnl-subtotal { background: #f0f0f0; font-weight: 600; }
      .pnl-grand-total { background: #d9d9d9; font-weight: 700; font-size: 14px; }
      .pnl-negative { color: #dc2626; }
      @media print { body { padding: 0; } }
    </style></head><body>`);
    printWindow.document.write(`<h1>Project Financial Statements</h1>`);
    if (projectName) printWindow.document.write(`<p class="meta"><strong>Project:</strong> ${projectName}</p>`);
    if (projectAddress) printWindow.document.write(`<p class="meta"><strong>Address:</strong> ${projectAddress}</p>`);
    if (customerName) printWindow.document.write(`<p class="meta"><strong>Customer:</strong> ${customerName}</p>`);
    printWindow.document.write(`<p class="subtitle">As of ${asOf}</p>`);
    printWindow.document.write(el.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 250);
  }, []);

  const billsOutstanding = totalCOGS - totalBillsPaid;
  const cancelledWriteOff = isCancelled ? Math.max(0, totalRevenue - totalRefunded) : 0;
  const netRevenue = totalRevenue - totalRefunded - cancelledWriteOff;
  const grossIncome = netRevenue - totalCOGS;
  const leadCost = isCancelled ? 0 : totalRevenue * (leadCostPercent / 100);
  const commissionBase = netRevenue - leadCost - totalCOGS;
  const commission = isCancelled ? 0 : (commissionBase > 0 ? commissionBase * (commissionSplitPct / 100) : 0);
  const grossIncomeAfterCommission = grossIncome - commission;
  const netIncome = grossIncomeAfterCommission + leadCost;

  const netCollected = totalCollected - totalRefunded;
  const ar = totalInvoiced - totalCollected;
  const ap = totalCOGS - totalBillsPaid;
  const netCash = netCollected - totalBillsPaid;
  const totalAssets = netCollected + Math.max(ar, 0);
  const totalLiabilities = Math.max(ap, 0);
  const equity = totalAssets - totalLiabilities;

  const fmt = (n: number) => formatCurrency(n);

  const lineRow = (label: string | ReactNode, amount: number, opts?: { indent?: boolean; bold?: boolean; grandTotal?: boolean }) => (
    <tr className={cn(
      "border-b last:border-0 pnl-row",
      opts?.bold && "bg-muted/30 font-semibold pnl-subtotal",
      opts?.grandTotal && "bg-primary/10 font-bold pnl-grand-total"
    )}>
      <td className={cn("py-2 px-4 text-sm", opts?.indent && "pl-8 pnl-indent")}>{label}</td>
      <td className={cn("py-2 px-4 text-sm text-right tabular-nums", amount < 0 && "text-destructive pnl-negative")}>{fmt(amount)}</td>
    </tr>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-start">
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-1" />
          Export PDF
        </Button>
      </div>
      <div ref={printRef} className="grid md:grid-cols-2 gap-4">
        {/* P&L */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {lineRow("Revenues (Contracts Invoiced)", totalRevenue)}
                  {totalRefunded > 0 && lineRow("Customer Refunds", -totalRefunded, { indent: true })}
                  {isCancelled && cancelledWriteOff > 0 && lineRow("Project Cancelled", -cancelledWriteOff, { indent: true })}
                  {(totalRefunded > 0 || (isCancelled && cancelledWriteOff > 0)) && lineRow("Net Revenue", netRevenue, { bold: true })}
                  {lineRow("Bills Paid", -totalBillsPaid, { indent: true })}
                  {lineRow("Bills Outstanding", -billsOutstanding, { indent: true })}
                  {lineRow("Cost of Sales Total", -totalCOGS, { bold: true })}
                  {lineRow("Gross Income", grossIncome, { bold: true })}
                  {lineRow(
                    <span className="flex items-center gap-1.5">
                      Commissions
                      {!isCompleted && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">Estimated</Badge>}
                    </span>,
                    -commission, { indent: true }
                  )}
                  {lineRow("Gross Income After Commission", grossIncomeAfterCommission, { bold: true })}
                  {lineRow("Lead Fee", leadCost, { indent: true })}
                  {lineRow(
                    <span className="flex items-center gap-1.5">
                      Net Income
                      {!isCompleted && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">Estimated</Badge>}
                    </span>,
                    netIncome, { grandTotal: true }
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-1.5 border-b"><span className="text-xs font-semibold">Assets</span></div>
              <table className="w-full text-sm">
                <tbody>
                  {lineRow("Cash (Payments Collected)", totalCollected, { indent: true })}
                  {totalRefunded > 0 && lineRow("Less: Customer Refunds", -totalRefunded, { indent: true })}
                  {lineRow("Less: Bills Paid", -totalBillsPaid, { indent: true })}
                  {lineRow("Net Cash", netCash, { bold: true })}
                  {lineRow("Accounts Receivable", Math.max(ar, 0), { indent: true })}
                  {lineRow("Total Assets", totalAssets, { bold: true })}
                </tbody>
              </table>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-1.5 border-b"><span className="text-xs font-semibold">Liabilities</span></div>
              <table className="w-full text-sm">
                <tbody>
                  {lineRow("Accounts Payable (Bills Outstanding)", Math.max(ap, 0), { indent: true })}
                  {lineRow("Total Liabilities", totalLiabilities, { bold: true })}
                </tbody>
              </table>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {lineRow("Equity (Net Position)", equity, { grandTotal: true })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Extracted Phases Review Dialog — lets users review/edit AI-extracted phases before saving
function ExtractedPhasesReviewDialog({
  open,
  onOpenChange,
  phases,
  agreementId,
  agreements,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: ExtractedPhase[];
  agreementId: string | null;
  agreements: Agreement[];
  onSave: (phases: (ExtractedPhase & { agreement_id?: string | null })[]) => void;
}) {
  const [editablePhases, setEditablePhases] = useState<(ExtractedPhase & { agreement_id?: string | null; enabled: boolean })[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && phases.length > 0) {
      setEditablePhases(
        phases.map((p) => ({
          ...p,
          amount: typeof p.amount === 'string' ? (parseFloat(p.amount) || 0) : (p.amount || 0),
          agreement_id: agreementId,
          enabled: true,
        }))
      );
    }
  }, [open, phases, agreementId]);

  const updatePhase = (idx: number, updates: Partial<typeof editablePhases[number]>) => {
    setEditablePhases((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
    );
  };

  const total = editablePhases
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + (typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount)) || 0), 0);

  const handleSave = async () => {
    const toSave = editablePhases.filter((p) => p.enabled);
    if (toSave.length === 0) {
      onOpenChange(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(toSave);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[88vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Payment Phases
          </DialogTitle>
          <DialogDescription>
            Contract is saved first. Now review and polish the extracted phases before importing.
          </DialogDescription>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary">{editablePhases.length} extracted</Badge>
            <Badge variant="outline">{editablePhases.filter((p) => p.enabled).length} selected</Badge>
            <Badge variant="outline">Total {formatCurrency(total)}</Badge>
          </div>
        </DialogHeader>

        {editablePhases.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No phases to review.</div>
        ) : (
          <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-3">
            <div className="hidden md:grid md:grid-cols-12 text-xs font-medium text-muted-foreground px-3">
              <div className="col-span-1">Use</div>
              <div className="col-span-4">Phase Name</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2">Contract</div>
            </div>

            {editablePhases.map((phase, idx) => (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-1 md:grid-cols-12 gap-3 rounded-xl border bg-card p-3",
                  !phase.enabled && "opacity-55"
                )}
              >
                <div className="md:col-span-1 flex items-center gap-2">
                  <Checkbox
                    checked={phase.enabled}
                    onCheckedChange={(checked) => updatePhase(idx, { enabled: !!checked })}
                  />
                  <span className="md:hidden text-xs text-muted-foreground">Phase {idx + 1}</span>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs md:hidden">Phase Name</Label>
                  <Input
                    value={phase.phase_name}
                    onChange={(e) => updatePhase(idx, { phase_name: e.target.value })}
                    disabled={!phase.enabled}
                    className="h-9"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs md:hidden">Amount ($)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(phase.amount || "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        updatePhase(idx, { amount: val === "" ? 0 : parseFloat(val) || 0 });
                      }
                    }}
                    disabled={!phase.enabled}
                    className="h-9"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <Label className="text-xs md:hidden">Description</Label>
                  <Input
                    value={phase.description || ""}
                    onChange={(e) => updatePhase(idx, { description: e.target.value })}
                    disabled={!phase.enabled}
                    className="h-9"
                    placeholder="Milestone description"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs md:hidden">Contract</Label>
                  <Select
                    value={phase.agreement_id || ""}
                    onValueChange={(v) => updatePhase(idx, { agreement_id: v })}
                    disabled={!phase.enabled || agreements.length === 1}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select contract" />
                    </SelectTrigger>
                    <SelectContent>
                      {agreements.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          #{a.agreement_number} — {a.agreement_type || "Agreement"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || editablePhases.filter((p) => p.enabled).length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Import ${editablePhases.filter((p) => p.enabled).length} Phase(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({
  open,
  onOpenChange,
  refund,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refund: Refund | null;
  onSave: (data: Partial<Refund>) => void;
  isPending: boolean;
}) {
  const { companyId } = useCompanyContext();
  const { isAdmin: isAdminUser, isSuperAdmin: isSuperAdminUser } = useAuth();
  const canAddBank = isAdminUser || isSuperAdminUser;
  const initialFormData = {
    refund_amount: "",
    refund_date: new Date().toISOString().split('T')[0],
    refund_method: "",
    refund_reference: "",
    bank_id: "",
    reason: "",
    notes: "",
    refund_status: "Pending",
    exclude_from_qb: false,
  };
  const { draft: formData, updateDraft: updateFormData, setFullDraft: setFormData, clearDraft } = usePersistentDraft(
    "refund-dialog",
    initialFormData,
    refund?.id || "new",
    open
  );
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  const { data: existingBanks = [] } = useQuery({
    queryKey: ["banks-with-id", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data.filter((b): b is { id: string; name: string } => typeof b.name === 'string');
    },
    enabled: open && !!companyId,
  });

  const queryClient = useQueryClient();

  const addBankMutation = useMutation({
    mutationFn: async (bankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { data, error } = await supabase
        .from("banks")
        .insert({ name: bankName, company_id: companyId })
        .select("id")
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
      return data?.id;
    },
    onSuccess: (newBankId) => {
      queryClient.invalidateQueries({ queryKey: ["banks-with-id", companyId] });
      if (newBankId) updateFormData({ bank_id: newBankId });
    },
  });

  const handleAddBank = (bankName: string) => {
    addBankMutation.mutate(bankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = existingBanks.filter(bank =>
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const selectedBank = existingBanks.find(b => b.id === formData.bank_id);

  const lastRefundIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      lastRefundIdRef.current = undefined;
      return;
    }
    const currentId = refund?.id ?? null;
    if (lastRefundIdRef.current === currentId) return;
    lastRefundIdRef.current = currentId;

    if (refund) {
      clearDraft();
      setFormData({
        refund_amount: refund.refund_amount?.toString() || "",
        refund_date: refund.refund_date || "",
        refund_method: refund.refund_method || "",
        refund_reference: refund.refund_reference || "",
        bank_id: refund.bank_id || "",
        reason: refund.reason || "",
        notes: refund.notes || "",
        refund_status: refund.refund_status || "Pending",
        exclude_from_qb: refund.exclude_from_qb ?? false,
      });
    }
    setBankSearch("");
  }, [open, refund]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) clearDraft();
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = formData.refund_amount.replace(/[^0-9.]/g, '');
    const amount = parseFloat(rawAmount) || 0;
    if (amount <= 0 || !formData.refund_date) return;

    const bankName = existingBanks.find(b => b.id === formData.bank_id)?.name || null;

    clearDraft();
    onSave({
      refund_amount: amount,
      refund_date: formData.refund_date || null,
      refund_method: formData.refund_method || null,
      refund_reference: formData.refund_reference || null,
      bank_id: formData.bank_id || null,
      bank_name: bankName,
      reason: formData.reason || null,
      notes: formData.notes || null,
      refund_status: formData.refund_status,
      exclude_from_qb: formData.exclude_from_qb,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{refund ? "Edit Refund" : "Issue Refund"}</DialogTitle>
          <DialogDescription>Enter refund details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Refund Amount <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                value={formData.refund_amount}
                onChange={(e) => updateFormData({ refund_amount: e.target.value })}
                placeholder="$0.00"
              />
            </div>
            <div>
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={formData.refund_date}
                onChange={(e) => updateFormData({ refund_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Account</Label>
              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-left font-normal">
                    {selectedBank?.name || "Select bank..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search banks..."
                      value={bankSearch}
                      onValueChange={setBankSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {canAddBank && bankSearch.trim() ? (
                          <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => handleAddBank(bankSearch.trim())}>
                            <Plus className="h-3 w-3 mr-2" />
                            Add "{bankSearch.trim()}"
                          </Button>
                        ) : "No banks found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredBanks.map((bank) => (
                          <CommandItem key={bank.id} value={bank.name} onSelect={() => { updateFormData({ bank_id: bank.id }); setBankOpen(false); }}>
                            {bank.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Refund Method</Label>
              <Select value={formData.refund_method} onValueChange={(v) => updateFormData({ refund_method: v })}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Zelle/ACH">Zelle/ACH</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.refund_method === "Check" && (
            <div>
              <Label>Check Number</Label>
              <Input
                value={formData.refund_reference}
                onChange={(e) => updateFormData({ refund_reference: e.target.value })}
                placeholder="Check #"
              />
            </div>
          )}

          {formData.refund_method && formData.refund_method !== "Check" && (
            <div>
              <Label>Reference #</Label>
              <Input
                value={formData.refund_reference}
                onChange={(e) => updateFormData({ refund_reference: e.target.value })}
                placeholder="Transaction reference"
              />
            </div>
          )}

          <div>
            <Label>Reason</Label>
            <Input
              value={formData.reason}
              onChange={(e) => updateFormData({ reason: e.target.value })}
              placeholder="Reason for refund"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={formData.refund_status} onValueChange={(v) => updateFormData({ refund_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Issued">Issued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={formData.exclude_from_qb}
                  onCheckedChange={(checked) => updateFormData({ exclude_from_qb: !!checked })}
                />
                Exclude from QuickBooks
              </label>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : refund ? "Update Refund" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
