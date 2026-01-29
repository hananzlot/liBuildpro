import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function QuickBooksIntegration() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

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

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const realmId = params.get("realmId");
      const state = params.get("state");

      if (code && realmId && state) {
        try {
          const { companyId: stateCompanyId } = JSON.parse(atob(state));
          
          const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
            body: {
              action: "exchange-code",
              code,
              realmId,
              companyId: stateCompanyId,
              redirectUri: `${window.location.origin}/admin`,
            },
          });

          if (error || data?.error) {
            toast.error(data?.error || "Failed to connect QuickBooks");
          } else {
            toast.success("QuickBooks connected successfully!");
            queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
          }
        } catch (err) {
          console.error("OAuth callback error:", err);
          toast.error("Failed to process QuickBooks authorization");
        } finally {
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleCallback();
  }, [queryClient]);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
        body: {
          action: "get-auth-url",
          companyId,
          redirectUri: `${window.location.origin}/admin`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Failed to get auth URL");
      }

      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
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

  const handleConnect = () => {
    setIsConnecting(true);
    connectMutation.mutate();
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

  return (
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
                <p className="text-xs text-muted-foreground">
                  Connected {format(new Date(connection.connected_at), "MMM d, yyyy")}
                </p>
                {connection.last_sync_at && (
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
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex-1"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
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
            onClick={handleConnect}
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
}
