import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QBEntity {
  id: string;
  name: string;
  type: string;
  subType?: string | null;
}

interface MappingRow {
  id?: string;
  mapping_type: string;
  source_value: string | null;
  qbo_id: string;
  qbo_name: string;
  qbo_type?: string;
  is_default: boolean;
}

export function QuickBooksMappingConfig() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("accounts");
  const [needsReauth, setNeedsReauth] = useState(false);
  const hasShownReauthToast = useRef(false);

  const markNeedsReauth = () => {
    setNeedsReauth(true);
    if (!hasShownReauthToast.current) {
      hasShownReauthToast.current = true;
      toast.error("QuickBooks authorization expired. Please reconnect QuickBooks.");
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company ID");
      const { error, data } = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "disconnect", companyId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Disconnect failed");
    },
    onSuccess: () => {
      toast.success("QuickBooks disconnected");
      queryClient.invalidateQueries({ queryKey: ["quickbooks-connection", companyId] });
      queryClient.invalidateQueries({ queryKey: ["qb-accounts", companyId] });
      queryClient.invalidateQueries({ queryKey: ["qb-items", companyId] });
      queryClient.invalidateQueries({ queryKey: ["qb-payment-methods", companyId] });
      queryClient.invalidateQueries({ queryKey: ["qb-mappings", companyId] });
      setNeedsReauth(false);
      hasShownReauthToast.current = false;
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to disconnect QuickBooks");
    },
  });

  // Fetch existing mappings
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ["qb-mappings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_mappings")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return data as MappingRow[];
    },
    enabled: !!companyId,
  });

  // Fetch QB entities
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ["qb-accounts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "accounts" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks accounts:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        return [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && !needsReauth,
    retry: false,
  });

  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["qb-items", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "items" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks items:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        return [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && !needsReauth,
    retry: false,
  });

  const { data: paymentMethods, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ["qb-payment-methods", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "paymentMethods" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks payment methods:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        return [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && !needsReauth,
    retry: false,
  });

  // Save mapping mutation
  const saveMappingMutation = useMutation({
    mutationFn: async (mapping: Omit<MappingRow, "id"> & { id?: string }) => {
      const payload = {
        company_id: companyId,
        mapping_type: mapping.mapping_type,
        source_value: mapping.source_value,
        qbo_id: mapping.qbo_id,
        qbo_name: mapping.qbo_name,
        qbo_type: mapping.qbo_type,
        is_default: mapping.is_default,
      };

      const { error } = await supabase
        .from("quickbooks_mappings")
        .upsert(payload, { onConflict: "company_id,mapping_type,source_value" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapping saved");
      queryClient.invalidateQueries({ queryKey: ["qb-mappings"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save mapping: " + error.message);
    },
  });

  const getDefaultMapping = (type: string) => {
    return mappings?.find((m) => m.mapping_type === type && m.is_default);
  };

  const handleDefaultChange = (type: string, qboId: string, qboName: string, qboType?: string) => {
    saveMappingMutation.mutate({
      mapping_type: type,
      source_value: null,
      qbo_id: qboId,
      qbo_name: qboName,
      qbo_type: qboType,
      is_default: true,
    });
  };

  const incomeAccounts = accounts?.filter((a) => ["Income", "Other Income"].includes(a.type)) || [];
  const expenseAccounts = accounts?.filter((a) => ["Expense", "Other Expense", "Cost of Goods Sold"].includes(a.type)) || [];

  const isLoading = mappingsLoading || accountsLoading || itemsLoading || paymentMethodsLoading;

  if (needsReauth) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Mapping</CardTitle>
              <CardDescription>Reconnect QuickBooks to load accounts and items</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">QuickBooks authorization was revoked.</p>
              <p className="text-destructive/80">
                Click disconnect below, then use “Connect to QuickBooks” to re-authorize.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Disconnect QuickBooks
          </Button>
        </CardContent>
      </Card>
    );
  }

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
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Mapping</CardTitle>
              <CardDescription>
                Configure how your data maps to QuickBooks accounts and items
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchAccounts();
              refetchItems();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="payments">Payment Methods</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Income Account (for Invoices)</Label>
                <Select
                  value={getDefaultMapping("income_account")?.qbo_id || ""}
                  onValueChange={(value) => {
                    const account = incomeAccounts.find((a) => a.id === value);
                    if (account) {
                      handleDefaultChange("income_account", account.id, account.name, account.type);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select income account" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Revenue from invoices will be posted to this account
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Expense Account (for Bills)</Label>
                <Select
                  value={getDefaultMapping("expense_account")?.qbo_id || ""}
                  onValueChange={(value) => {
                    const account = expenseAccounts.find((a) => a.id === value);
                    if (account) {
                      handleDefaultChange("expense_account", account.id, account.name, account.type);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select expense account" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Subcontractor bills will be posted to this account
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Default Service Item (for Invoice Lines)</Label>
              <Select
                value={getDefaultMapping("default_item")?.qbo_id || ""}
                onValueChange={(value) => {
                  const item = items?.find((i) => i.id === value);
                  if (item) {
                    handleDefaultChange("default_item", item.id, item.name, item.type);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default item" />
                </SelectTrigger>
                <SelectContent>
                  {items?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Invoice line items will use this product/service
              </p>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Default Payment Method</Label>
              <Select
                value={getDefaultMapping("payment_method")?.qbo_id || ""}
                onValueChange={(value) => {
                  const method = paymentMethods?.find((m) => m.id === value);
                  if (method) {
                    handleDefaultChange("payment_method", method.id, method.name);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Payments will default to this method unless specified
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
