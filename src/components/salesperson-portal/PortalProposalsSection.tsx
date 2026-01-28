import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ExternalLink, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { PdfViewerDialog } from "@/components/production/PdfViewerDialog";

interface PortalProposalsSectionProps {
  salespersonName: string;
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
  plans_file_url: string | null;
  created_at: string;
}

export function PortalProposalsSection({ salespersonName, companyId }: PortalProposalsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; name: string } | null>(null);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["salesperson-portal-proposals", salespersonName, companyId],
    queryFn: async () => {
      if (!salespersonName || !companyId) return [];

      // Fetch estimates where this salesperson is assigned
      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, status, sent_at, signed_at, plans_file_url, created_at")
        .eq("company_id", companyId)
        .eq("salesperson_name", salespersonName)
        .in("status", ["sent", "viewed", "accepted", "declined"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Estimate[];
    },
    enabled: !!salespersonName && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-emerald-100 text-emerald-700 border-0">Signed</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-700 border-0">Sent</Badge>;
      case "viewed":
        return <Badge className="bg-amber-100 text-amber-700 border-0">Viewed</Badge>;
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
      <Card className="border-0 shadow-lg">
        <CardHeader 
          className="pb-2 cursor-pointer" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              My Proposals
              {estimates.length > 0 && (
                <Badge variant="secondary" className="ml-1">{estimates.length}</Badge>
              )}
            </CardTitle>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : estimates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No proposals sent yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {estimates.map((estimate) => (
                    <div
                      key={estimate.id}
                      className={`p-3 rounded-lg border bg-card transition-colors ${
                        estimate.plans_file_url 
                          ? "cursor-pointer hover:bg-muted/50" 
                          : ""
                      }`}
                      onClick={() => {
                        if (estimate.plans_file_url) {
                          setSelectedPdf({
                            url: estimate.plans_file_url,
                            name: estimate.estimate_title || `Estimate #${estimate.estimate_number}`,
                          });
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
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
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="font-semibold text-sm text-emerald-600">
                            {formatCurrency(estimate.total)}
                          </span>
                          {estimate.plans_file_url && (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </Card>

      {/* PDF Viewer Dialog */}
      {selectedPdf && (
        <PdfViewerDialog
          open={!!selectedPdf}
          onOpenChange={(open) => !open && setSelectedPdf(null)}
          fileUrl={selectedPdf.url}
          fileName={selectedPdf.name}
        />
      )}
    </>
  );
}
