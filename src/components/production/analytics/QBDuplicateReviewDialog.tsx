import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Link2, Loader2, PlusCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export interface QBDuplicateCandidate {
  qbId: string;
  qbSyncToken: string;
  amount: number;
  date: string;
  reference: string | null;
  vendorName: string | null;
  vendorId: string | null;
  payType: string | null;
  confidence: "high" | "medium" | "low";
  matchReasons: string[];
}

interface QBDuplicateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: QBDuplicateCandidate[];
  recordType: string;
  localAmount: number;
  localDate: string;
  localReference: string | null;
  /** User chose to link to an existing QB record */
  onLink: (qbId: string) => void;
  /** User chose to create a new record in QB */
  onCreateNew: () => void;
  /** User cancelled */
  onCancel: () => void;
  isLinking?: boolean;
}

const confidenceColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  medium: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  low: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
};

export function QBDuplicateReviewDialog({
  open,
  onOpenChange,
  duplicates,
  recordType,
  localAmount,
  localDate,
  localReference,
  onLink,
  onCreateNew,
  onCancel,
  isLinking,
}: QBDuplicateReviewDialogProps) {
  const [selectedQbId, setSelectedQbId] = useState<string | null>(null);

  const handleLink = () => {
    if (selectedQbId) onLink(selectedQbId);
  };

  const recordLabel = recordType === "bill_payment" ? "Bill Payment" : recordType;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Potential Duplicate{duplicates.length > 1 ? "s" : ""} Found in QuickBooks
          </DialogTitle>
          <DialogDescription>
            We found {duplicates.length} existing {recordLabel.toLowerCase()}(s) in QuickBooks that may match your record.
            You can <strong>link</strong> to an existing one to prevent duplication, or <strong>create a new</strong> record.
          </DialogDescription>
        </DialogHeader>

        {/* Local record summary */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium text-muted-foreground">Your Record:</p>
          <div className="flex flex-wrap gap-3">
            <span>Amount: <strong className="text-foreground">{formatCurrency(localAmount)}</strong></span>
            <span>Date: <strong className="text-foreground">{localDate}</strong></span>
            {localReference && <span>Ref: <strong className="text-foreground">{localReference}</strong></span>}
          </div>
        </div>

        {/* Duplicate candidates */}
        <ScrollArea className="max-h-[40vh]">
          <RadioGroup value={selectedQbId || ""} onValueChange={setSelectedQbId} className="space-y-2">
            {duplicates.map((dup) => (
              <label
                key={dup.qbId}
                htmlFor={`dup-${dup.qbId}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  selectedQbId === dup.qbId
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={dup.qbId} id={`dup-${dup.qbId}`} className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{formatCurrency(dup.amount)}</span>
                    <span className="text-muted-foreground text-xs">on {dup.date}</span>
                    {dup.reference && (
                      <Badge variant="outline" className="text-[10px] font-medium">
                        QB Ref #: {dup.reference}
                      </Badge>
                    )}
                    {dup.payType && (
                      <span className="text-[10px] text-muted-foreground">{dup.payType}</span>
                    )}
                    <Badge className={cn("text-[10px]", confidenceColors[dup.confidence])}>
                      {dup.confidence === "high" ? "Likely Duplicate" : dup.confidence === "medium" ? "Possible Match" : "Weak Match"}
                    </Badge>
                  </div>
                  {dup.vendorName && (
                    <p className="text-xs text-muted-foreground">Vendor: {dup.vendorName}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {dup.matchReasons.map((reason, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">QB ID: {dup.qbId}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLinking}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onCreateNew}
            disabled={isLinking}
            className="gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Create New in QB
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedQbId || isLinking}
            className="gap-1.5"
          >
            {isLinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Link to Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
