import { useState, useMemo, useCallback } from "react";
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
import { formatCurrency } from "@/lib/utils";
import { QBCustomerMappingDialog } from "@/components/production/analytics/QBCustomerMappingDialog";

interface LinkInvoiceToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string | null;
    qb_customer_name: string | null;
    amount: number | null;
    open_balance: number | null;
  } | null;
  isQBConnected?: boolean;
}

export function LinkInvoiceToProjectDialog({ open, onOpenChange, invoice, isQBConnected }: LinkInvoiceToProjectDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [customerMappingOpen, setCustomerMappingOpen] = useState(false);
  const [projectForMapping, setProjectForMapping] = useState<{ id: string; name: string } | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-for-linking", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, contact_uuid")
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

  // After linking invoice to project, check if project needs QB customer mapping
  const checkAndPromptCustomerMapping = useCallback(async (projectId: string, projectName: string) => {
    if (!isQBConnected || !companyId) {
      onOpenChange(false);
      return;
    }

    // Check if project already has a customer mapping
    const { data: existingMapping } = await supabase
      .from("quickbooks_mappings")
      .select("qbo_id")
      .eq("company_id", companyId)
      .eq("mapping_type", "project_customer")
      .eq("source_value", projectId)
      .maybeSingle();

    if (existingMapping?.qbo_id) {
      onOpenChange(false);
      return;
    }

    // Also check via contact_uuid customer mapping
    const project = projects.find(p => p.id === projectId);
    if (project?.contact_uuid) {
      const { data: contactMapping } = await supabase
        .from("quickbooks_mappings")
        .select("qbo_id")
        .eq("company_id", companyId)
        .eq("mapping_type", "customer")
        .eq("source_value", project.contact_uuid)
        .maybeSingle();

      if (contactMapping?.qbo_id) {
        onOpenChange(false);
        return;
      }
    }

    // No mapping found — prompt user
    setProjectForMapping({ id: projectId, name: projectName });
    onOpenChange(false);
    setCustomerMappingOpen(true);
  }, [isQBConnected, companyId, projects, onOpenChange]);

  const linkMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!invoice) return;
      const { error } = await supabase
        .from("project_invoices")
        .update({ project_id: projectId })
        .eq("id", invoice.id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      toast.success("Invoice linked to project successfully");
      queryClient.invalidateQueries({ queryKey: ["analytics-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      const project = projects.find(p => p.id === projectId);
      if (projectId && project) {
        checkAndPromptCustomerMapping(projectId, project.project_name || '');
      } else {
        onOpenChange(false);
      }
    },
    onError: (error) => toast.error(`Failed to link: ${error.message}`),
  });

  const handleCustomerMappingComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["quickbooks-mappings"] });
    queryClient.invalidateQueries({ queryKey: ["qb-mappings"] });
    setCustomerMappingOpen(false);
    setProjectForMapping(null);
  }, [queryClient]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Invoice to Project
            </DialogTitle>
            <DialogDescription>
              {invoice && (
                <>
                  <span className="font-medium text-foreground">{invoice.qb_customer_name || 'Unknown Customer'}</span>
                  {invoice.invoice_number && <span> — #{invoice.invoice_number}</span>}
                  <span> — {formatCurrency(invoice.amount || 0)}</span>
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

      {/* Customer Mapping Dialog - opens after project linking if QB is connected and customer unmapped */}
      {projectForMapping && (
        <QBCustomerMappingDialog
          open={customerMappingOpen}
          onOpenChange={(open) => {
            setCustomerMappingOpen(open);
            if (!open) setProjectForMapping(null);
          }}
          projectId={projectForMapping.id}
          projectName={projectForMapping.name}
          customerName={null}
          projectAddress={null}
          onMapped={() => {
            handleCustomerMappingComplete();
          }}
          onSkipSync={() => {
            setCustomerMappingOpen(false);
            setProjectForMapping(null);
          }}
          onCancel={() => {
            setCustomerMappingOpen(false);
            setProjectForMapping(null);
          }}
        />
      )}
    </>
  );
}
