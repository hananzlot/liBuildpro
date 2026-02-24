import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyWithDecimals } from "@/lib/utils";

interface LinkBillToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: {
    id: string;
    vendor: string | null;
    bill_ref: string | null;
    amount_due: number;
    total_bill: number;
  } | null;
}

export function LinkBillToProjectDialog({ open, onOpenChange, bill }: LinkBillToProjectDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-for-linking", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("project_number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const filtered = useMemo(() => {
    if (!search) return projects.slice(0, 50);
    const lower = search.toLowerCase();
    return projects.filter(p =>
      p.project_name?.toLowerCase().includes(lower) ||
      p.project_address?.toLowerCase().includes(lower) ||
      String(p.project_number).includes(lower) ||
      `${p.customer_first_name || ''} ${p.customer_last_name || ''}`.toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [projects, search]);

  const linkMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!bill) return;
      const { error } = await supabase
        .from("project_bills")
        .update({ project_id: projectId })
        .eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill linked to project successfully");
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-ap-due"] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(`Failed to link: ${error.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Bill to Project
          </DialogTitle>
          <DialogDescription>
            {bill && (
              <>
                <span className="font-medium text-foreground">{bill.vendor || 'Unknown Vendor'}</span>
                {bill.bill_ref && <span> — Ref: {bill.bill_ref}</span>}
                <span> — {formatCurrencyWithDecimals(bill.total_bill)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by project name, address, number, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading projects...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No projects found</div>
            ) : (
              <div className="divide-y">
                {filtered.map((project) => (
                  <button
                    key={project.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    onClick={() => linkMutation.mutate(project.id)}
                    disabled={linkMutation.isPending}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          #{project.project_number} — {project.project_name}
                        </div>
                        {project.project_address && (
                          <div className="text-xs text-muted-foreground truncate">{project.project_address}</div>
                        )}
                        {(project.customer_first_name || project.customer_last_name) && (
                          <div className="text-xs text-muted-foreground">
                            {[project.customer_first_name, project.customer_last_name].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 ml-2 h-7 text-xs">
                        Link
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
