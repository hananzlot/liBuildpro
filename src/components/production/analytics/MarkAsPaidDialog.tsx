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
import { Calendar as CalendarIcon, Plus, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { PayableWithCashImpact } from "@/hooks/useProductionAnalytics";
import { supabase } from "@/integrations/supabase/client";

interface MarkAsPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableWithCashImpact | null;
  onSave: (billId: string, data: {
    paymentDate: Date;
    amount: number;
    bankName: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
  }) => void;
}

export function MarkAsPaidDialog({
  open,
  onOpenChange,
  payable,
  onSave,
}: MarkAsPaidDialogProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

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

  // Mutation to add new bank
  const addBankMutation = useMutation({
    mutationFn: async (newBankName: string) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase
        .from("banks")
        .insert({ name: newBankName, company_id: companyId })
        .select()
        .single();
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
    },
  });

  const handleAddBank = (newBankName: string) => {
    setBankName(newBankName);
    addBankMutation.mutate(newBankName);
    setBankOpen(false);
    setBankSearch("");
  };

  const filteredBanks = banks.filter(bank => 
    bank.name && bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Reset form when payable changes
  useEffect(() => {
    if (payable) {
      setPaymentDate(new Date());
      setAmount((payable.scheduled_payment_amount || payable.amount_due).toString());
      setBankName("");
      setPaymentMethod("");
      setPaymentReference("");
      setBankSearch("");
    }
  }, [payable]);

  if (!payable) return null;

  const isFormValid = 
    paymentDate && 
    parseFloat(amount) > 0 && 
    bankName && 
    paymentMethod && 
    paymentReference.trim();

  const handleSave = () => {
    const paymentAmount = parseFloat(amount) || 0;
    if (paymentAmount > 0 && bankName && paymentMethod && paymentReference.trim()) {
      onSave(payable.id, {
        paymentDate,
        amount: paymentAmount,
        bankName,
        paymentMethod,
        paymentReference: paymentReference.trim(),
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this bill
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bill Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Project:</span>
              <span className="font-medium">#{payable.project_number} - {payable.project_address || payable.project_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vendor:</span>
              <span className="font-medium">{payable.vendor || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bill Ref:</span>
              <span className="font-medium">{payable.bill_ref || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Due:</span>
              <span className="font-medium">{formatCurrency(payable.amount_due)}</span>
            </div>
            {payable.scheduled_payment_amount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Scheduled Amount:</span>
                <span className="font-medium text-primary">{formatCurrency(payable.scheduled_payment_amount)}</span>
              </div>
            )}
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
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min={0}
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
                  className={cn("w-full justify-between font-normal", !bankName && "border-destructive/50")}
                >
                  {bankName || "Select or add bank..."}
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
                            setBankName(bank.name);
                            setBankOpen(false);
                            setBankSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", bankName === bank.name ? "opacity-100" : "opacity-0")} />
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
