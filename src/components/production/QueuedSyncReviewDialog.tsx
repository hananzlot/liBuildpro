import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowUpDown, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface QueuedEntry {
  id: string;
  record_type: string;
  quickbooks_id: string | null;
  record_id: string;
  sync_error: string | null;
  synced_at: string | null;
  qb_doc_number: string | null;
  // Enriched fields
  description?: string;
  amount?: number;
  direction?: string; // "inbound" (from QB) or "outbound" (to QB)
}

interface QueuedSyncReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyId: string;
  entries: QueuedEntry[];
  onComplete: (approved: boolean) => void;
}

const recordTypeLabels: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  bill: "Bill",
  bill_payment: "Bill Payment",
};

const recordTypeBadgeVariant: Record<string, string> = {
  invoice: "default",
  payment: "secondary",
  bill: "outline",
  bill_payment: "outline",
};

export function QueuedSyncReviewDialog({
  open,
  onOpenChange,
  projectId,
  companyId,
  entries,
  onComplete,
}: QueuedSyncReviewDialogProps) {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrichedEntries, setEnrichedEntries] = useState<QueuedEntry[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  // Select all by default
  useEffect(() => {
    if (open && entries.length > 0) {
      setSelectedIds(new Set(entries.map((e) => e.id)));
      enrichEntries(entries);
    }
  }, [open, entries]);

  async function enrichEntries(rawEntries: QueuedEntry[]) {
    setIsEnriching(true);
    const enriched: QueuedEntry[] = [];

    for (const entry of rawEntries) {
      const e = { ...entry };

      try {
        if (entry.record_type === "invoice" && entry.record_id) {
          const { data } = await supabase
            .from("project_invoices")
            .select("invoice_number, amount, description")
            .eq("id", entry.record_id)
            .maybeSingle();
          if (data) {
            e.description = `Invoice #${data.invoice_number || "—"}${data.description ? ` — ${data.description}` : ""}`;
            e.amount = data.amount ?? undefined;
          }
        } else if (entry.record_type === "payment" && entry.record_id) {
          const { data } = await supabase
            .from("project_payments")
            .select("payment_amount, payment_method, payment_reference")
            .eq("id", entry.record_id)
            .maybeSingle();
          if (data) {
            e.description = `Payment${data.payment_reference ? ` #${data.payment_reference}` : ""}${data.payment_method ? ` (${data.payment_method})` : ""}`;
            e.amount = data.payment_amount ?? undefined;
          }
        } else if (entry.record_type === "bill" && entry.record_id) {
          const { data } = await supabase
            .from("project_bills")
            .select("bill_number, bill_amount, vendor_name")
            .eq("id", entry.record_id)
            .maybeSingle();
          if (data) {
            e.description = `Bill #${data.bill_number || "—"}${data.vendor_name ? ` — ${data.vendor_name}` : ""}`;
            e.amount = data.bill_amount ?? undefined;
          }
        } else if (entry.record_type === "bill_payment" && entry.record_id) {
          const { data } = await supabase
            .from("bill_payments")
            .select("payment_amount, payment_method, payment_reference")
            .eq("id", entry.record_id)
            .maybeSingle();
          if (data) {
            e.description = `Bill Payment${data.payment_reference ? ` #${data.payment_reference}` : ""}`;
            e.amount = data.payment_amount ?? undefined;
          }
        }
      } catch {
        // Enrichment is best-effort
      }

      // Determine direction from sync_error message
      e.direction = entry.sync_error?.includes("from QB") || entry.quickbooks_id ? "inbound" : "outbound";
      enriched.push(e);
    }

    setEnrichedEntries(enriched);
    setIsEnriching(false);
  }

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const approved = entries.filter((e) => selectedIds.has(e.id));
      const dismissed = entries.filter((e) => !selectedIds.has(e.id));

      // Approved entries → pending_refresh
      if (approved.length > 0) {
        const { error } = await supabase
          .from("quickbooks_sync_log")
          .update({
            sync_status: "pending_refresh",
            sync_error: "Auto-sync re-enabled — approved for sync",
          })
          .in("id", approved.map((e) => e.id));
        if (error) throw error;
      }

      // Dismissed entries → sync_dismissed with audit
      if (dismissed.length > 0) {
        const { error } = await supabase
          .from("quickbooks_sync_log")
          .update({
            sync_status: "sync_dismissed" as string,
            sync_error: "Dismissed during auto-sync re-enable review",
            dismissed_by: user?.id ?? null,
            dismissed_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .in("id", dismissed.map((e) => e.id));
        if (error) throw error;
      }

      // Now enable auto-sync on the project
      const { error: projError } = await supabase
        .from("projects")
        .update({ auto_sync_to_quickbooks: true })
        .eq("id", projectId);
      if (projError) throw projError;

      return { approved: approved.length, dismissed: dismissed.length };
    },
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.approved > 0) parts.push(`${result.approved} approved for sync`);
      if (result.dismissed > 0) parts.push(`${result.dismissed} dismissed`);
      toast.success(`Auto-sync enabled. ${parts.join(", ")}`);
      onComplete(true);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to process queued sync entries");
    },
  });

  const handleCancel = () => {
    onComplete(false);
    onOpenChange(false);
  };

  const displayEntries = enrichedEntries.length > 0 ? enrichedEntries : entries;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Queued QuickBooks Changes</DialogTitle>
          <DialogDescription>
            These changes were queued while auto-sync was paused. Select which entries to sync and which to dismiss.
            Dismissed entries will be recorded with your decision for audit purposes.
          </DialogDescription>
        </DialogHeader>

        {isEnriching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading entry details…</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 mb-1">
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selectedIds.size === entries.length ? "Deselect All" : "Select All"}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} of {entries.length} selected for sync
              </span>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
              <div className="divide-y">
                {displayEntries.map((entry) => (
                  <label
                    key={entry.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => toggleEntry(entry.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={recordTypeBadgeVariant[entry.record_type] as "default" | "secondary" | "outline" || "default"} className="text-[10px]">
                          {recordTypeLabels[entry.record_type] || entry.record_type}
                        </Badge>
                        {entry.direction === "inbound" && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ArrowDownToLine className="h-3 w-3" /> From QB
                          </span>
                        )}
                        {entry.direction === "outbound" && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ArrowUpFromLine className="h-3 w-3" /> To QB
                          </span>
                        )}
                        {entry.qb_doc_number && (
                          <span className="text-[10px] text-muted-foreground">
                            QB# {entry.qb_doc_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-0.5 truncate">
                        {entry.description || `${recordTypeLabels[entry.record_type] || entry.record_type} record`}
                      </p>
                      {entry.amount != null && (
                        <p className="text-xs text-muted-foreground">
                          ${entry.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {entry.synced_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Queued: {formatDate(entry.synced_at)}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={confirmMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || isEnriching}
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowUpDown className="h-4 w-4 mr-2" />
            )}
            Confirm & Enable Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
