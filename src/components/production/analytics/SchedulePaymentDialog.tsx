import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar as CalendarIcon, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { PayableWithCashImpact } from "@/hooks/useProductionAnalytics";

interface SchedulePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableWithCashImpact | null;
  onSave: (billId: string, date: Date, amount: number) => void;
}

export function SchedulePaymentDialog({
  open,
  onOpenChange,
  payable,
  onSave,
}: SchedulePaymentDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    payable?.scheduled_payment_date ? new Date(payable.scheduled_payment_date) : new Date()
  );
  const [amount, setAmount] = useState<string>(
    payable?.scheduled_payment_amount?.toString() || payable?.amount_due.toString() || ""
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Reset when payable changes
  useEffect(() => {
    if (payable) {
      setDate(payable.scheduled_payment_date ? new Date(payable.scheduled_payment_date) : new Date());
      setAmount(payable.scheduled_payment_amount?.toString() || payable.amount_due.toString());
    }
  }, [payable]);

  if (!payable) return null;

  const paymentAmount = parseFloat(amount) || 0;
  const projectedCash = payable.project_current_cash - paymentAmount;
  const isNegative = projectedCash < 0;

  const handleSave = () => {
    if (date && paymentAmount > 0) {
      onSave(payable.id, date, paymentAmount);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Payment</DialogTitle>
          <DialogDescription>
            Schedule a payment date for this bill
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
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                  initialFocus
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
              max={payable.amount_due}
            />
            <p className="text-xs text-muted-foreground">
              Full balance: {formatCurrency(payable.amount_due)}
            </p>
          </div>

          {/* Cash Impact Preview */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium">Cash Impact Preview</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Current Project Cash:</span>
              </div>
              <div className={cn(
                "text-right font-medium",
                payable.project_current_cash >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {formatCurrency(payable.project_current_cash)}
              </div>
              <div>
                <span className="text-muted-foreground">Payment Amount:</span>
              </div>
              <div className="text-right font-medium text-red-600">
                -{formatCurrency(paymentAmount)}
              </div>
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Projected Cash:</span>
              </div>
              <div className={cn(
                "text-right font-medium pt-2 border-t",
                projectedCash >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {formatCurrency(projectedCash)}
              </div>
            </div>

            {/* Warning/Success */}
            {isNegative ? (
              <Badge variant="outline" className="w-full justify-center bg-red-500/10 text-red-600 border-red-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                This payment will result in negative project cash
              </Badge>
            ) : (
              <Badge variant="outline" className="w-full justify-center bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Project cash will remain positive
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!date || paymentAmount <= 0}>
            Schedule Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
