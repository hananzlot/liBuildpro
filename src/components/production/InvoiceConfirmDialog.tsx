import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

interface InvoiceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseName: string;
  maxAmount: number;
  onConfirm: (amount: number) => void;
}

export function InvoiceConfirmDialog({
  open,
  onOpenChange,
  phaseName,
  maxAmount,
  onConfirm,
}: InvoiceConfirmDialogProps) {
  const [mode, setMode] = useState<"ask" | "custom">("ask");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setMode("ask");
      setCustomAmount("");
      setError("");
    }
    onOpenChange(val);
  };

  const handleFullAmount = () => {
    onConfirm(maxAmount);
    handleOpenChange(false);
  };

  const handleCustomSubmit = () => {
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid amount greater than $0.");
      return;
    }
    if (parsed > maxAmount + 0.01) {
      setError(`Amount cannot exceed the remaining balance of ${formatCurrency(maxAmount)}.`);
      return;
    }
    setError("");
    onConfirm(Math.min(parsed, maxAmount));
    handleOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create Invoice</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {mode === "ask" ? (
                <span>
                  Do you want to invoice the customer the full progress payment amount of{" "}
                  <strong className="text-foreground">{formatCurrency(maxAmount)}</strong> for{" "}
                  <strong className="text-foreground">{phaseName}</strong>?
                </span>
              ) : (
                <div className="space-y-3">
                  <span>
                    Enter the invoice amount for <strong className="text-foreground">{phaseName}</strong>.
                    <br />
                    Maximum: <strong className="text-foreground">{formatCurrency(maxAmount)}</strong>
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxAmount}
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setError("");
                    }}
                    autoFocus
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {mode === "ask" ? (
            <>
              <Button variant="outline" onClick={() => setMode("custom")}>
                Enter Different Amount
              </Button>
              <Button onClick={handleFullAmount}>Yes, Full Amount</Button>
            </>
          ) : (
            <Button onClick={handleCustomSubmit}>Confirm</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
