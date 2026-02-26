import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar as CalendarIcon, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PayableWithCashImpact } from "@/hooks/useProductionAnalytics";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { useDiscardConfirm } from "@/hooks/useDiscardConfirm";

interface SchedulePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableWithCashImpact | null;
  allPayables?: PayableWithCashImpact[];
  scheduledDateFilter?: Date;
  onSave: (billId: string, date: Date, amount: number) => void;
  onDelete?: (billId: string) => void;
}

interface DraftValues {
  dateISO: string;
  amount: string;
}

export function SchedulePaymentDialog({
  open,
  onOpenChange,
  payable,
  allPayables = [],
  scheduledDateFilter,
  onSave,
  onDelete,
}: SchedulePaymentDialogProps) {
  const initialDraft: DraftValues = {
    dateISO: payable?.scheduled_payment_date
      ? new Date(payable.scheduled_payment_date).toISOString()
      : new Date().toISOString(),
    amount: payable?.scheduled_payment_amount?.toString() || payable?.amount_due.toString() || "",
  };

  const { draft, updateDraft, clearDraft, isDirty } = usePersistentDraft<DraftValues>(
    "schedule-payment",
    initialDraft,
    payable?.id,
    open
  );

  const [calendarOpen, setCalendarOpen] = useState(false);

  const date = draft.dateISO ? new Date(draft.dateISO) : undefined;

  // Reset draft when payable changes
  useEffect(() => {
    if (payable && open) {
      const newInitial: DraftValues = {
        dateISO: payable.scheduled_payment_date
          ? new Date(payable.scheduled_payment_date).toISOString()
          : new Date().toISOString(),
        amount: payable.scheduled_payment_amount?.toString() || payable.amount_due.toString(),
      };
      // Only reset if there's no existing draft for this record
      try {
        const existing = sessionStorage.getItem(`draft:schedule-payment:${payable.id}`);
        if (!existing) {
          updateDraft(newInitial);
        }
      } catch {
        updateDraft(newInitial);
      }
    }
  }, [payable?.id]);

  const handleClose = useCallback(() => {
    clearDraft();
    onOpenChange(false);
  }, [clearDraft, onOpenChange]);

  const { showConfirm, handleOpenChange, confirmDiscard, cancelDiscard } =
    useDiscardConfirm(isDirty, handleClose, () => onOpenChange(true));

  if (!payable) return null;

  const paymentAmount = parseFloat(draft.amount) || 0;
  
  const otherScheduledPayments = allPayables
    .filter(p => {
      if (p.project_id !== payable.project_id || p.id === payable.id || !p.scheduled_payment_date) {
        return false;
      }
      if (scheduledDateFilter) {
        const scheduledDate = parseISO(p.scheduled_payment_date);
        return scheduledDate <= scheduledDateFilter;
      }
      return true;
    })
    .reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0);
  
  const projectedCash = payable.project_current_cash - paymentAmount - otherScheduledPayments;
  const isNegative = projectedCash < 0;

  const handleSave = () => {
    if (date && paymentAmount > 0) {
      onSave(payable.id, date, paymentAmount);
      clearDraft();
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                      if (d) updateDraft({ dateISO: d.toISOString() });
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
                type="text"
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) updateDraft({ amount: val }); }}
                placeholder="Enter amount"
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
                {otherScheduledPayments > 0 && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Other Scheduled Payments:</span>
                    </div>
                    <div className="text-right font-medium text-red-600">
                      -{formatCurrency(otherScheduledPayments)}
                    </div>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">This Payment:</span>
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              {payable.scheduled_payment_date && onDelete && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    onDelete(payable.id);
                    clearDraft();
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!date || paymentAmount <= 0}>
                Schedule Payment
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={(v) => !v && cancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved payment details. Discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
