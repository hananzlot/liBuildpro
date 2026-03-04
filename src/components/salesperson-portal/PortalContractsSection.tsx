import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCheck, Loader2, Eye, Globe, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";

interface PortalContractsSectionProps {
  salespersonName: string;
  salespersonId?: string;
  companyId: string;
}

interface Contract {
  id: string;
  estimate_number: number | null;
  estimate_title: string | null;
  customer_name: string | null;
  job_address: string | null;
  total: number | null;
  signed_at: string | null;
  created_at: string;
  portal_token?: string | null;
}

export function PortalContractsSection({ salespersonName, salespersonId, companyId }: PortalContractsSectionProps) {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);

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

      const orConditions: string[] = [];
      if (salespersonId) orConditions.push(`salesperson_id.eq.${salespersonId}`);
      if (salespersonName) orConditions.push(`salesperson_name.eq.${salespersonName}`);

      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, signed_at, created_at")
        .eq("company_id", companyId)
        .eq("status", "accepted")
        .or(orConditions.join(","))
        .order("signed_at", { ascending: false });

      if (error) throw error;
      if (!data?.length) return [];

      // Fetch portal tokens
      const ids = data.map(e => e.id);
      const { data: tokensData } = await supabase
        .from("client_portal_tokens")
        .select("estimate_id, token")
        .in("estimate_id", ids)
        .eq("is_active", true);

      const tokenMap = new Map<string, string>();
      tokensData?.forEach(t => { if (t.estimate_id) tokenMap.set(t.estimate_id, t.token); });

      return data.map(e => ({ ...e, portal_token: tokenMap.get(e.id) || null })) as Contract[];
    },
    enabled: !!companyId && !!(salespersonId || salespersonName),
  });

  const handleOpenPortal = (contract: Contract) => {
    if (contract.portal_token) {
      window.open(`${appBaseUrl || window.location.origin}/portal/${contract.portal_token}`, "_blank");
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <EstimatePreviewDialog
        estimateId={selectedEstimateId}
        open={!!selectedEstimateId}
        onOpenChange={(open) => !open && setSelectedEstimateId(null)}
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
                  {contracts.length > 0 ? `${contracts.length} signed` : "Accepted & signed proposals"}
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
                        <p className="font-medium text-sm truncate">
                          {contract.estimate_title || `Estimate #${contract.estimate_number}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{contract.customer_name}</p>
                        {contract.job_address && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {contract.job_address}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="bg-primary/10 text-primary border-0">Signed</Badge>
                          <span className="text-xs text-muted-foreground">
                            {contract.signed_at ? format(new Date(contract.signed_at), "MMM d, yyyy") : format(new Date(contract.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        <span className="font-semibold text-sm text-primary whitespace-nowrap">
                          {formatCurrency(contract.total)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 hover:bg-muted rounded flex items-center gap-1" title="Options">
                              <Eye className="h-4 w-4 text-primary" />
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedEstimateId(contract.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Contract
                            </DropdownMenuItem>
                            {contract.portal_token && (
                              <DropdownMenuItem onClick={() => handleOpenPortal(contract)}>
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
        </CardContent>
      </Card>
    </>
  );
}
