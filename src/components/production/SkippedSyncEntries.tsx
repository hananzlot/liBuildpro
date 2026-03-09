import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { ChevronDown, ChevronRight, Undo2, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";

interface SkippedSyncEntriesProps {
  projectId: string;
  companyId: string;
}

interface DismissedEntry {
  id: string;
  record_type: string;
  quickbooks_id: string | null;
  record_id: string;
  sync_error: string | null;
  synced_at: string | null;
  qb_doc_number: string | null;
  dismissed_at: string | null;
  dismissed_by: string | null;
  // Enriched
  description?: string;
  amount?: number;
  dismissedByName?: string;
}

const recordTypeLabels: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  bill: "Bill",
  bill_payment: "Bill Payment",
};

export function SkippedSyncEntries({ projectId, companyId }: SkippedSyncEntriesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);

  // Fetch all dismissed sync entries for this project
  const { data: dismissedEntries = [], isLoading } = useQuery({
    queryKey: ["dismissed-sync-entries", projectId],
    queryFn: async () => {
      // Get all record IDs for this project
      const [invoices, payments, bills] = await Promise.all([
        supabase.from("project_invoices").select("id").eq("project_id", projectId),
        supabase.from("project_payments").select("id").eq("project_id", projectId),
        supabase.from("project_bills").select("id").eq("project_id", projectId),
      ]);

      const recordIds = [
        ...(invoices.data || []).map((r) => r.id),
        ...(payments.data || []).map((r) => r.id),
        ...(bills.data || []).map((r) => r.id),
      ];

      // Also get bill payment IDs
      if (bills.data && bills.data.length > 0) {
        const billIds = bills.data.map((b) => b.id);
        const { data: billPayments } = await supabase
          .from("bill_payments")
          .select("id")
          .in("bill_id", billIds);
        (billPayments || []).forEach((r) => recordIds.push(r.id));
      }

      if (recordIds.length === 0) return [];

      const { data: entries } = await supabase
        .from("quickbooks_sync_log")
        .select("id, record_type, quickbooks_id, record_id, sync_error, synced_at, qb_doc_number, dismissed_at, dismissed_by")
        .eq("company_id", companyId)
        .eq("sync_status", "sync_dismissed")
        .in("record_id", recordIds)
        .order("dismissed_at", { ascending: false });

      if (!entries || entries.length === 0) return [];

      // Enrich entries with details
      const enriched: DismissedEntry[] = [];
      for (const entry of entries) {
        const e: DismissedEntry = { ...entry };

        try {
          if (entry.record_type === "invoice") {
            const { data } = await supabase
              .from("project_invoices")
              .select("invoice_number, amount")
              .eq("id", entry.record_id)
              .maybeSingle();
            if (data) {
              e.description = `Invoice #${data.invoice_number || "—"}`;
              e.amount = data.amount ?? undefined;
            }
          } else if (entry.record_type === "payment") {
            const { data } = await supabase
              .from("project_payments")
              .select("payment_amount, payment_method")
              .eq("id", entry.record_id)
              .maybeSingle();
            if (data) {
              e.description = `Payment${data.payment_method ? ` (${data.payment_method})` : ""}`;
              e.amount = data.payment_amount ?? undefined;
            }
          } else if (entry.record_type === "bill") {
            const { data } = await supabase
              .from("project_bills")
              .select("bill_ref, bill_amount, installer_company")
              .eq("id", entry.record_id)
              .maybeSingle();
            if (data) {
              e.description = `Bill #${data.bill_ref || "—"}${data.installer_company ? ` — ${data.installer_company}` : ""}`;
              e.amount = data.bill_amount ?? undefined;
            }
          } else if (entry.record_type === "bill_payment") {
            const { data } = await supabase
              .from("bill_payments")
              .select("payment_amount, payment_reference")
              .eq("id", entry.record_id)
              .maybeSingle();
            if (data) {
              e.description = `Bill Payment${data.payment_reference ? ` #${data.payment_reference}` : ""}`;
              e.amount = data.payment_amount ?? undefined;
            }
          }

          // Get dismisser's name
          if (entry.dismissed_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", entry.dismissed_by)
              .maybeSingle();
            if (profile) {
              e.dismissedByName = profile.full_name || profile.email || "Unknown";
            }
          }
        } catch {
          // best-effort enrichment
        }

        enriched.push(e);
      }

      return enriched;
    },
    enabled: !!projectId && !!companyId,
    staleTime: 60000,
  });

  // Undo dismissal — re-queue for sync
  const undoMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("quickbooks_sync_log")
        .update({
          sync_status: "pending_refresh",
          sync_error: "Dismissal reversed — now pending sync",
          dismissed_by: null,
          dismissed_at: null,
        } as Record<string, unknown>)
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry restored — will sync on next refresh");
      queryClient.invalidateQueries({ queryKey: ["dismissed-sync-entries", projectId] });
      setUndoConfirmId(null);
    },
    onError: () => {
      toast.error("Failed to restore entry");
    },
  });

  if (dismissedEntries.length === 0) return null;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Skipped QB Sync ({dismissedEntries.length})
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 space-y-1 pl-2">
          {dismissedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/30 border border-dashed"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {recordTypeLabels[entry.record_type] || entry.record_type}
                  </Badge>
                  {entry.qb_doc_number && (
                    <span className="text-[10px] text-muted-foreground">QB# {entry.qb_doc_number}</span>
                  )}
                </div>
                <p className="text-xs font-medium mt-0.5 truncate">
                  {entry.description || `${recordTypeLabels[entry.record_type]} record`}
                </p>
                {entry.amount != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(entry.amount)}
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Dismissed {entry.dismissed_at ? formatDate(entry.dismissed_at) : ""}
                  {entry.dismissedByName ? ` by ${entry.dismissedByName}` : ""}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setUndoConfirmId(entry.id)}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore and sync this entry</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!undoConfirmId} onOpenChange={(open) => { if (!open) setUndoConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Sync Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the entry as pending sync. It will be processed on the next QuickBooks refresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => undoConfirmId && undoMutation.mutate(undoConfirmId)}
              disabled={undoMutation.isPending}
            >
              {undoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
