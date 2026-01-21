import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Database, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Trash2,
  TestTube,
  Lock,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GHLIntegration {
  id: string;
  company_id: string;
  provider: string;
  name: string | null;
  location_id: string | null;
  api_key_vault_id?: string | null;
  api_key_encrypted?: string | null;
  is_active: boolean | null;
  is_primary: boolean | null;
  last_sync_at: string | null;
  sync_status?: string | null;
  sync_error?: string | null;
  created_at: string | null;
}

export function GHLIntegrationManager() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<GHLIntegration | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch integrations for current company
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["ghl-integrations", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("company_integrations")
        .select("*")
        .eq("company_id", companyId)
        .eq("provider", "ghl")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      // Cast to our interface which includes optional vault fields
      return (data || []) as unknown as GHLIntegration[];
    },
    enabled: !!companyId,
  });

  // Add integration mutation
  const addIntegration = useMutation({
    mutationFn: async (data: { name: string; locationId: string; apiKey: string; isPrimary: boolean }) => {
      const response = await supabase.functions.invoke("store-ghl-integration", {
        body: {
          name: data.name,
          locationId: data.locationId,
          apiKey: data.apiKey,
          companyId,
          isPrimary: data.isPrimary,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-integrations"] });
      toast.success("GHL integration added successfully");
      resetForm();
      setAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add integration: ${error.message}`);
    },
  });

  // Toggle integration active status
  const toggleIntegration = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("company_integrations")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-integrations"] });
      toast.success("Integration status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update integration: ${error.message}`);
    },
  });

  // Delete integration mutation
  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      // Get the integration first to check for vault key
      const { data: integration } = await supabase
        .from("company_integrations")
        .select("*")
        .eq("id", id)
        .single();

      // Delete from vault if vault ID exists (after migration runs)
      const vaultId = (integration as unknown as GHLIntegration)?.api_key_vault_id;
      if (vaultId) {
        try {
          // Try to delete from vault - may fail if function doesn't exist yet
          await supabase.rpc("delete_ghl_api_key" as any, { secret_id: vaultId });
        } catch (e) {
          console.warn("Could not delete vault secret (function may not exist yet):", e);
        }
      }

      // Delete the integration record
      const { error } = await supabase
        .from("company_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-integrations"] });
      toast.success("Integration deleted");
      setDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete integration: ${error.message}`);
    },
  });

  // Sync now mutation
  const syncNow = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("sync-ghl-recent");
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ghl-integrations"] });
      const totalOpps = data?.totals?.opportunities || 0;
      const totalContacts = data?.totals?.contacts || 0;
      const totalAppts = data?.totals?.appointments || 0;
      toast.success(`Sync complete! ${totalOpps} opportunities, ${totalContacts} contacts, ${totalAppts} appointments`);
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Test connection
  const testConnection = async () => {
    if (!formLocationId || !formApiKey) {
      toast.error("Please enter Location ID and API Key");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `https://services.leadconnectorhq.com/users/?locationId=${formLocationId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${formApiKey}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connection successful! Found ${data.users?.length || 0} users.`,
        });
      } else {
        const errorText = await response.text();
        setTestResult({
          success: false,
          message: `Connection failed: ${response.status} - ${errorText.substring(0, 100)}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormLocationId("");
    setFormApiKey("");
    setFormIsPrimary(false);
    setTestResult(null);
  };

  const handleAddSubmit = () => {
    if (!formName || !formLocationId || !formApiKey) {
      toast.error("Please fill in all required fields");
      return;
    }

    addIntegration.mutate({
      name: formName,
      locationId: formLocationId,
      apiKey: formApiKey,
      isPrimary: formIsPrimary,
    });
  };

  const hasApiKey = (integration: GHLIntegration) => {
    return !!integration.api_key_vault_id || !!integration.api_key_encrypted;
  };

  const getStatusBadge = (integration: GHLIntegration) => {
    if (!hasApiKey(integration)) {
      return <Badge variant="outline" className="text-muted-foreground"><Clock className="h-3 w-3 mr-1" /> No API Key</Badge>;
    }
    if (!integration.is_active) {
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Disabled</Badge>;
    }
    if (integration.sync_status === "error") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
    }
    if (integration.sync_status === "syncing") {
      return <Badge variant="default" className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Syncing</Badge>;
    }
    return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
  };

  const handleDeleteClick = (integration: GHLIntegration) => {
    setIntegrationToDelete(integration);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                GHL Integrations
              </CardTitle>
              <CardDescription>
                Manage GoHighLevel connections for your company. Each integration syncs data from a GHL location.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncNow.mutate()}
                disabled={syncNow.isPending || !integrations?.some(i => hasApiKey(i) && i.is_active)}
              >
                {syncNow.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync All
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !integrations || integrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No GHL integrations configured</p>
              <p className="text-sm mt-1">Add an integration to start syncing data from GoHighLevel</p>
            </div>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="border rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">
                        {integration.name || "Unnamed Integration"}
                      </h4>
                      {integration.is_primary && (
                        <Badge variant="outline" className="text-xs">PRIMARY</Badge>
                      )}
                      {getStatusBadge(integration)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>Location ID: <code className="text-xs bg-muted px-1 rounded">{integration.location_id}</code></p>
                      {integration.last_sync_at && (
                        <p>Last synced: {formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true })}</p>
                      )}
                      {integration.sync_error && (
                        <p className="text-destructive text-xs">{integration.sync_error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${integration.id}`} className="text-sm sr-only">
                        Enabled
                      </Label>
                      <Switch
                        id={`toggle-${integration.id}`}
                        checked={integration.is_active ?? false}
                        onCheckedChange={(checked) => 
                          toggleIntegration.mutate({ id: integration.id, isActive: checked })
                        }
                        disabled={!hasApiKey(integration) || toggleIntegration.isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(integration)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Integration Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add GHL Integration</DialogTitle>
            <DialogDescription>
              Connect a GoHighLevel location to sync contacts, opportunities, and appointments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="int-name">Integration Name *</Label>
              <Input
                id="int-name"
                placeholder="e.g., Main Office, Satellite Location"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-id">GHL Location ID *</Label>
              <Input
                id="location-id"
                placeholder="e.g., pVeFrqvtYWNIPRIi0Fmr"
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Found in GHL Settings → Business Info → Location ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">GHL API Key *</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                API key will be stored securely in encrypted vault
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-primary">Set as Primary</Label>
                <p className="text-xs text-muted-foreground">
                  Primary integration is used as default for new records
                </p>
              </div>
              <Switch
                id="is-primary"
                checked={formIsPrimary}
                onCheckedChange={setFormIsPrimary}
              />
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult.success 
                  ? "bg-green-50 border border-green-200 text-green-800" 
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={isTesting || !formLocationId || !formApiKey}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={addIntegration.isPending || !formName || !formLocationId || !formApiKey}
            >
              {addIntegration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Integration
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{integrationToDelete?.name}"? This will remove the stored API key and stop syncing data from this GHL location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => integrationToDelete && deleteIntegration.mutate(integrationToDelete.id)}
              disabled={deleteIntegration.isPending}
            >
              {deleteIntegration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
