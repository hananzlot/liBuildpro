import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrencyWithDecimals } from "@/lib/utils";

interface QBBill {
  qbBillId: string;
  docNumber: string;
  txnDate: string;
  dueDate: string | null;
  totalAmt: number;
  balance: number;
  memo: string | null;
  customerId?: string | null;
  customerName?: string | null;
}

interface QBBillSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  localBillRef: string | null;
  localBillAmount: number;
  projectId?: string | null;
  onSelect: (qbBillId: string, qbDocNumber: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function QBBillSelectionDialog({
  open,
  onOpenChange,
  vendorName,
  localBillRef,
  localBillAmount,
  projectId,
  onSelect,
  onCreateNew,
  onCancel,
}: QBBillSelectionDialogProps) {
  const { companyId } = useCompanyContext();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"select" | "create" | null>(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  // Fetch unpaid QB bills for this vendor (optionally filtered by project customer)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["qb-vendor-bills", companyId, vendorName, projectId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-vendor-bills", {
        body: { companyId, vendorName, projectId },
      });
      if (error) throw error;
      
      // Check for API-level errors (200 response with success: false)
      if (data && data.success === false && data.error) {
        throw new Error(data.error);
      }
      
      return data as {
        success: boolean;
        vendorFound: boolean;
        vendorId: string | null;
        bills: QBBill[];
        projectCustomerId?: string | null;
        projectCustomerName?: string | null;
        hasProjectMapping?: boolean;
        customerFilterWarning?: string | null;
        error?: string;
        message?: string;
      };
    },
    enabled: open && !!companyId && !!vendorName,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Auto-select bill matching local bill_ref when data loads
  useEffect(() => {
    if (data?.bills && data.bills.length > 0 && !selectedBillId) {
      // Try to find a bill with matching docNumber to localBillRef
      const matchingBill = localBillRef
        ? data.bills.find((b) => b.docNumber === localBillRef)
        : null;
      
      if (matchingBill) {
        setSelectedBillId(matchingBill.qbBillId);
      } else {
        // Default to first bill if no match
        setSelectedBillId(data.bills[0].qbBillId);
      }
    }
  }, [data?.bills, localBillRef, selectedBillId]);

  // Reset selection and submitting state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBillId(null);
      setSubmittingAction(null);
      setShowCreateConfirm(false);
    }
  }, [open]);

  const selectedBill = useMemo(() => {
    return data?.bills?.find((b) => b.qbBillId === selectedBillId);
  }, [data?.bills, selectedBillId]);

  const handleSelect = () => {
    if (selectedBill) {
      setSubmittingAction("select");
      onSelect(selectedBill.qbBillId, selectedBill.docNumber);
    }
  };

  // Show confirmation dialog before creating new bill
  const handleCreateNewClick = () => {
    // Close the main dialog first, then show confirmation
    onOpenChange(false);
    // Use setTimeout to ensure the main dialog closes before showing the alert
    setTimeout(() => {
      setShowCreateConfirm(true);
    }, 100);
  };

  // User confirmed creating a new bill
  const handleConfirmCreate = () => {
    setShowCreateConfirm(false);
    setSubmittingAction("create");
    onCreateNew();
  };

  // User cancelled the confirmation - reopen the main dialog
  const handleConfirmCancel = () => {
    setShowCreateConfirm(false);
    onOpenChange(true);
  };

  const isSubmitting = submittingAction !== null;

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const billCount = data?.bills?.length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select QuickBooks Bill
            </DialogTitle>
            <DialogDescription>
              Select which QuickBooks bill this payment should be applied against.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info row */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <span className="ml-2 font-medium">{vendorName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Local Ref:</span>
                <span className="ml-2 font-medium">{localBillRef || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Payment Amount:</span>
                <span className="ml-2 font-medium">{formatCurrencyWithDecimals(localBillAmount)}</span>
              </div>
              {data?.hasProjectMapping && data?.projectCustomerName && (
                <div>
                  <span className="text-muted-foreground">QB Customer:</span>
                  <span className="ml-2 font-medium text-primary">{data.projectCustomerName}</span>
                </div>
              )}
            </div>

            {/* Customer filter warning (fallback to vendor bills) */}
            {!isLoading && data?.customerFilterWarning && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <span>{data.customerFilterWarning}</span>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to fetch bills: {error instanceof Error ? error.message : "Unknown error"}</span>
              </div>
            )}

            {/* Vendor not found */}
            {!isLoading && data && !data.vendorFound && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                <span>Vendor "{vendorName}" not found in QuickBooks. Please check the vendor mapping.</span>
              </div>
            )}

            {/* No bills found */}
            {!isLoading && data?.vendorFound && data.bills.length === 0 && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <span>No unpaid bills found in QuickBooks for this vendor.</span>
              </div>
            )}

            {/* Bills list */}
            {!isLoading && data?.bills && data.bills.length > 0 && (
              <ScrollArea className="h-[280px] pr-4">
                <RadioGroup
                  value={selectedBillId || ""}
                  onValueChange={setSelectedBillId}
                  className="space-y-2"
                >
                  {data.bills.map((bill) => {
                    const isMatch = localBillRef && bill.docNumber === localBillRef;
                    const isSelected = bill.qbBillId === selectedBillId;
                    
                    return (
                      <div
                        key={bill.qbBillId}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedBillId(bill.qbBillId)}
                      >
                        <RadioGroupItem
                          value={bill.qbBillId}
                          id={bill.qbBillId}
                          className="mt-1"
                        />
                        <Label
                          htmlFor={bill.qbBillId}
                          className="flex-1 cursor-pointer space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Bill #{bill.docNumber || "No Ref"}
                            </span>
                            {bill.txnDate && (
                              <span className="text-muted-foreground text-sm">
                                — {format(parseISO(bill.txnDate), "MMM d, yyyy")}
                              </span>
                            )}
                            {isMatch && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Matches local ref
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Amount: {formatCurrencyWithDecimals(bill.totalAmt)}</span>
                            <span>Balance: {formatCurrencyWithDecimals(bill.balance)}</span>
                            {bill.dueDate && (
                              <span>Due: {format(parseISO(bill.dueDate), "MMM d, yyyy")}</span>
                            )}
                          </div>
                          {bill.customerName && (
                            <div className="text-xs text-muted-foreground">
                              Customer: {bill.customerName}
                            </div>
                          )}
                          {bill.memo && (
                            <div className="text-xs text-muted-foreground truncate">
                              {bill.memo}
                            </div>
                          )}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={handleCreateNewClick} 
              disabled={isSubmitting}
            >
              {submittingAction === "create" && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create New Bill in QB
            </Button>
            <Button 
              onClick={handleSelect} 
              disabled={!selectedBillId || !data?.bills?.length || isSubmitting}
            >
              {submittingAction === "select" && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {submittingAction === "select" ? "Processing..." : "Select Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for creating new bill - rendered outside main dialog */}
      <AlertDialog open={showCreateConfirm} onOpenChange={(open) => {
        if (!open) handleConfirmCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Create New Bill in QuickBooks?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to create a <strong>completely new bill</strong> in QuickBooks for this payment.
              </p>
              {billCount > 0 && (
                <p className="text-amber-600 font-medium">
                  There {billCount === 1 ? "is" : "are"} already {billCount} existing bill{billCount === 1 ? "" : "s"} available for this vendor. 
                  Are you sure you don't want to select one of them instead?
                </p>
              )}
              <p className="text-muted-foreground">
                This will create a duplicate if the bill already exists in QuickBooks under a different reference.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel}>No, Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreate}>
              Yes, Create New Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
