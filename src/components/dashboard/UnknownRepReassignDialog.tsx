import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
}

interface UnknownRepReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: Opportunity[];
}

interface Salesperson {
  id: string;
  name: string;
  ghl_user_id: string | null;
}

const isUnresolvedId = (name: string | null) => {
  if (!name) return false;
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) ||
    /^[A-Za-z0-9]{20,}$/.test(name)
  );
};

function formatCurrency(value: number | null): string {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function UnknownRepReassignDialog({
  open,
  onOpenChange,
  opportunities,
}: UnknownRepReassignDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Fetch active salespeople for this company
  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-for-reassign", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name, ghl_user_id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Salesperson[];
    },
    enabled: open && !!companyId,
  });

  // Filter opportunities that have unresolved assigned_to
  const unresolvedOpps = useMemo(() => {
    return opportunities.filter((o) => isUnresolvedId(o.assigned_to));
  }, [opportunities]);

  const handleAssign = async (opp: Opportunity) => {
    const salespersonId = assignments[opp.id];
    if (!salespersonId) return;

    const salesperson = salespeople.find((s) => s.id === salespersonId);
    if (!salesperson) return;

    setSaving(opp.id);
    try {
      // Update the opportunity's assigned_to to the salesperson's internal UUID
      const newAssignedTo = salesperson.id;

      const { error } = await supabase
        .from("opportunities")
        .update({ assigned_to: newAssignedTo })
        .eq("id", opp.id);

      if (error) throw error;

      toast.success(`Reassigned to ${salesperson.name}`);

      // Invalidate dashboard queries to refresh
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });

      // Clear this assignment from local state
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[opp.id];
        return next;
      });
    } catch (err: any) {
      toast.error(`Failed to reassign: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Unknown Rep — Reassign Opportunities
          </DialogTitle>
          <DialogDescription>
            These opportunities are assigned to salespeople outside this company.
            Reassign them to an active rep.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-2">
            {unresolvedOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                All opportunities have been reassigned!
              </p>
            ) : (
              unresolvedOpps.map((opp) => (
                <div
                  key={opp.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {opp.name || "Untitled"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            opp.status?.toLowerCase() === "won"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {opp.status || "unknown"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(opp.monetary_value)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={assignments[opp.id] || ""}
                      onValueChange={(val) =>
                        setAssignments((prev) => ({ ...prev, [opp.id]: val }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Select sales rep..." />
                      </SelectTrigger>
                      <SelectContent>
                        {salespeople.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 text-xs gap-1"
                      disabled={!assignments[opp.id] || saving === opp.id}
                      onClick={() => handleAssign(opp)}
                    >
                      {saving === opp.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      Assign
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
