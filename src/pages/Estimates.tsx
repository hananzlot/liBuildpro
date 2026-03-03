import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnifiedMode } from "@/hooks/useUnifiedMode";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { fetchAllPages } from "@/lib/supabasePagination";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgePill } from "@/components/ui/badge-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calculator, Send, FileSignature, Plus, Trash2, Edit, Loader2, ExternalLink, Printer, RefreshCw, FileSearch, Link2, Upload, ChevronDown, ChevronRight, Eye, Globe, Archive, Clock, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { updateOpportunityValueFromEstimates } from "@/lib/estimateValueUtils";
import { format } from "date-fns";
import { EstimateDetailSheet } from "@/components/estimates/EstimateDetailSheet";
import { SendProposalDialog } from "@/components/estimates/SendProposalDialog";
import { ContractPrintDialog } from "@/components/estimates/ContractPrintDialog";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { ProposalUploadDialog } from "@/components/estimates/ProposalUploadDialog";
import { EstimateSourceDialog, LinkedOpportunity } from "@/components/estimates/EstimateSourceDialog";

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
  project_id: string | null;
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
  const navigate = useNavigate();
  const { estimateId: urlEstimateId } = useParams<{ estimateId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get("view") as ViewType) || "list";
  const { isAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const { isUnified, companyIds, queryKeySuffix, getCompanyName } = useUnifiedMode();
  const { openTab } = useAppTabs();
  const queryClient = useQueryClient();
  
  const [sendDialogEstimate, setSendDialogEstimate] = useState<Estimate | null>(null);
  const [isResendMode, setIsResendMode] = useState(false);
  const [printEstimateId, setPrintEstimateId] = useState<string | null>(null);
  const [previewEstimateId, setPreviewEstimateId] = useState<string | null>(null);
  const [uploadDialogEstimate, setUploadDialogEstimate] = useState<Estimate | null>(null);
  const [deleteConfirmEstimate, setDeleteConfirmEstimate] = useState<Estimate | null>(null);
  
  // New estimate source dialog state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

  // Handle source dialog continue - navigate to new estimate page in a tab
  const handleSourceDialogContinue = (opportunity: LinkedOpportunity | null, createOpp: boolean) => {
    setSourceDialogOpen(false);
    // Build URL with opportunity params (or create-new-opportunity flag)
    const params = new URLSearchParams();
    if (createOpp) params.set('createOpportunity', '1');
    if (opportunity?.id) params.set('opportunityId', opportunity.id);
    if (opportunity?.ghl_id) params.set('opportunityGhlId', opportunity.ghl_id);
    if (opportunity?.name) params.set('name', opportunity.name);
    if (opportunity?.contact_name) params.set('contactName', opportunity.contact_name);
    if (opportunity?.contact_email) params.set('contactEmail', opportunity.contact_email);
    if (opportunity?.contact_phone) params.set('contactPhone', opportunity.contact_phone);
    if (opportunity?.address) params.set('address', opportunity.address);
    if (opportunity?.scope_of_work) params.set('scope', opportunity.scope_of_work);
    if (opportunity?.salesperson_name) params.set('salesperson', opportunity.salesperson_name);
    if (opportunity?.contact_uuid) params.set('contactUuid', opportunity.contact_uuid);
    if (opportunity?.contact_id) params.set('contactId', opportunity.contact_id);
    if (opportunity?.lead_source) params.set('leadSource', opportunity.lead_source);

    const url = params.toString() ? `/estimate/new?${params.toString()}` : '/estimate/new';
    openTab(url, 'New Estimate');
  };

  // Handle new estimate button click
  const handleNewEstimateClick = () => {
    setSourceDialogOpen(true);
  };

  const handleViewChange = (view: string) => {
    setSearchParams({ view });
  };

  // Fetch estimates - paginated to handle large datasets
  const { data: estimates, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["estimates", queryKeySuffix],
    queryFn: async () => {
      if (!companyId && !isUnified) return [];
      return fetchAllPages<Estimate & { company_id?: string | null }>(async (from, to) => {
        let query = supabase
          .from("estimates")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (isUnified && companyIds.length > 1) {
          query = query.in("company_id", companyIds);
        } else if (companyId) {
          query = query.eq("company_id", companyId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as (Estimate & { company_id?: string | null })[];
      });
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    gcTime: 30 * 60 * 1000,
  });

  // Refetch when page becomes visible (catches updates from portal)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && companyId) {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch, companyId]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (estimateId: string) => {
      if (!companyId) throw new Error("No company selected");
      
      // First, get the estimate to find linked opportunity for value recalculation
      const { data: estimateToDelete } = await supabase
        .from("estimates")
        .select("opportunity_id, opportunity_uuid, project_id")
        .eq("id", estimateId)
        .eq("company_id", companyId)
        .maybeSingle();

      const linkedOppGhlId = estimateToDelete?.opportunity_id;
      const linkedOppUuid = estimateToDelete?.opportunity_uuid;
      const linkedProjectId = estimateToDelete?.project_id;
      
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

      // Delete estimate_generation_jobs (AI generation tracking)
      await supabase
        .from("estimate_generation_jobs")
        .delete()
        .eq("estimate_id", estimateId);

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

      // If project was linked, check if any other estimates still reference it
      if (linkedProjectId) {
        const { count } = await supabase
          .from("estimates")
          .select("id", { count: "exact", head: true })
          .eq("project_id", linkedProjectId);

        if (count === 0) {
          // No remaining estimates — soft-delete the project if early-stage
          await supabase.rpc("soft_delete_early_stage_project", {
            p_project_id: linkedProjectId,
          });
        }
      }

      // After successful deletion, recalculate opportunity value
      if (linkedOppGhlId) {
        await updateOpportunityValueFromEstimates(
          linkedOppUuid || null,
          linkedOppGhlId,
          companyId
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
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

  // Split drafts into recent vs old (30+ days)
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const recentDraftEstimates = useMemo(() => 
    draftEstimates.filter(e => new Date(e.estimate_date) >= thirtyDaysAgo), 
    [draftEstimates, thirtyDaysAgo]
  );
  const oldDraftEstimates = useMemo(() => 
    draftEstimates.filter(e => new Date(e.estimate_date) < thirtyDaysAgo), 
    [draftEstimates, thirtyDaysAgo]
  );

  // Split proposals into live vs expired (by expiration_date)
  const now = useMemo(() => new Date(), []);
  const liveProposalEstimates = useMemo(() => 
    proposalEstimates.filter(e => !e.expiration_date || new Date(e.expiration_date) >= now), 
    [proposalEstimates, now]
  );
  const expiredProposalEstimates = useMemo(() => 
    proposalEstimates.filter(e => e.expiration_date && new Date(e.expiration_date) < now), 
    [proposalEstimates, now]
  );

  // Archive stale projects on page load
  useEffect(() => {
    if (!companyId) return;
    supabase.rpc('archive_stale_projects', { p_company_id: companyId })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to archive stale projects:', error);
          return;
        }
        const result = data as Record<string, number> | null;
        if (result && (result.old_estimates_archived > 0 || result.expired_proposals_archived > 0)) {
          console.log('Archived stale projects:', result);
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["production"] });
        }
      });
  }, [companyId, queryClient]);

  // Calculate totals for each tab
  const draftTotal = recentDraftEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const proposalTotal = liveProposalEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
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

  // Format estimate number with appropriate prefix based on status/tab
  const formatEstimateNumber = (estimate: Estimate, tableType?: string) => {
    const num = estimate.estimate_number;
    if (estimate.status === "accepted") {
      return `CNT-${num}`;
    }
    if (tableType === "proposals" || ["sent", "viewed", "needs_changes"].includes(estimate.status)) {
      return `PROP-${num}`;
    }
    return `EST-${num}`;
  };

  // Handle creating a new estimate from a declined one
  const handleCreateNewFromDeclined = (estimate: Estimate) => {
    // Navigate to builder with clone prefix
    openTab(`/estimate/clone:${estimate.id}`, `Clone Estimate #${estimate.estimate_number}`);
  };

  // Open proposal preview (estimate-only view)
  const handleOpenProposalPreview = async (estimateId: string) => {
    try {
      // First check for multi-signer tokens (estimate_portal_tokens)
      const { data: signerTokens } = await supabase
        .from("estimate_portal_tokens")
        .select("token")
        .eq("estimate_id", estimateId)
        .eq("is_active", true)
        .limit(1);

      if (signerTokens && signerTokens.length > 0) {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/portal?estimate_token=${signerTokens[0].token}`;
        window.open(link, '_blank');
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
        window.open(portalLink, '_blank');
        return;
      }

      toast.error("No proposal link found");
    } catch (error) {
      console.error("Error opening proposal preview:", error);
      toast.error("Failed to open proposal preview");
    }
  };

  // Open full customer project portal
  const handleOpenCustomerPortal = async (estimateId: string) => {
    try {
      // Get the project_id from the estimate
      const { data: estimate } = await supabase
        .from("estimates")
        .select("project_id")
        .eq("id", estimateId)
        .single();

      if (!estimate?.project_id) {
        toast.error("No project linked to this estimate");
        return;
      }

      // Check for project-based portal token
      const { data: projectToken } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("project_id", estimate.project_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (projectToken) {
        const portalLink = `${window.location.origin}/portal/${projectToken.token}`;
        window.open(portalLink, '_blank');
        return;
      }

      toast.error("No customer portal found for this project");
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast.error("Failed to open customer portal");
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
            <Button onClick={handleNewEstimateClick}>
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
      <div className="overflow-auto max-h-[calc(100vh-280px)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-7 min-w-7 max-w-7 p-0"></TableHead>
            <TableHead className="w-24 min-w-24 p-0 pl-1">#</TableHead>
            <TableHead className="w-[20%]">Customer</TableHead>
            <TableHead className="w-[22%]">Title</TableHead>
            <TableHead className="w-[12%]">Salesperson</TableHead>
            <TableHead className="w-[10%]">Date</TableHead>
            {isContractsTab && <TableHead className="w-[10%]">Accepted</TableHead>}
            {isDeclinedTab && <TableHead className="w-[10%]">Declined</TableHead>}
            {!isContractsTab && !isDeclinedTab && <TableHead className="w-[8%]">Status</TableHead>}
            <TableHead className="w-[10%] text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimateList.map((estimate) => (
            <TableRow key={estimate.id}>
              <TableCell className="w-7 min-w-7 max-w-7 p-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setPreviewEstimateId(estimate.id)}>
                      <FileSearch className="h-4 w-4 mr-2" />
                      Preview as Customer
                    </DropdownMenuItem>
                    {isDeclinedTab ? (
                      <DropdownMenuItem onClick={() => handleCreateNewFromDeclined(estimate)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Estimate
                      </DropdownMenuItem>
                    ) : estimate.status === 'accepted' ? (
                      <DropdownMenuItem onClick={() => setPrintEstimateId(estimate.id)}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print Contract
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => openTab(
                          `/estimate/${estimate.id}`, 
                          estimate.status && estimate.status !== 'draft' 
                            ? `Prop ${estimate.customer_name} (#${estimate.estimate_number})` 
                            : `Est ${estimate.customer_name} (#${estimate.estimate_number})`
                        )}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {estimate.project_id && (
                          <DropdownMenuItem onClick={() => handleOpenCustomerPortal(estimate.id)}>
                            <Globe className="h-4 w-4 mr-2" />
                            Open Customer Portal
                          </DropdownMenuItem>
                        )}
                        {isProposalsTab ? (
                          <>
                            <DropdownMenuItem onClick={() => setUploadDialogEstimate(estimate)}>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Documents
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenProposalPreview(estimate.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Open Proposal Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenCustomerPortal(estimate.id)}>
                              <Globe className="h-4 w-4 mr-2" />
                              Open Customer Portal
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setIsResendMode(true);
                              setSendDialogEstimate(estimate);
                            }}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Resend Proposal
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => {
                            setIsResendMode(false);
                            setSendDialogEstimate(estimate);
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Send Proposal
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteConfirmEstimate(estimate)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              <TableCell className="font-mono text-muted-foreground font-medium w-24 min-w-24 p-0 pl-1">
                {formatEstimateNumber(estimate, tableType)}
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
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="text-sm">{format(new Date(estimate.estimate_date), "MM/dd/yy")}</span>
                  {estimate.expiration_date && !isContractsTab && !isDeclinedTab && (
                    <span className="text-xs text-muted-foreground">
                      Exp: {format(new Date(estimate.expiration_date), "MM/dd/yy")}
                    </span>
                  )}
                </div>
              </TableCell>
              {isContractsTab && (
                <TableCell className="whitespace-nowrap">
                  {estimate.signed_at ? (
                    <span className="text-green-600 font-medium text-sm">
                      {format(new Date(estimate.signed_at), "MM/dd/yy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {isDeclinedTab && (
                <TableCell className="whitespace-nowrap">
                  {estimate.declined_at ? (
                    <span className="text-red-600 font-medium text-sm">
                      {format(new Date(estimate.declined_at), "MM/dd/yy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {!isContractsTab && !isDeclinedTab && (
                <TableCell>
                  <BadgePill intent={
                    estimate.status === 'accepted' ? 'success' :
                    estimate.status === 'declined' ? 'danger' :
                    estimate.status === 'sent' || estimate.status === 'viewed' ? 'primary' :
                    estimate.status === 'needs_changes' ? 'warning' : 'muted'
                  }>
                    {statusLabels[estimate.status]}
                  </BadgePill>
                </TableCell>
              )}
              <TableCell className="text-right font-semibold">
                {formatCurrency(estimate.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <PageHeader
          title={currentView === "proposals" ? "Proposals" : currentView === "contracts" ? "Contracts" : currentView === "declined" ? "Declined" : "Estimates"}
          subtitle={isLoading ? "Loading..." : `${estimates?.length ?? 0} total`}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh estimates"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" className="h-8" onClick={handleNewEstimateClick}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Estimate
              </Button>
            </>
          }
        />

        <Tabs value={currentView} onValueChange={handleViewChange} className="w-full">
          <TabsList className="w-full max-w-3xl grid grid-cols-4 h-auto">
            <TabsTrigger value="list" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-xs sm:text-sm py-2">
              <div className="flex items-center gap-1">
                <Calculator className="h-3.5 w-3.5 hidden sm:inline-block" />
                <span>Estimates ({recentDraftEstimates.length})</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">{formatCurrency(draftTotal)}</span>
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-xs sm:text-sm py-2">
              <div className="flex items-center gap-1">
                <Send className="h-3.5 w-3.5 hidden sm:inline-block" />
                <span>Proposals ({liveProposalEstimates.length})</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">{formatCurrency(proposalTotal)}</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-xs sm:text-sm py-2">
              <div className="flex items-center gap-1">
                <FileSignature className="h-3.5 w-3.5 hidden sm:inline-block" />
                <span>Contracts ({contractEstimates.length})</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">{formatCurrency(contractTotal)}</span>
            </TabsTrigger>
            <TabsTrigger value="declined" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-xs sm:text-sm py-2">
              <div className="flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5 hidden sm:inline-block" />
                <span>Declined ({declinedEstimates.length})</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">{formatCurrency(declinedTotal)}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-2">
            {renderEstimateTable(
              recentDraftEstimates,
              "No Draft Estimates",
              <Calculator className="h-12 w-12 text-muted-foreground mb-4" />,
              'list'
            )}
            {oldDraftEstimates.length > 0 && (
              <Collapsible className="mt-4">
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Old Estimates</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{oldDraftEstimates.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {renderEstimateTable(
                    oldDraftEstimates,
                    "No Old Estimates",
                    <Calculator className="h-12 w-12 text-muted-foreground mb-4" />,
                    'list'
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="mt-2">
            {renderEstimateTable(
              liveProposalEstimates,
              "No Proposals Sent",
              <Send className="h-12 w-12 text-muted-foreground mb-4" />,
              'proposals'
            )}
            {expiredProposalEstimates.length > 0 && (
              <Collapsible className="mt-4">
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Expired Proposals</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{expiredProposalEstimates.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {renderEstimateTable(
                    expiredProposalEstimates,
                    "No Expired Proposals",
                    <Send className="h-12 w-12 text-muted-foreground mb-4" />,
                    'proposals'
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </TabsContent>

          <TabsContent value="contracts" className="mt-2">
            {renderEstimateTable(
              contractEstimates,
              "No Contracts Yet",
              <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />,
              'contracts'
            )}
          </TabsContent>

          <TabsContent value="declined" className="mt-2">
            {renderEstimateTable(
              declinedEstimates,
              "No Declined Proposals",
              <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />,
              'declined'
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Estimate Detail Sheet - open state derived from URL */}
      <EstimateDetailSheet
        estimateId={urlEstimateId || null}
        open={!!urlEstimateId}
        onOpenChange={(open) => {
          if (!open) {
            navigate(`/estimates${currentView !== 'list' ? `?view=${currentView}` : ''}`, { replace: true });
          }
        }}
      />

      {/* Estimate Source Dialog */}
      <EstimateSourceDialog
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
        onContinue={handleSourceDialogContinue}
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

      {/* Proposal Upload Dialog */}
      {uploadDialogEstimate && (
        <ProposalUploadDialog
          open={!!uploadDialogEstimate}
          onOpenChange={(open) => !open && setUploadDialogEstimate(null)}
          estimateId={uploadDialogEstimate.id}
          estimateNumber={uploadDialogEstimate.estimate_number}
          customerName={uploadDialogEstimate.customer_name}
        />
      )}

      {/* Delete Estimate Confirmation */}
      <AlertDialog open={!!deleteConfirmEstimate} onOpenChange={(open) => !open && setDeleteConfirmEstimate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Delete estimate {deleteConfirmEstimate ? formatEstimateNumber(deleteConfirmEstimate) : ""} for {deleteConfirmEstimate?.customer_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmEstimate) {
                  deleteMutation.mutate(deleteConfirmEstimate.id);
                }
                setDeleteConfirmEstimate(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
