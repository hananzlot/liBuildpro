import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, CheckCircle2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface QBCompany {
  Id: string;
  Name: string;
}

export function QuickBooksCompanySelector() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const hasSyncedCompanyName = useRef(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  // Fetch current connection
  const { data: connection, isLoading: connectionLoading } = useQuery({
    queryKey: ["quickbooks-connection", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch company info from QB
  const { data: qbCompanyInfo, isLoading: companyInfoLoading, refetch } = useQuery({
    queryKey: ["qb-company-info", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "companies" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks company info:", error || data);
        if (data?.needsReauth) setNeedsReauth(true);
        return null;
      }
      return data?.entities?.[0] as QBCompany | null;
    },
    enabled: !!companyId && !!connection,
    retry: false,
  });

  // Update company name mutation
  const updateCompanyNameMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const { error } = await supabase
        .from("quickbooks_connections")
        .update({ company_name: companyName })
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
    },
  });

  // Sync company name if not set - use useEffect to avoid calling mutate during render
  useEffect(() => {
    if (
      qbCompanyInfo?.Name &&
      connection &&
      !connection.company_name &&
      !hasSyncedCompanyName.current &&
      !updateCompanyNameMutation.isPending
    ) {
      hasSyncedCompanyName.current = true;
      updateCompanyNameMutation.mutate(qbCompanyInfo.Name);
    }
  }, [qbCompanyInfo, connection, updateCompanyNameMutation]);

  if (connectionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!connection) {
    return null;
  }

  const companyName = connection.company_name || qbCompanyInfo?.Name;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Connected QuickBooks Company</CardTitle>
              <CardDescription>
                The QuickBooks company your data syncs to
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium">
                {needsReauth ? (
                  <span className="text-destructive">Authorization expired — reconnect QuickBooks</span>
                ) : companyName ? (
                  companyName
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading company info...
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Realm ID: {connection.realm_id}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={companyInfoLoading || needsReauth}
            title="Refresh company info"
          >
            {companyInfoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {needsReauth && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">QuickBooks token revoked.</p>
              <p className="text-destructive/80">
                Disconnect and reconnect QuickBooks to select the correct company again.
              </p>
            </div>
          </div>
        )}

        {/* Multi-company info box */}
        <div className="p-4 rounded-lg bg-muted/30 border border-dashed space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Have multiple QuickBooks companies?</p>
              <p className="text-muted-foreground">
                QuickBooks connects to whichever company is selected in your QuickBooks account during authorization.
                To sync with a different company:
              </p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-1">
                <li>
                  <a 
                    href="https://qbo.intuit.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open QuickBooks <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and switch to the desired company
                </li>
                <li>Disconnect the current connection above</li>
                <li>Click "Connect to QuickBooks" again</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
