import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { QuickBooksCompanySelector } from "./QuickBooksCompanySelector";
import { QuickBooksMappingConfig } from "./QuickBooksMappingConfig";
import { QuickBooksSyncDialog } from "./QuickBooksSyncDialog";

export function QuickBooksIntegration() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const navigateToQuickBooksAuth = (authUrl: string) => {
    // Intuit blocks being loaded in an iframe (X-Frame-Options / CSP), which is
    // what the Lovable preview uses. If we're in an iframe, open in a new tab.
    try {
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        window.open(authUrl, "_blank", "noopener,noreferrer");
        return;
      }

      window.location.assign(authUrl);
    } catch {
      window.open(authUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Fetch connection status
  const { data: connection, isLoading } = useQuery({
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

  // NOTE: OAuth callback is now handled by useQuickBooksCallback hook
  // which runs at a higher level (App.tsx) to ensure it processes
  // even before company context is restored after page reload.

  // Connect mutation - accepts optional forceCompanySelect flag
  const connectMutation = useMutation({
    mutationFn: async (forceCompanySelect?: boolean) => {
      const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
        body: {
          action: "get-auth-url",
          companyId,
          redirectUri: `${window.location.origin}/admin/settings`,
          forceCompanySelect: forceCompanySelect ?? false,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Failed to get auth URL");
      }

      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      navigateToQuickBooksAuth(authUrl);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsConnecting(false);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "disconnect", companyId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("QuickBooks disconnected");
      queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
    },
    onError: () => {
      toast.error("Failed to disconnect");
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-to-quickbooks", {
        body: { companyId, syncAll: false },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`Synced ${data.synced} records to QuickBooks`);
      } else if (data.failed > 0) {
        toast.error(`${data.failed} records failed to sync`);
      } else {
        toast.info("No new records to sync");
      }
      queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
    },
    onError: (error: any) => {
      if (error.message?.includes("needsReauth")) {
        toast.error("QuickBooks session expired. Please reconnect.");
        queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
      } else {
        toast.error("Sync failed: " + error.message);
      }
    },
  });

  const handleConnect = (forceCompanySelect?: boolean) => {
    if (forceCompanySelect) {
      // Show alert before reconnecting to set expectations
      const confirmed = window.confirm(
        "To connect a different QuickBooks company:\n\n" +
        "1. A new window will open to QuickBooks\n" +
        "2. You'll be asked to sign in\n" +
        "3. IMPORTANT: If you have multiple companies, make sure to select the correct one during sign-in\n\n" +
        "If you're already logged into QuickBooks, you may need to first go to qbo.intuit.com and switch companies before reconnecting.\n\n" +
        "Continue?"
      );
      if (!confirmed) return;
    }
    setIsConnecting(true);
    connectMutation.mutate(forceCompanySelect);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const connectionCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Online</CardTitle>
              <CardDescription>
                Sync invoices, payments, and bills to QuickBooks
              </CardDescription>
            </div>
          </div>
          {connection && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <p className="text-sm font-medium">Company ID: {connection.realm_id}</p>
                {connection.connected_at && !isNaN(new Date(connection.connected_at).getTime()) && (
                  <p className="text-xs text-muted-foreground">
                    Connected {format(new Date(connection.connected_at), "MMM d, yyyy")}
                  </p>
                )}
                {connection.last_sync_at && !isNaN(new Date(connection.last_sync_at).getTime()) && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {format(new Date(connection.last_sync_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
              <a
                href="https://qbo.intuit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Open QuickBooks <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {connection.sync_error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{connection.sync_error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setSyncDialogOpen(true)}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConnect(true)}
                disabled={isConnecting || connectMutation.isPending}
                title="Switch to a different QuickBooks company"
                className="gap-1"
              >
                {isConnecting || connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Switch Company</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <Button
            onClick={() => handleConnect()}
            disabled={isConnecting || connectMutation.isPending}
            className="w-full"
          >
            {isConnecting || connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Connect to QuickBooks
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Financial data will sync automatically when created or updated
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {connectionCard}
      {connection && (
        <>
          <QuickBooksCompanySelector />
          <QuickBooksMappingConfig />
        </>
      )}
      
      <QuickBooksSyncDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        lastSyncAt={connection?.last_sync_at}
      />
    </div>
  );
}
