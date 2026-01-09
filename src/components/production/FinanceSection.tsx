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
  ChevronsUpDown
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
  const [activeSubTab, setActiveSubTab] = useState("invoices");
  
  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
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

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaymentsReceived = payments.filter(p => p.payment_status === "Received").reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const totalBills = bills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
  const totalBillsPaid = bills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const totalAgreementsValue = agreements.reduce((sum, a) => sum + (a.total_price || 0), 0);

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
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
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
    },
    onSuccess: () => {
      toast.success(editingPayment?.id ? "Payment updated" : "Payment created");
      queryClient.invalidateQueries({ queryKey: ["project-payments", projectId] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Bill mutations
  const saveBillMutation = useMutation({
    mutationFn: async (bill: Partial<Bill>) => {
      const balance = (bill.bill_amount || 0) - (bill.amount_paid || 0);
      if (editingBill?.id) {
        const { error } = await supabase
          .from("project_bills")
          .update({ ...bill, balance })
          .eq("id", editingBill.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_bills")
          .insert({ ...bill, balance, project_id: projectId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingBill?.id ? "Bill updated" : "Bill created");
      queryClient.invalidateQueries({ queryKey: ["project-bills", projectId] });
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
      setAgreementDialogOpen(false);
      setEditingAgreement(null);
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
        : "project_bills";
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted successfully");
      queryClient.invalidateQueries({ queryKey: [`project-${deleteTarget?.type}s`, projectId] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const handleDeleteClick = (type: string, id: string) => {
    setDeleteTarget({ type, id });
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Est. Cost</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(estimatedCost)}</p>
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

      {/* Sub-tabs for Invoices, Payments, Bills, Agreements */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invoices" className="text-xs">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="bills" className="text-xs">
            Bills ({bills.length})
          </TabsTrigger>
          <TabsTrigger value="agreements" className="text-xs">
            Contracts ({agreements.length})
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
      </Tabs>

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        invoice={editingInvoice}
        onSave={(data) => saveInvoiceMutation.mutate(data)}
        isPending={saveInvoiceMutation.isPending}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        payment={editingPayment}
        onSave={(data) => savePaymentMutation.mutate(data)}
        isPending={savePaymentMutation.isPending}
      />

      {/* Bill Dialog */}
      <BillDialog
        open={billDialogOpen}
        onOpenChange={setBillDialogOpen}
        bill={editingBill}
        onSave={(data) => saveBillMutation.mutate(data)}
        isPending={saveBillMutation.isPending}
        projectId={projectId}
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
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  invoice: Invoice | null;
  onSave: (data: Partial<Invoice>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    invoice_number: "",
    invoice_date: "",
    amount: "",
    total_expected: "",
    payments_received: "",
    open_balance: "",
  });

  useState(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        amount: invoice.amount?.toString() || "",
        total_expected: invoice.total_expected?.toString() || "",
        payments_received: invoice.payments_received?.toString() || "",
        open_balance: invoice.open_balance?.toString() || "",
      });
    } else {
      setFormData({ invoice_number: "", invoice_date: "", amount: "", total_expected: "", payments_received: "", open_balance: "" });
    }
  });

  // Reset form when dialog opens with different invoice
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        amount: invoice.amount?.toString() || "",
        total_expected: invoice.total_expected?.toString() || "",
        payments_received: invoice.payments_received?.toString() || "",
        open_balance: invoice.open_balance?.toString() || "",
      });
    } else if (newOpen) {
      setFormData({ invoice_number: "", invoice_date: "", amount: "", total_expected: "", payments_received: "", open_balance: "" });
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount) || 0;
    const paymentsReceived = parseFloat(formData.payments_received) || 0;
    onSave({
      invoice_number: formData.invoice_number || null,
      invoice_date: formData.invoice_date || null,
      amount,
      total_expected: parseFloat(formData.total_expected) || amount,
      payments_received: paymentsReceived,
      open_balance: amount - paymentsReceived,
    });
  };

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
              <Label>Amount ($)</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Payments Received ($)</Label>
              <Input type="number" value={formData.payments_received} onChange={(e) => setFormData(p => ({ ...p, payments_received: e.target.value }))} />
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

// Payment Dialog Component
function PaymentDialog({ 
  open, 
  onOpenChange, 
  payment, 
  onSave, 
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  payment: Payment | null;
  onSave: (data: Partial<Payment>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    bank_name: "",
    projected_received_date: "",
    payment_schedule: "",
    payment_status: "Pending",
    payment_amount: "",
    payment_fee: "",
    check_number: "",
  });

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
      });
    } else if (newOpen) {
      setFormData({ bank_name: "", projected_received_date: "", payment_schedule: "", payment_status: "Pending", payment_amount: "", payment_fee: "", check_number: "" });
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bank_name: formData.bank_name || null,
      projected_received_date: formData.projected_received_date || null,
      payment_schedule: formData.payment_schedule || null,
      payment_status: formData.payment_status,
      payment_amount: parseFloat(formData.payment_amount) || 0,
      payment_fee: parseFloat(formData.payment_fee) || 0,
      check_number: formData.check_number || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payment ? "Edit Payment" : "Add Payment"}</DialogTitle>
          <DialogDescription>Enter payment details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input value={formData.bank_name} onChange={(e) => setFormData(p => ({ ...p, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label>Expected Date</Label>
              <Input type="date" value={formData.projected_received_date} onChange={(e) => setFormData(p => ({ ...p, projected_received_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" value={formData.payment_amount} onChange={(e) => setFormData(p => ({ ...p, payment_amount: e.target.value }))} />
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

// Bill Dialog Component
function BillDialog({ 
  open, 
  onOpenChange, 
  bill, 
  onSave, 
  isPending,
  projectId,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  bill: Bill | null;
  onSave: (data: Partial<Bill>) => void;
  isPending: boolean;
  projectId: string;
}) {
  const [formData, setFormData] = useState({
    installer_company: "",
    category: "",
    bill_ref: "",
    bill_amount: "",
    amount_paid: "",
    memo: "",
    attachment_url: null as string | null,
  });
  const [installerSearch, setInstallerSearch] = useState("");
  const [installerOpen, setInstallerOpen] = useState(false);

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

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && bill) {
      setFormData({
        installer_company: bill.installer_company || "",
        category: bill.category || "",
        bill_ref: bill.bill_ref || "",
        bill_amount: bill.bill_amount?.toString() || "",
        amount_paid: bill.amount_paid?.toString() || "",
        memo: bill.memo || "",
        attachment_url: bill.attachment_url || null,
      });
    } else if (newOpen) {
      setFormData({ installer_company: "", category: "", bill_ref: "", bill_amount: "", amount_paid: "", memo: "", attachment_url: null });
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      installer_company: formData.installer_company || null,
      category: formData.category || null,
      bill_ref: formData.bill_ref || null,
      bill_amount: parseFloat(formData.bill_amount) || 0,
      amount_paid: parseFloat(formData.amount_paid) || 0,
      memo: formData.memo || null,
      attachment_url: formData.attachment_url,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
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
              <Input value={formData.category} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Materials, Labor" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bill Amount ($)</Label>
              <Input type="number" value={formData.bill_amount} onChange={(e) => setFormData(p => ({ ...p, bill_amount: e.target.value }))} />
            </div>
            <div>
              <Label>Amount Paid ($)</Label>
              <Input type="number" value={formData.amount_paid} onChange={(e) => setFormData(p => ({ ...p, amount_paid: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Bill Reference</Label>
            <Input value={formData.bill_ref} onChange={(e) => setFormData(p => ({ ...p, bill_ref: e.target.value }))} placeholder="Invoice/PO number" />
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
              <Input value={formData.agreement_number} onChange={(e) => setFormData(p => ({ ...p, agreement_number: e.target.value }))} />
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
