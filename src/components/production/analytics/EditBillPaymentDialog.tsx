import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar as CalendarIcon, Plus, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { QBDuplicateReviewDialog } from "./QBDuplicateReviewDialog";

interface BillPaymentData {
  id: string;
  payment_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  bank_id: string | null;
  bank_name: string | null;
  payment_reference: string | null;
  bank?: {
    id: string;
    name: string;
  } | null;
  bill?: {
    id: string;
    bill_ref: string | null;
    installer_company: string | null;
    category: string | null;
    project?: {
      id: string;
      project_number: number | null;
      project_name: string | null;
      project_address: string | null;
    } | null;
  } | null;
}

interface EditBillPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: BillPaymentData | null;
  onSuccess?: () => void;
}

export function EditBillPaymentDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: EditBillPaymentDialogProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedBankName, setSelectedBankName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Check");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [qbDuplicateDialogOpen, setQbDuplicateDialogOpen] = useState(false);
  const [qbDuplicateState, setQbDuplicateState] = useState<{
    duplicates: any[];
    localAmount: number;
    localDate: string;
    localReference: string | null;
    paymentId: string;
  } | null>(null);
  const [qbDuplicateLinking, setQbDuplicateLinking] = useState(false);

  // Fetch banks
  const { data: banks = [] } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });


  // Check for QB duplicates and sync after update
  const checkAndSyncToQB = async (paymentId: string, data: { paymentDate: Date; amount: number; paymentReference: string }) => {
    if (!companyId || !payment) return;

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
      const { data: result, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: { companyId, syncType: "bill_payment", recordId: paymentId },
      });
      if (!error && result?.synced > 0) {
        toast.success("Payment synced to QuickBooks");
      } else if (result?.errors?.length) {
        toast.error(`QB sync error: ${result.errors[0]}`, { duration: Infinity });
      }
      return;
    }

    // No existing sync — check for duplicates
    try {
      const { data: dupResult, error: dupError } = await supabase.functions.invoke("quickbooks-find-duplicates", {
        body: {
          companyId,
          recordType: "bill_payment",
          amount: data.amount,
          date: format(data.paymentDate, "yyyy-MM-dd"),
          reference: data.paymentReference || null,
          vendorName: payment.bill?.installer_company || null,
          paymentMethod: paymentMethod || null,
        },
      });

      if (dupError) {
        console.error("Duplicate check failed:", dupError);
        // Fall through to direct sync
      } else if (dupResult?.duplicates?.length > 0) {
        // Show duplicate review dialog
        setQbDuplicateState({
          duplicates: dupResult.duplicates,
          localAmount: data.amount,
          localDate: format(data.paymentDate, "yyyy-MM-dd"),
          localReference: data.paymentReference || null,
          paymentId,
        });
        setQbDuplicateDialogOpen(true);
        return; // Don't close the main dialog yet
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
    }

    // No duplicates found — sync directly
    const { data: result, error } = await supabase.functions.invoke("sync-to-quickbooks", {
      body: { companyId, syncType: "bill_payment", recordId: paymentId },
    });
    if (!error && result?.synced > 0) {
      toast.success("Payment synced to QuickBooks");
    } else if (result?.errors?.length) {
      toast.error(`QB sync error: ${result.errors[0]}`, { duration: Infinity });
    }
  };

  const handleQbDuplicateLink = async (qbId: string, qbReference: string | null) => {
    if (!qbDuplicateState || !companyId) return;
    setQbDuplicateLinking(true);
    try {
      await supabase.from("quickbooks_sync_log").upsert({
        company_id: companyId,
        record_type: "bill_payment",
        record_id: qbDuplicateState.paymentId,
        quickbooks_id: qbId,
        sync_status: "synced",
        synced_at: new Date().toISOString(),
      }, { onConflict: "company_id,record_type,record_id" });
      toast.success("Linked to existing QuickBooks record");
      queryClient.invalidateQueries({ queryKey: ["qb-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["bill-payment-sync-statuses"] });

      // If local has a reference that differs from QB's, push it to QB
      const localRef = qbDuplicateState.localReference;
      if (localRef && localRef !== qbReference) {
        toast.info("Updating QuickBooks with reference #...");
        const { data: result, error } = await supabase.functions.invoke("sync-to-quickbooks", {
          body: { companyId, syncType: "bill_payment", recordId: qbDuplicateState.paymentId },
        });
        if (!error && result?.synced > 0) {
          toast.success("Reference # updated in QuickBooks");
        } else if (result?.errors?.length) {
          toast.error(`QB update error: ${result.errors[0]}`, { duration: Infinity });
        }
      }
    } catch (err) {
      console.error("Failed to link QB record:", err);
      toast.error("Failed to link to QuickBooks record");
    } finally {
      setQbDuplicateLinking(false);
      setQbDuplicateDialogOpen(false);
      setQbDuplicateState(null);
    }
  };

  const handleQbDuplicateCreateNew = async () => {
    if (!qbDuplicateState || !companyId) return;
    setQbDuplicateDialogOpen(false);
    setQbDuplicateState(null);
    const { data: result, error } = await supabase.functions.invoke("sync-to-quickbooks", {
      body: { companyId, syncType: "bill_payment", recordId: qbDuplicateState.paymentId },
    });
    if (!error && result?.synced > 0) {
      toast.success("Payment synced to QuickBooks");
    } else if (result?.errors?.length) {
      toast.error(`QB sync error: ${result.errors[0]}`, { duration: Infinity });
    }
  };

  // Update payment mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { paymentDate: Date; amount: number; bankId: string | null; bankName: string; paymentMethod: string; paymentReference: string }) => {
      if (!payment) throw new Error("No payment to update");
      const { error } = await supabase
        .from("bill_payments")
        .update({
          payment_date: format(data.paymentDate, 'yyyy-MM-dd'),
          payment_amount: data.amount,
          bank_id: data.bankId,
          bank_name: data.bankName,
          payment_method: data.paymentMethod,
          payment_reference: data.paymentReference,
        })
        .eq("id", payment.id);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Payment updated");
      queryClient.invalidateQueries({ queryKey: ["paid-bills"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
      onSuccess?.();
      onOpenChange(false);
      // Trigger QB sync check in the background
      if (payment) {
        checkAndSyncToQB(payment.id, data);
      }
    },
    onError: (error) => toast.error(`Failed to update: ${error.message}`),
  });

  // Delete payment mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!payment) throw new Error("No payment to delete");
      const { error } = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", payment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment deleted");
      queryClient.invalidateQueries({ queryKey: ["paid-bills"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
      onSuccess?.();
      onOpenChange(false);
      setDeleteConfirmOpen(false);
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const handleAddBank = async (newBankName: string) => {
    const { data: newBank, error } = await supabase
      .from("banks")
      .insert({ name: newBankName, company_id: companyId })
      .select()
      .single();
    
    if (!error && newBank) {
      setSelectedBankId(newBank.id);
      setSelectedBankName(newBank.name);
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
    } else if (error && !error.message.includes('duplicate')) {
      const existing = banks.find(b => b.name?.toLowerCase() === newBankName.toLowerCase());
      if (existing) {
        setSelectedBankId(existing.id);
        setSelectedBankName(existing.name);
      }
    }
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = banks.filter(bank => 
    bank.name && bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Reset form when payment changes or dialog opens
  useEffect(() => {
    if (open && payment) {
      setPaymentDate(payment.payment_date ? parseISO(payment.payment_date) : new Date());
      setAmount((payment.payment_amount || 0).toString());
      // Use bank FK if available, fallback to legacy bank_name
      const bankId = payment.bank_id || payment.bank?.id || null;
      const bankName = payment.bank?.name || payment.bank_name || "";
      setSelectedBankId(bankId);
      setSelectedBankName(bankName);
      setPaymentMethod(payment.payment_method || "Check");
      setPaymentReference(payment.payment_reference || "");
      setBankSearch("");
    }
  }, [open, payment]);

  if (!payment) return null;

  const paymentAmount = parseFloat(amount) || 0;
  const isFormValid = 
    paymentDate && 
    paymentAmount > 0 && 
    selectedBankId && 
    paymentMethod && 
    paymentReference.trim();

  const handleSave = () => {
    if (!isFormValid) return;
    updateMutation.mutate({
      paymentDate,
      amount: paymentAmount,
      bankId: selectedBankId,
      bankName: selectedBankName,
      paymentMethod,
      paymentReference: paymentReference.trim(),
    });
  };

  const project = payment.bill?.project;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update or delete this payment record
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Bill Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">
                  {project?.project_number ? `#${project.project_number}` : '-'} - {project?.project_address || project?.project_name || '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendor:</span>
                <span className="font-medium">{payment.bill?.installer_company || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bill Ref:</span>
                <span className="font-medium">{payment.bill?.bill_ref || '-'}</span>
              </div>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(d) => {
                      if (d) setPaymentDate(d);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Payment Amount */}
            <div className="space-y-2">
              <Label>Payment Amount</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val); }}
                placeholder="Enter amount"
              />
            </div>

            {/* Bank Account with add on the fly */}
            <div className="space-y-2">
              <Label>Bank Account <span className="text-destructive">*</span></Label>
              <Popover open={bankOpen} onOpenChange={setBankOpen}>
              <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankOpen}
                    className={cn("w-full justify-between font-normal", !selectedBankId && "border-destructive/50")}
                  >
                    {selectedBankName || "Select or add bank..."}
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
                        {bankSearch && !filteredBanks.some(b => b.name?.toLowerCase() === bankSearch.toLowerCase()) && (
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
                              setSelectedBankId(bank.id);
                              setSelectedBankName(bank.name);
                              setBankOpen(false);
                              setBankSearch("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedBankId === bank.id ? "opacity-100" : "opacity-0")} />
                            {bank.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Payment Method & Reference - same row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method <span className="text-destructive">*</span></Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className={cn(!paymentMethod && "border-destructive/50")}>
                    <SelectValue placeholder="Select method..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="Wire">Wire</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reference <span className="text-destructive">*</span></Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Check #, confirmation..."
                  className={cn(!paymentReference.trim() && "border-destructive/50")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!isFormValid || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment record. The bill will become outstanding again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QB Duplicate Review Dialog */}
      {qbDuplicateState && (
        <QBDuplicateReviewDialog
          open={qbDuplicateDialogOpen}
          onOpenChange={setQbDuplicateDialogOpen}
          duplicates={qbDuplicateState.duplicates}
          recordType="bill_payment"
          localAmount={qbDuplicateState.localAmount}
          localDate={qbDuplicateState.localDate}
          localReference={qbDuplicateState.localReference}
          onLink={handleQbDuplicateLink}
          onCreateNew={handleQbDuplicateCreateNew}
          onCancel={() => {
            setQbDuplicateDialogOpen(false);
            setQbDuplicateState(null);
          }}
          isLinking={qbDuplicateLinking}
        />
      )}
    </>
  );
}
