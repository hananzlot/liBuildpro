import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
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
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch banks
  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Reset form when payable changes
  useEffect(() => {
    if (payable) {
      setPaymentDate(new Date());
      setAmount((payable.scheduled_payment_amount || payable.amount_due).toString());
      setBankName("");
      setPaymentMethod("");
      setPaymentReference("");
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

          {/* Bank Account */}
          <div className="space-y-2">
            <Label>Bank Account <span className="text-destructive">*</span></Label>
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger className={cn(!bankName && "border-destructive/50")}>
                <SelectValue placeholder="Select bank account..." />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {banks.length === 0 ? (
                  <SelectItem value="__no_banks__" disabled>No banks configured</SelectItem>
                ) : (
                  banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.name}>
                      {bank.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
