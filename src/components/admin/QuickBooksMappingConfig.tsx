import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, RefreshCw, Settings2, Search } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DebouncedInput } from "@/components/ui/debounced-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { QuickBooksMatchingRules } from "./QuickBooksMatchingRules";

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
  const [customerSearch, setCustomerSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [glSearch, setGlSearch] = useState("");

  // First, verify a connection exists before attempting any entity calls
  const { data: connection, isLoading: connectionLoading } = useQuery({
    queryKey: ["quickbooks-connection", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_connections")
        .select("id, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const isConnected = !!connection;

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
      queryClient.invalidateQueries({ queryKey: ["qb-customers", companyId] });
      queryClient.invalidateQueries({ queryKey: ["qb-vendors", companyId] });
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

  // Fetch local subcontractors (vendors)
  const { data: subcontractors } = useQuery({
    queryKey: ["subcontractors-for-mapping", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, company_name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch local contacts (customers) - search dynamically to handle large datasets
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts-for-mapping", companyId, customerSearch],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("id, contact_name, first_name, last_name, email")
        .eq("company_id", companyId)
        .order("contact_name")
        .limit(100);
      
      // If there's a search term, filter server-side
      if (customerSearch.trim()) {
        query = query.or(`contact_name.ilike.%${customerSearch}%,first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
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
    enabled: !!companyId && isConnected && !needsReauth,
    retry: false,
  });

  // Fetch ALL accounts for GL tab
  const { data: allAccounts, isLoading: allAccountsLoading, refetch: refetchAllAccounts } = useQuery({
    queryKey: ["qb-all-accounts", companyId],
    queryFn: async () => {
      // Fetch all account types
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "allAccounts" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load all QuickBooks accounts:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        // Fall back to the regular accounts if allAccounts doesn't work
        return accounts || [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && isConnected && !needsReauth && activeTab === "gl",
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
    enabled: !!companyId && isConnected && !needsReauth,
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
    enabled: !!companyId && isConnected && !needsReauth,
    retry: false,
  });

  // Fetch QB customers
  const { data: qbCustomers, isLoading: customersLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ["qb-customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "customers" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks customers:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        return [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && isConnected && !needsReauth,
    retry: false,
  });

  // Fetch QB vendors
  const { data: qbVendors, isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ["qb-vendors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "vendors" },
      });
      if (error || data?.needsReauth) {
        console.error("Failed to load QuickBooks vendors:", error || data);
        if (data?.needsReauth) markNeedsReauth();
        return [] as QBEntity[];
      }
      return (data?.entities || []) as QBEntity[];
    },
    enabled: !!companyId && isConnected && !needsReauth,
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

  const getSourceMapping = (type: string, sourceValue: string) => {
    return mappings?.find((m) => m.mapping_type === type && m.source_value === sourceValue);
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

  const handleSourceMapping = (type: string, sourceValue: string, qboId: string, qboName: string, qboType?: string) => {
    saveMappingMutation.mutate({
      mapping_type: type,
      source_value: sourceValue,
      qbo_id: qboId,
      qbo_name: qboName,
      qbo_type: qboType,
      is_default: false,
    });
  };

  const incomeAccounts = accounts?.filter((a) => ["Income", "Other Income"].includes(a.type)) || [];
  const expenseAccounts = accounts?.filter((a) => ["Expense", "Other Expense", "Cost of Goods Sold"].includes(a.type)) || [];

  // Group accounts by type for GL tab
  const accountsByType = (allAccounts || accounts || []).reduce((acc, account) => {
    const type = account.type || "Other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, QBEntity[]>);

  const filteredQbCustomers = qbCustomers?.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  ) || [];

  const filteredQbVendors = qbVendors?.filter(v => 
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  ) || [];

  // Contacts are already filtered server-side, so just use them directly
  const filteredContacts = contacts || [];

  const filteredSubcontractors = subcontractors?.filter(s =>
    s.company_name?.toLowerCase().includes(vendorSearch.toLowerCase())
  ) || [];

  const isLoading = connectionLoading || mappingsLoading || accountsLoading || itemsLoading || paymentMethodsLoading;

  // Don't render if not connected (parent should not render us, but safety guard)
  if (!connectionLoading && !isConnected) {
    return null;
  }

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
                Click disconnect below, then use "Connect to QuickBooks" to re-authorize.
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
    <div className="space-y-6">
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
                Configure how your data maps to QuickBooks
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchAccounts();
              refetchItems();
              refetchCustomers();
              refetchVendors();
              if (activeTab === "gl") refetchAllAccounts();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
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

              <div className="space-y-2">
                <Label>Deposit/Unearned Revenue Account</Label>
                <Select
                  value={getDefaultMapping("deposit_account")?.qbo_id || ""}
                  onValueChange={(value) => {
                    const account = [...incomeAccounts, ...(accounts?.filter(a => a.type === "Other Current Liability") || [])].find((a) => a.id === value);
                    if (account) {
                      handleDefaultChange("deposit_account", account.id, account.name, account.type);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deposit account" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...incomeAccounts, ...(accounts?.filter(a => a.type === "Other Current Liability") || [])].map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Customer deposits before work completion
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

          <TabsContent value="customers" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Map Contacts to QuickBooks Customers</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Link your local contacts to existing QuickBooks customers for accurate invoice syncing
              </p>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <DebouncedInput
                  placeholder="Search contacts or customers..."
                  value={customerSearch}
                  onSave={setCustomerSearch}
                  debounceMs={400}
                  className="pl-9"
                />
              </div>
            </div>

            {contactsLoading || customersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-3">
                  {filteredContacts.length === 0 && !customerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Start typing to search your contacts
                    </p>
                  )}
                  {filteredContacts.length === 0 && customerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No contacts found matching "{customerSearch}"
                    </p>
                  )}
                  {filteredContacts.map((contact) => {
                    const displayName = contact.contact_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || contact.email || "Unnamed";
                    const existingMapping = getSourceMapping("customer", contact.id);
                    
                    return (
                      <div key={contact.id} className={`flex items-center gap-3 p-2 rounded-md border ${existingMapping ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-background"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          {contact.email && (
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          )}
                        </div>
                        <Select
                          value={existingMapping?.qbo_id || ""}
                          onValueChange={(value) => {
                            const customer = qbCustomers?.find((c) => c.id === value);
                            if (customer) {
                              handleSourceMapping("customer", contact.id, customer.id, customer.name);
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select QB customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredQbCustomers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {filteredContacts.length >= 100 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Showing first 100 results. Refine your search for more specific results.
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{qbCustomers?.length || 0}</Badge>
              <span>QuickBooks customers available</span>
            </div>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Map Subcontractors to QuickBooks Vendors</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Link your local subcontractors to existing QuickBooks vendors for accurate bill syncing
              </p>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <DebouncedInput
                  placeholder="Search subcontractors or vendors..."
                  value={vendorSearch}
                  onSave={setVendorSearch}
                  debounceMs={400}
                  className="pl-9"
                />
              </div>
            </div>

            {vendorsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-3">
                  {filteredSubcontractors.map((sub) => {
                    const existingMapping = getSourceMapping("vendor", sub.id);
                    
                    return (
                      <div key={sub.id} className={`flex items-center gap-3 p-2 rounded-md border ${existingMapping ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-background"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.company_name || "Unnamed"}</p>
                        </div>
                        <Select
                          value={existingMapping?.qbo_id || ""}
                          onValueChange={(value) => {
                            const vendor = qbVendors?.find((v) => v.id === value);
                            if (vendor) {
                              handleSourceMapping("vendor", sub.id, vendor.id, vendor.name);
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select QB vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredQbVendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {filteredSubcontractors.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No subcontractors found</p>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{qbVendors?.length || 0}</Badge>
              <span>QuickBooks vendors available</span>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      </Card>

      {/* Matching Rules */}
      <QuickBooksMatchingRules
        contacts={contacts || []}
        subcontractors={subcontractors || []}
        qbCustomers={qbCustomers || []}
        qbVendors={qbVendors || []}
        existingMappings={mappings || []}
        onMappingCreated={() => queryClient.invalidateQueries({ queryKey: ["qb-mappings", companyId] })}
      />
    </div>
  );
}
