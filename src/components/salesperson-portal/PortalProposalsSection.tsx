import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, ExternalLink, Loader2, ChevronDown, ChevronUp, Eye, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";

interface PortalProposalsSectionProps {
  salespersonName: string;
  salespersonId?: string;
  companyId: string;
}

interface Estimate {
  id: string;
  estimate_number: number | null;
  estimate_title: string | null;
  customer_name: string | null;
  job_address: string | null;
  total: number | null;
  status: string | null;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  expiration_date: string | null;
  opportunity_uuid: string | null;
  portal_token?: string | null;
}

export function PortalProposalsSection({ salespersonName, salespersonId, companyId }: PortalProposalsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeclined, setShowDeclined] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);

  // Fetch app base URL for portal links
  const { data: appBaseUrl } = useQuery({
    queryKey: ["app-base-url-setting", companyId],
    queryFn: async () => {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      if (companySettings?.setting_value) {
        return companySettings.setting_value;
      }

      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      return appSettings?.setting_value || window.location.origin;
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: estimates = [], isLoading, refetch } = useQuery({
    queryKey: ["salesperson-portal-proposals", salespersonId, salespersonName, companyId],
    queryFn: async () => {
      if (!companyId) return [];
      if (!salespersonId && !salespersonName) return [];

      // Build OR filter to match by salesperson_id OR salesperson_name
      // This handles both old records (with only name) and new records (with UUID)
      const orConditions: string[] = [];
      if (salespersonId) {
        orConditions.push(`salesperson_id.eq.${salespersonId}`);
      }
      if (salespersonName) {
        orConditions.push(`salesperson_name.eq.${salespersonName}`);
      }

      const { data: estimatesData, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, status, sent_at, signed_at, created_at, expiration_date, opportunity_uuid")
        .eq("company_id", companyId)
        .in("status", ["sent", "viewed", "declined"])
        .or(orConditions.join(","))
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!estimatesData?.length) return [];

      // Fetch portal tokens for these estimates
      const estimateIds = estimatesData.map(e => e.id);
      const { data: tokensData } = await supabase
        .from("client_portal_tokens")
        .select("estimate_id, token")
        .in("estimate_id", estimateIds)
        .eq("is_active", true);

      const tokenMap = new Map<string, string>();
      tokensData?.forEach(t => {
        if (t.estimate_id) tokenMap.set(t.estimate_id, t.token);
      });

      return estimatesData.map(e => ({
        ...e,
        portal_token: tokenMap.get(e.id) || null,
      })) as Estimate[];
    },
    enabled: !!companyId && !!(salespersonId || salespersonName),
    staleTime: 0, // Always refetch to ensure deleted records are removed
    gcTime: 30 * 1000, // Keep in cache for 30 seconds
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Fetch lost opportunity UUIDs
  const { data: lostOpportunityIds = [] } = useQuery({
    queryKey: ["portal-lost-opportunities-proposals", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("opportunities")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "lost");
      return (data || []).map(o => o.id);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Filter out lost opportunity items
  const nonLostEstimates = useMemo(() => {
    return estimates.filter(e => !e.opportunity_uuid || !lostOpportunityIds.includes(e.opportunity_uuid));
  }, [estimates, lostOpportunityIds]);

  // Expired proposals: past expiration_date
  const isExpired = useCallback((e: Estimate) => {
    if (!e.expiration_date) return false;
    return new Date(e.expiration_date) < new Date();
  }, []);

  const [showExpired, setShowExpired] = useState(false);
  const expiredProposals = useMemo(() => nonLostEstimates.filter(e => e.status !== "declined" && isExpired(e)), [nonLostEstimates, isExpired]);

  // Filter out declined by default; show them only when toggled on
  const visibleEstimates = useMemo(() => {
    if (showDeclined) return nonLostEstimates.filter(e => e.status === "declined");
    return nonLostEstimates.filter(e => e.status !== "declined" && !isExpired(e));
  }, [nonLostEstimates, showDeclined, isExpired]);

  const declinedCount = useMemo(() => nonLostEstimates.filter(e => e.status === "declined").length, [nonLostEstimates]);

  const handleOpenProposalPreview = (estimate: Estimate) => {
    // Open the preview dialog
    setSelectedEstimateId(estimate.id);
  };

  const handleOpenPortal = (estimate: Estimate) => {
    if (estimate.portal_token) {
      const portalUrl = `${appBaseUrl || window.location.origin}/portal/${estimate.portal_token}`;
      window.open(portalUrl, "_blank");
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-primary/10 text-primary border-0">Signed</Badge>;
      case "sent":
        return <Badge className="bg-secondary text-secondary-foreground border-0">Sent</Badge>;
      case "viewed":
        return <Badge className="bg-accent text-accent-foreground border-0">Viewed</Badge>;
      case "declined":
        return <Badge className="bg-destructive/10 text-destructive border-0">Declined</Badge>;
      default:
        return <Badge variant="outline">{status || "Draft"}</Badge>;
    }
  };

  // Determine if it's a proposal (sent) or estimate (not sent yet, though we filter by sent status)
  const getTypeBadge = (estimate: Estimate) => {
    // If it has been sent, it's a Proposal; otherwise it's an Estimate
    if (estimate.sent_at) {
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Proposal</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Estimate</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <EstimatePreviewDialog
        estimateId={selectedEstimateId}
        open={!!selectedEstimateId}
        onOpenChange={(open) => !open && setSelectedEstimateId(null)}
      />
      <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
        <CardHeader 
          className="pb-3 pt-4 px-4 cursor-pointer bg-gradient-to-r from-primary/5 to-transparent" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">My Proposals</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {visibleEstimates.length > 0
                    ? `${visibleEstimates.length} ${showDeclined ? "declined" : "active"}`
                    : showDeclined ? "No declined proposals" : "View sent proposals"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visibleEstimates.length > 0 && (
                <Badge variant={showDeclined ? "destructive" : "secondary"} className="font-medium">
                  {visibleEstimates.length}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            {/* Declined toggle */}
            {declinedCount > 0 && (
              <div className="flex items-center gap-2 pb-3 pt-1" onClick={e => e.stopPropagation()}>
                <Switch
                  id="show-declined"
                  checked={showDeclined}
                  onCheckedChange={setShowDeclined}
                  className="scale-90"
                />
                <Label htmlFor="show-declined" className="text-xs text-muted-foreground cursor-pointer">
                  Show declined ({declinedCount})
                </Label>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visibleEstimates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {showDeclined ? "No declined proposals" : "No proposals sent yet"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-2 pr-2">
                  {visibleEstimates.map((estimate) => (
                    <div
                      key={estimate.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {estimate.estimate_title || `Estimate #${estimate.estimate_number}`}
                            </p>
                            {getTypeBadge(estimate)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {estimate.customer_name}
                          </p>
                          {estimate.job_address && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              📍 {estimate.job_address}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {getStatusBadge(estimate.status)}
                            <span className="text-xs text-muted-foreground">
                              {estimate.sent_at
                                ? format(new Date(estimate.sent_at), "MMM d, yyyy")
                                : format(new Date(estimate.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                          <span className="font-semibold text-sm text-primary whitespace-nowrap">
                            {formatCurrency(estimate.total)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1.5 hover:bg-muted rounded flex items-center gap-1"
                                title="Open options"
                              >
                                <Eye className="h-4 w-4 text-primary" />
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenProposalPreview(estimate)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Proposal Preview
                              </DropdownMenuItem>
                              {estimate.portal_token && (
                                <DropdownMenuItem onClick={() => handleOpenPortal(estimate)}>
                                  <Globe className="h-4 w-4 mr-2" />
                                  Open Customer Portal
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Expired Proposals - collapsed section */}
            {expiredProposals.length > 0 && (
              <div className="border-t border-border/30 pt-2 px-4 pb-3">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left px-1 py-1"
                  onClick={() => setShowExpired(!showExpired)}
                >
                  {showExpired ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">Expired Proposals ({expiredProposals.length})</span>
                </button>
                {showExpired && (
                  <div className="space-y-2 mt-1 max-h-[300px] overflow-y-auto pr-2">
                    {expiredProposals.map((estimate) => (
                      <div
                        key={estimate.id}
                        className="p-3 rounded-lg border bg-card opacity-70"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {estimate.estimate_title || `Estimate #${estimate.estimate_number}`}
                              </p>
                              {getTypeBadge(estimate)}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {estimate.customer_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Expired</Badge>
                              {estimate.expiration_date && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(estimate.expiration_date), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0">
                            <span className="font-semibold text-sm text-primary whitespace-nowrap">
                              {formatCurrency(estimate.total)}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 hover:bg-muted rounded flex items-center gap-1" title="Open options">
                                  <Eye className="h-4 w-4 text-primary" />
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenProposalPreview(estimate)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Proposal Preview
                                </DropdownMenuItem>
                                {estimate.portal_token && (
                                  <DropdownMenuItem onClick={() => handleOpenPortal(estimate)}>
                                    <Globe className="h-4 w-4 mr-2" />
                                    Open Customer Portal
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}
