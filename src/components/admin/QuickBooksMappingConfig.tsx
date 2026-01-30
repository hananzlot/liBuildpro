import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, RefreshCw, Settings2, Search, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DebouncedInput } from "@/components/ui/debounced-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { QuickBooksMatchingRules } from "./QuickBooksMatchingRules";
import { Switch } from "@/components/ui/switch";

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

interface HiddenRecords {
  customers: string[];
  vendors: string[];
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
  const [showHiddenCustomers, setShowHiddenCustomers] = useState(false);
  const [showHiddenVendors, setShowHiddenVendors] = useState(false);

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

  // Fetch hidden records from company_settings
  const { data: hiddenRecords } = useQuery({
    queryKey: ["qb-hidden-records", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "qb_hidden_records")
        .maybeSingle();
      
      if (error) throw error;
      if (data?.setting_value) {
        try {
          return JSON.parse(data.setting_value) as HiddenRecords;
        } catch {
          return { customers: [], vendors: [] };
        }
      }
      return { customers: [], vendors: [] };
    },
    enabled: !!companyId,
  });

  // Mutation to update hidden records
  const updateHiddenMutation = useMutation({
    mutationFn: async (newHidden: HiddenRecords) => {
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: "qb_hidden_records",
          setting_value: JSON.stringify(newHidden),
          setting_type: "json",
          description: "Hidden records from QuickBooks matching screen",
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb-hidden-records", companyId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const toggleHideCustomer = (contactId: string) => {
    const current = hiddenRecords || { customers: [], vendors: [] };
    const isHidden = current.customers.includes(contactId);
    const newCustomers = isHidden
      ? current.customers.filter((id) => id !== contactId)
      : [...current.customers, contactId];
    updateHiddenMutation.mutate({ ...current, customers: newCustomers });
    toast.success(isHidden ? "Contact unhidden" : "Contact hidden from matching");
  };

  const toggleHideVendor = (subId: string) => {
    const current = hiddenRecords || { customers: [], vendors: [] };
    const isHidden = current.vendors.includes(subId);
    const newVendors = isHidden
      ? current.vendors.filter((id) => id !== subId)
      : [...current.vendors, subId];
    updateHiddenMutation.mutate({ ...current, vendors: newVendors });
    toast.success(isHidden ? "Subcontractor unhidden" : "Subcontractor hidden from matching");
  };

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

  // Fetch local banks
  const { data: localBanks } = useQuery({
    queryKey: ["banks-for-mapping", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Helper to check if a string looks like a phone number
  const looksLikePhoneNumber = (str: string | null): boolean => {
    if (!str) return false;
    // Remove all non-digit characters and check if it's mostly digits
    const digitsOnly = str.replace(/\D/g, "");
    return digitsOnly.length >= 7 && digitsOnly.length <= 15 && 
           digitsOnly.length / str.replace(/\s/g, "").length > 0.5;
  };

  // Fetch local contacts (customers) - search dynamically to handle large datasets
  // Includes opportunity address for searching
  const { data: contactsRaw, isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts-for-mapping", companyId, customerSearch],
    queryFn: async () => {
      // If searching, we need to check if search matches address via opportunities
      const searchTerm = customerSearch.trim();
      
      if (searchTerm) {
        // First, find contact IDs that match via opportunity address
        const { data: addressMatches } = await supabase
          .from("opportunities")
          .select("contact_uuid")
          .eq("company_id", companyId)
          .ilike("address", `%${searchTerm}%`)
          .limit(100);
        
        const addressMatchIds = (addressMatches || [])
          .map((o) => o.contact_uuid)
          .filter(Boolean) as string[];
        
        // Now fetch contacts matching name/email OR in the address match list
        let query = supabase
          .from("contacts")
          .select("id, contact_name, first_name, last_name, email")
          .eq("company_id", companyId)
          .order("contact_name")
          .limit(200);
        
        // Build OR filter for name/email matches
        if (addressMatchIds.length > 0) {
          query = query.or(
            `contact_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,id.in.(${addressMatchIds.join(",")})`
          );
        } else {
          query = query.or(
            `contact_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
          );
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
      } else {
        // No search term - just fetch contacts
        const { data, error } = await supabase
          .from("contacts")
          .select("id, contact_name, first_name, last_name, email")
          .eq("company_id", companyId)
          .order("contact_name")
          .limit(200);
        
        if (error) throw error;
        return data;
      }
    },
    enabled: !!companyId,
  });

  // Filter out contacts that only have phone numbers as names (not useful for matching)
  // Also filter out hidden contacts unless showHiddenCustomers is true
  const contacts = useMemo(() => {
    if (!contactsRaw) return [];
    const hiddenCustomerIds = hiddenRecords?.customers || [];
    return contactsRaw.filter((c) => {
      // Filter by hidden status
      const isHidden = hiddenCustomerIds.includes(c.id);
      if (isHidden && !showHiddenCustomers) return false;
      
      // Keep if has email
      if (c.email) return true;
      // Keep if has first/last name
      if (c.first_name || c.last_name) return true;
      // Keep if contact_name doesn't look like a phone number
      if (c.contact_name && !looksLikePhoneNumber(c.contact_name)) return true;
      return false;
    }).slice(0, 100); // Limit to 100 after filtering
  }, [contactsRaw, hiddenRecords?.customers, showHiddenCustomers]);

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

  // Fetch ALL accounts for GL tab and banks tab
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
    enabled: !!companyId && isConnected && !needsReauth && (activeTab === "gl" || activeTab === "banks"),
    retry: false,
  });

  // Filter QB bank accounts from allAccounts
  const qbBankAccounts = useMemo(() => {
    return (allAccounts || []).filter((a) => a.type === "Bank");
  }, [allAccounts]);

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

  // Filter subcontractors - also apply hidden filter
  const filteredSubcontractors = useMemo(() => {
    const hiddenVendorIds = hiddenRecords?.vendors || [];
    return (subcontractors || []).filter((s) => {
      const isHidden = hiddenVendorIds.includes(s.id);
      if (isHidden && !showHiddenVendors) return false;
      return s.company_name?.toLowerCase().includes(vendorSearch.toLowerCase());
    });
  }, [subcontractors, hiddenRecords?.vendors, showHiddenVendors, vendorSearch]);

  // Count hidden records
  const hiddenCustomerCount = hiddenRecords?.customers?.length || 0;
  const hiddenVendorCount = hiddenRecords?.vendors?.length || 0;

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
              if (activeTab === "gl" || activeTab === "banks") refetchAllAccounts();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="banks">Banks</TabsTrigger>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>Map Contacts to QuickBooks Customers</Label>
                  <p className="text-xs text-muted-foreground">
                    Link your local contacts to existing QuickBooks customers for accurate invoice syncing
                  </p>
                </div>
                {hiddenCustomerCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-hidden-customers" className="text-xs text-muted-foreground">
                      Show hidden ({hiddenCustomerCount})
                    </Label>
                    <Switch
                      id="show-hidden-customers"
                      checked={showHiddenCustomers}
                      onCheckedChange={setShowHiddenCustomers}
                    />
                  </div>
                )}
              </div>
              
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
                    const isHidden = hiddenRecords?.customers?.includes(contact.id);
                    
                    return (
                      <div 
                        key={contact.id} 
                        className={`flex items-center gap-3 p-2 rounded-md border ${
                          isHidden 
                            ? "bg-muted/50 border-dashed opacity-60" 
                            : existingMapping 
                              ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                              : "bg-background"
                        }`}
                      >
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => toggleHideCustomer(contact.id)}
                          title={isHidden ? "Unhide from matching" : "Hide from matching"}
                        >
                          {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>Map Subcontractors to QuickBooks Vendors</Label>
                  <p className="text-xs text-muted-foreground">
                    Link your local subcontractors to existing QuickBooks vendors for accurate bill syncing
                  </p>
                </div>
                {hiddenVendorCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-hidden-vendors" className="text-xs text-muted-foreground">
                      Show hidden ({hiddenVendorCount})
                    </Label>
                    <Switch
                      id="show-hidden-vendors"
                      checked={showHiddenVendors}
                      onCheckedChange={setShowHiddenVendors}
                    />
                  </div>
                )}
              </div>
              
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
                    const isHidden = hiddenRecords?.vendors?.includes(sub.id);
                    
                    return (
                      <div 
                        key={sub.id} 
                        className={`flex items-center gap-3 p-2 rounded-md border ${
                          isHidden 
                            ? "bg-muted/50 border-dashed opacity-60" 
                            : existingMapping 
                              ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                              : "bg-background"
                        }`}
                      >
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => toggleHideVendor(sub.id)}
                          title={isHidden ? "Unhide from matching" : "Hide from matching"}
                        >
                          {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
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

          <TabsContent value="banks" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Map App Banks to QuickBooks Bank Accounts</Label>
              <p className="text-xs text-muted-foreground">
                Link your local bank names to QuickBooks bank accounts for accurate payment syncing
              </p>
            </div>

            {allAccountsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-3">
                  {(localBanks || []).map((bank) => {
                    const existingMapping = getSourceMapping("bank", bank.id);
                    
                    return (
                      <div 
                        key={bank.id} 
                        className={`flex items-center gap-3 p-2 rounded-md border ${
                          existingMapping 
                            ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                            : "bg-background"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{bank.name}</p>
                        </div>
                        <Select
                          value={existingMapping?.qbo_id || ""}
                          onValueChange={(value) => {
                            const qbBank = qbBankAccounts.find((b) => b.id === value);
                            if (qbBank) {
                              handleSourceMapping("bank", bank.id, qbBank.id, qbBank.name, qbBank.type);
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select QB bank account" />
                          </SelectTrigger>
                          <SelectContent>
                            {qbBankAccounts.map((qbBank) => (
                              <SelectItem key={qbBank.id} value={qbBank.id}>
                                {qbBank.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {(localBanks || []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No banks configured. Add banks in the Banks management section.
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{qbBankAccounts.length}</Badge>
              <span>QuickBooks bank accounts available</span>
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
