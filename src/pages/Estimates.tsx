import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calculator, Send, FileSignature, Plus, Trash2, Edit, Loader2, ExternalLink, Printer, RefreshCw, FileSearch, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EstimateDetailSheet } from "@/components/estimates/EstimateDetailSheet";
import { EstimateBuilderDialog } from "@/components/estimates/EstimateBuilderDialog";
import { SendProposalDialog } from "@/components/estimates/SendProposalDialog";
import { ContractPrintDialog } from "@/components/estimates/ContractPrintDialog";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";

type ViewType = "list" | "proposals" | "contracts" | "declined";

interface Estimate {
  id: string;
  estimate_number: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  estimate_title: string;
  estimate_date: string;
  expiration_date: string | null;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
  signed_at: string | null;
  declined_at: string | null;
  salesperson_name: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  viewed: "bg-purple-500",
  needs_changes: "bg-amber-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  needs_changes: "Needs Changes",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export default function Estimates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get("view") as ViewType) || "list";
  const { isAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [sendDialogEstimate, setSendDialogEstimate] = useState<Estimate | null>(null);
  const [isResendMode, setIsResendMode] = useState(false);
  const [printEstimateId, setPrintEstimateId] = useState<string | null>(null);
  const [previewEstimateId, setPreviewEstimateId] = useState<string | null>(null);

  const handleViewChange = (view: string) => {
    setSearchParams({ view });
  };

  // Fetch estimates
  const { data: estimates, isLoading } = useQuery({
    queryKey: ["estimates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Estimate[];
    },
    enabled: !!companyId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (estimateId: string) => {
      if (!companyId) throw new Error("No company selected");
      // Get all client_portal_tokens for this estimate (we need ids to clean up dependent rows)
      const { data: tokens, error: tokenFetchError } = await supabase
        .from("client_portal_tokens")
        .select("id")
        .eq("estimate_id", estimateId)
        .eq("company_id", companyId);

      if (tokenFetchError) throw tokenFetchError;

      const tokenIds = (tokens || []).map((t) => t.id);

      // FIRST: Delete ALL estimate_signatures for this estimate (before touching tokens)
      // Note: Some signatures may only reference portal_token_id, so we also delete by tokenIds below.
      const { error: sigByEstimateError } = await supabase
        .from("estimate_signatures")
        .delete()
        .eq("estimate_id", estimateId);
      if (sigByEstimateError) throw sigByEstimateError;

      if (tokenIds.length > 0) {
        // Delete any remaining signatures that reference portal tokens (even if estimate_id is null)
        const { error: sigByTokenError } = await supabase
          .from("estimate_signatures")
          .delete()
          .in("portal_token_id", tokenIds);
        if (sigByTokenError) throw sigByTokenError;

        const { error: viewLogsError } = await supabase
          .from("portal_view_logs")
          .delete()
          .in("portal_token_id", tokenIds);
        if (viewLogsError) throw viewLogsError;

        const { error: tokenCommentsError } = await supabase
          .from("client_comments")
          .delete()
          .in("portal_token_id", tokenIds);
        if (tokenCommentsError) throw tokenCommentsError;

        const { error: tokenDeleteError } = await supabase
          .from("client_portal_tokens")
          .delete()
          .eq("estimate_id", estimateId);
        if (tokenDeleteError) throw tokenDeleteError;
      }

      // Delete estimate_payment_schedule
      await supabase
        .from("estimate_payment_schedule")
        .delete()
        .eq("estimate_id", estimateId);

      // Delete estimate_attachments
      await supabase
        .from("estimate_attachments")
        .delete()
        .eq("estimate_id", estimateId);

      // Delete estimate_line_items
      await supabase
        .from("estimate_line_items")
        .delete()
        .eq("estimate_id", estimateId);

      // Delete estimate_groups
      await supabase
        .from("estimate_groups")
        .delete()
        .eq("estimate_id", estimateId);

      // Delete client_comments directly on estimate
      await supabase
        .from("client_comments")
        .delete()
        .eq("estimate_id", estimateId);

      // Finally delete the estimate
      const { error } = await supabase
        .from("estimates")
        .delete()
        .eq("id", estimateId)
        .eq("company_id", companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
      toast.success("Estimate deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete estimate: ${error.message}`);
    },
  });

  // Filter estimates by status for different views
  const draftEstimates = estimates?.filter((e) => e.status === "draft") || [];
  const proposalEstimates = estimates?.filter((e) => ["sent", "viewed", "needs_changes"].includes(e.status)) || [];
  const contractEstimates = estimates?.filter((e) => e.status === "accepted") || [];
  const declinedEstimates = estimates?.filter((e) => e.status === "declined") || [];

  // Calculate totals for each tab
  const draftTotal = draftEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const proposalTotal = proposalEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const contractTotal = contractEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const declinedTotal = declinedEstimates.reduce((sum, e) => sum + (e.total || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format estimate number with appropriate prefix based on status
  const formatEstimateNumber = (estimate: Estimate) => {
    const num = estimate.estimate_number;
    if (estimate.status === "accepted") {
      return `CNT-${num}`;
    }
    // CO- prefix would be for change orders - can be added when that feature exists
    return `EST-${num}`;
  };

  // Handle creating a new estimate from a declined one
  const handleCreateNewFromDeclined = (estimate: Estimate) => {
    // We'll pass the source estimate ID to the builder via a special prop
    setEditingEstimateId(`clone:${estimate.id}`);
    setBuilderOpen(true);
  };

  // Copy portal link for a proposal and open in new tab
  const handleCopyPortalLink = async (estimateId: string) => {
    try {
      // First check for multi-signer tokens (estimate_portal_tokens)
      const { data: signerTokens } = await supabase
        .from("estimate_portal_tokens")
        .select("token, signer_id, estimate_signers(signer_name, signer_email)")
        .eq("estimate_id", estimateId)
        .eq("is_active", true);

      if (signerTokens && signerTokens.length > 0) {
        // Build links for all signers
        const baseUrl = window.location.origin;
        const links = signerTokens.map((t: any) => `${baseUrl}/portal?token=${t.token}`);
        
        await navigator.clipboard.writeText(links.join('\n'));
        toast.success(`Copied ${signerTokens.length} portal link(s) to clipboard`);
        
        // Open the first link in a new tab
        window.open(links[0], '_blank');
        return;
      }

      // Check for legacy single-signer token linked to this estimate
      const { data: legacyToken } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("estimate_id", estimateId)
        .eq("is_active", true)
        .maybeSingle();

      if (legacyToken) {
        const portalLink = `${window.location.origin}/portal?token=${legacyToken.token}`;
        await navigator.clipboard.writeText(portalLink);
        toast.success("Portal link copied to clipboard");
        
        // Open in new tab
        window.open(portalLink, '_blank');
        return;
      }

      // Fallback: Check for project-based portal token (when estimate shares a project with another estimate)
      const { data: estimate } = await supabase
        .from("estimates")
        .select("project_id")
        .eq("id", estimateId)
        .single();

      if (estimate?.project_id) {
        const { data: projectToken } = await supabase
          .from("client_portal_tokens")
          .select("token")
          .eq("project_id", estimate.project_id)
          .eq("is_active", true)
          .maybeSingle();

        if (projectToken) {
          const portalLink = `${window.location.origin}/portal?token=${projectToken.token}`;
          await navigator.clipboard.writeText(portalLink);
          toast.success("Portal link copied to clipboard (via project)");
          
          // Open in new tab
          window.open(portalLink, '_blank');
          return;
        }
      }

      toast.error("No portal link found for this proposal");
    } catch (error) {
      console.error("Error copying portal link:", error);
      toast.error("Failed to copy portal link");
    }
  };

  const renderEstimateTable = (estimateList: Estimate[], emptyMessage: string, emptyIcon: React.ReactNode, tableType: 'list' | 'proposals' | 'contracts' | 'declined' = 'list') => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (estimateList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {emptyIcon}
          <h3 className="text-lg font-semibold">{emptyMessage}</h3>
          <p className="text-muted-foreground mb-4">
            {tableType === "list" && "Get started by creating your first estimate."}
            {tableType === "proposals" && "Send an estimate as a proposal to see it here."}
            {tableType === "contracts" && "Contracts will appear here once proposals are approved and signed."}
            {tableType === "declined" && "Declined proposals will appear here."}
          </p>
          {tableType === "list" && (
            <Button onClick={() => {
              setEditingEstimateId(null);
              setBuilderOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Estimate
            </Button>
          )}
        </div>
      );
    }

    const isDeclinedTab = tableType === 'declined';
    const isContractsTab = tableType === 'contracts';
    const isProposalsTab = tableType === 'proposals';

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">#</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Salesperson</TableHead>
            <TableHead>Date</TableHead>
            {isContractsTab && <TableHead>Date Accepted</TableHead>}
            {isDeclinedTab && <TableHead>Date Declined</TableHead>}
            {!isContractsTab && !isDeclinedTab && <TableHead>Status</TableHead>}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimateList.map((estimate) => (
            <TableRow key={estimate.id}>
              <TableCell className="font-mono text-muted-foreground font-medium">
                {formatEstimateNumber(estimate)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{estimate.customer_name}</span>
                  {estimate.customer_email && (
                    <span className="text-xs text-muted-foreground">{estimate.customer_email}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{estimate.estimate_title}</span>
                  {estimate.job_address && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {estimate.job_address}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {estimate.salesperson_name || '-'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{format(new Date(estimate.estimate_date), "MMM d, yyyy")}</span>
                  {estimate.expiration_date && !isContractsTab && !isDeclinedTab && (
                    <span className="text-xs text-muted-foreground">
                      Exp: {format(new Date(estimate.expiration_date), "MMM d")}
                    </span>
                  )}
                </div>
              </TableCell>
              {isContractsTab && (
                <TableCell>
                  {estimate.signed_at ? (
                    <span className="text-green-600 font-medium">
                      {format(new Date(estimate.signed_at), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {isDeclinedTab && (
                <TableCell>
                  {estimate.declined_at ? (
                    <span className="text-red-600 font-medium">
                      {format(new Date(estimate.declined_at), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {!isContractsTab && !isDeclinedTab && (
                <TableCell>
                  <Badge className={`${statusColors[estimate.status]} text-white`}>
                    {statusLabels[estimate.status]}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="text-right font-semibold">
                {formatCurrency(estimate.total)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewEstimateId(estimate.id)}
                    title="Preview as Customer"
                  >
                    <FileSearch className="h-4 w-4" />
                  </Button>
                  {isDeclinedTab ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCreateNewFromDeclined(estimate)}
                      title="Create New Estimate"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : estimate.status === 'accepted' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPrintEstimateId(estimate.id)}
                      title="Print Contract"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingEstimateId(estimate.id); setBuilderOpen(true); }}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isProposalsTab ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPortalLink(estimate.id)}
                            title="Copy Portal Link"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setIsResendMode(true);
                              setSendDialogEstimate(estimate);
                            }}
                            title="Resend Proposal"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setIsResendMode(false);
                            setSendDialogEstimate(estimate);
                          }}
                          title="Send Proposal"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete estimate {formatEstimateNumber(estimate)} for {estimate.customer_name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(estimate.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimates & Contracts</h1>
            <p className="text-muted-foreground">
              Create estimates, send proposals, and manage contracts
            </p>
          </div>
          <Button onClick={() => {
            setEditingEstimateId(null);
            setBuilderOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            New Estimate
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimates</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftEstimates.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(draftTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Proposals</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{proposalEstimates.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(proposalTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contracts Accepted</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contractEstimates.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(contractTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Declined</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{declinedEstimates.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(declinedTotal)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={currentView} onValueChange={handleViewChange} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-4">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Estimates ({draftEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Proposals ({proposalEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Contracts ({contractEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="declined" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Declined ({declinedEstimates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Estimates</CardTitle>
                <CardDescription>
                  View and manage all draft estimates. Create new estimates or edit existing ones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  draftEstimates,
                  "No Draft Estimates",
                  <Calculator className="h-12 w-12 text-muted-foreground mb-4" />,
                  'list'
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposals</CardTitle>
                <CardDescription>
                  Track proposals sent to clients. Monitor views, approvals, and client responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  proposalEstimates,
                  "No Proposals Sent",
                  <Send className="h-12 w-12 text-muted-foreground mb-4" />,
                  'proposals'
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contracts</CardTitle>
                <CardDescription>
                  Manage signed contracts. View contract status and audit trails.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  contractEstimates,
                  "No Contracts Yet",
                  <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />,
                  'contracts'
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="declined" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Declined Proposals</CardTitle>
                <CardDescription>
                  View proposals that were declined by clients. You can edit and resend as new estimates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  declinedEstimates,
                  "No Declined Proposals",
                  <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />,
                  'declined'
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Estimate Detail Sheet */}
      <EstimateDetailSheet
        estimateId={selectedEstimateId}
        open={!!selectedEstimateId}
        onOpenChange={(open) => !open && setSelectedEstimateId(null)}
      />

      {/* Estimate Builder Dialog */}
      <EstimateBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        estimateId={editingEstimateId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["estimates", companyId] })}
      />

      {/* Send Proposal Dialog */}
      {sendDialogEstimate && (
        <SendProposalDialog
          open={!!sendDialogEstimate}
          onOpenChange={(open) => {
            if (!open) {
              setSendDialogEstimate(null);
              setIsResendMode(false);
            }
          }}
          estimateId={sendDialogEstimate.id}
          customerName={sendDialogEstimate.customer_name}
          customerEmail={sendDialogEstimate.customer_email}
          isResend={isResendMode}
        />
      )}

      {/* Print Contract Dialog */}
      <ContractPrintDialog
        estimateId={printEstimateId}
        open={!!printEstimateId}
        onOpenChange={(open) => !open && setPrintEstimateId(null)}
      />

      {/* Customer Preview Dialog */}
      <EstimatePreviewDialog
        estimateId={previewEstimateId}
        open={!!previewEstimateId}
        onOpenChange={(open) => !open && setPreviewEstimateId(null)}
      />
    </AppLayout>
  );
}
