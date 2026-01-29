import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface QBCompany {
  Id: string;
  Name: string;
}

export function QuickBooksCompanySelector() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const hasSyncedCompanyName = useRef(false);

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
        toast.error("QuickBooks authorization failed. Please reconnect QuickBooks.");
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
      toast.success("QuickBooks company info updated");
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
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium">
                {connection.company_name || qbCompanyInfo?.Name || "Loading..."}
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
            disabled={companyInfoLoading}
          >
            {companyInfoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          To sync with a different QuickBooks company, disconnect and reconnect with the desired company selected during OAuth.
        </p>
      </CardContent>
    </Card>
  );
}
