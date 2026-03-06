import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCheck, Loader2, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { PdfViewerDialog } from "@/components/production/PdfViewerDialog";
import { formatCurrency } from "@/lib/utils";

interface PortalContractsSectionProps {
  salespersonName: string;
  salespersonId?: string;
  companyId: string;
}

interface ContractRecord {
  id: string;
  source: "agreement" | "estimate";
  title: string;
  customerName: string | null;
  address: string | null;
  total: number | null;
  signedDate: string | null;
  type: string; // "Contract" | "Change Order" | "Addendum"
  agreementNumber: string | null;
  estimateId: string | null; // for preview
  portalToken: string | null;
  attachmentUrl: string | null;
}

export function PortalContractsSection({ salespersonName, salespersonId, companyId }: PortalContractsSectionProps) {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");

  const { data: appBaseUrl } = useQuery({
    queryKey: ["app-base-url-setting", companyId],
    queryFn: async () => {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "app_base_url")
        .maybeSingle();
      if (companySettings?.setting_value) return companySettings.setting_value;
      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_base_url")
        .maybeSingle();
      return appSettings?.setting_value || window.location.origin;
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["salesperson-portal-contracts", salespersonId, salespersonName, companyId],
    queryFn: async () => {
      if (!companyId) return [];
      if (!salespersonId && !salespersonName) return [];

      const results: ContractRecord[] = [];

      // 1. Find projects assigned to this salesperson
      const { data: projects } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`);

      // Also find projects via opportunities assigned to salesperson
      let oppProjectIds: string[] = [];
      if (salespersonId) {
        const { data: opps } = await supabase
          .from("opportunities")
          .select("id")
          .eq("company_id", companyId)
          .or(`salesperson_id.eq.${salespersonId},assigned_to.eq.${salespersonId}`);
        
        if (opps?.length) {
          const oppUuids = opps.map(o => o.id);
          const uuidFilter = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(",");
          const { data: oppProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .or(uuidFilter);
          if (oppProjects) {
            oppProjectIds = oppProjects.map(p => p.id);
            // Merge into projects list (dedup)
            const existingIds = new Set((projects || []).map(p => p.id));
            oppProjects.forEach(p => {
              if (!existingIds.has(p.id)) {
                projects?.push(p);
              }
            });
          }
        }
      }

      if (!projects?.length) return [];
      const projectIds = projects.map(p => p.id);
      const projectMap = new Map(projects.map(p => [p.id, p]));

      // 2. Fetch project_agreements for these projects
      // Fetch agreements - include ones with NULL company_id (data bug) since we filter by project_id
      const { data: agreements } = await supabase
        .from("project_agreements")
        .select("id, project_id, agreement_type, agreement_number, total_price, agreement_signed_date, description_of_work, attachment_url")
        .in("project_id", projectIds)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order("agreement_signed_date", { ascending: false });

      // 3. Fetch portal tokens for these projects
      const { data: tokensData } = await supabase
        .from("client_portal_tokens")
        .select("project_id, token")
        .in("project_id", projectIds)
        .eq("is_active", true);

      const portalTokenMap = new Map<string, string>();
      tokensData?.forEach(t => {
        if (t.project_id) portalTokenMap.set(t.project_id, t.token);
      });

      // Build contract records from agreements
      (agreements || []).forEach(a => {
        const proj = projectMap.get(a.project_id);
        const customerName = proj 
          ? [proj.customer_first_name, proj.customer_last_name].filter(Boolean).join(" ") || proj.project_name
          : null;
        
        results.push({
          id: a.id,
          source: "agreement",
          title: a.description_of_work || `${a.agreement_type} #${a.agreement_number}`,
          customerName,
          address: proj?.project_address || null,
          total: a.total_price,
          signedDate: a.agreement_signed_date,
          type: a.agreement_type || "Contract",
          agreementNumber: a.agreement_number?.toString() || null,
          estimateId: null,
          portalToken: portalTokenMap.get(a.project_id) || null,
          attachmentUrl: a.attachment_url || null,
        });
      });

      return results;
    },
    enabled: !!companyId && !!(salespersonId || salespersonName),
  });

  const handleOpenPortal = (contract: ContractRecord) => {
    if (contract.portalToken) {
      window.open(`${appBaseUrl || window.location.origin}/portal/${contract.portalToken}`, "_blank");
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Contract":
        return <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Contract</Badge>;
      case "Change Order":
        return <Badge className="bg-accent text-accent-foreground border-0 text-[10px]">Change Order</Badge>;
      case "Addendum":
        return <Badge className="bg-secondary text-secondary-foreground border-0 text-[10px]">Addendum</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <>
      <EstimatePreviewDialog
        estimateId={selectedEstimateId}
        open={!!selectedEstimateId}
        onOpenChange={(open) => !open && setSelectedEstimateId(null)}
      />
      <PdfViewerDialog
        open={!!pdfUrl}
        onOpenChange={(open) => { if (!open) { setPdfUrl(null); setPdfFileName(""); } }}
        fileUrl={pdfUrl || ""}
        fileName={pdfFileName}
      />
      <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">My Contracts</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {contracts.length > 0 ? `${contracts.length} signed` : "Signed contracts & change orders"}
                </p>
              </div>
            </div>
            {contracts.length > 0 && (
              <Badge variant="secondary" className="font-medium">{contracts.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No signed contracts yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-2">
              <div className="space-y-2 pr-2">
                {contracts.map((contract) => (
                  <div key={contract.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">
                            {contract.agreementNumber ? `#${contract.agreementNumber}` : ""} {contract.title}
                          </p>
                          {getTypeBadge(contract.type)}
                        </div>
                        {contract.customerName && (
                          <p className="text-xs text-muted-foreground truncate">{contract.customerName}</p>
                        )}
                        {contract.address && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {contract.address}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="bg-primary/10 text-primary border-0">Signed</Badge>
                          {contract.signedDate && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(contract.signedDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        <span className="font-semibold text-sm text-primary whitespace-nowrap">
                          {formatCurrency(contract.total)}
                        </span>
                        <div className="flex items-center gap-1">
                          {contract.attachmentUrl && (
                            <button
                              onClick={() => {
                                setPdfUrl(contract.attachmentUrl);
                                setPdfFileName(`${contract.type} #${contract.agreementNumber || ""} - ${contract.customerName || "Contract"}.pdf`);
                              }}
                              className="p-1.5 hover:bg-muted rounded flex items-center gap-1"
                              title="View Signed PDF"
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </button>
                          )}
                          {contract.portalToken && (
                            <button
                              onClick={() => handleOpenPortal(contract)}
                              className="p-1.5 hover:bg-muted rounded flex items-center gap-1"
                              title="Open Customer Portal"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );
}
