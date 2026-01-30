import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2, Settings2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MatchingConfig {
  customerRules: {
    matchByName: boolean;
    matchByEmail: boolean;
    nameMatchType: "exact" | "contains" | "fuzzy";
  };
  vendorRules: {
    matchByCompanyName: boolean;
    nameMatchType: "exact" | "contains" | "fuzzy";
  };
}

const DEFAULT_CONFIG: MatchingConfig = {
  customerRules: {
    matchByName: true,
    matchByEmail: true,
    nameMatchType: "contains",
  },
  vendorRules: {
    matchByCompanyName: true,
    nameMatchType: "contains",
  },
};

interface Contact {
  id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Subcontractor {
  id: string;
  company_name: string | null;
}

interface QBEntity {
  id: string;
  name: string;
}

interface QuickBooksMatchingRulesProps {
  contacts: Contact[];
  subcontractors: Subcontractor[];
  qbCustomers: QBEntity[];
  qbVendors: QBEntity[];
  existingMappings: Array<{
    mapping_type: string;
    source_value: string | null;
    qbo_id: string;
    qbo_name: string;
  }>;
  onMappingCreated: () => void;
}

export function QuickBooksMatchingRules({
  contacts,
  subcontractors,
  qbCustomers,
  qbVendors,
  existingMappings,
  onMappingCreated,
}: QuickBooksMatchingRulesProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch matching config from company_settings
  const { data: matchingConfig, isLoading: configLoading } = useQuery({
    queryKey: ["qb-matching-config", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "qb_matching_config")
        .maybeSingle();

      if (error) throw error;
      if (data?.setting_value) {
        try {
          return JSON.parse(data.setting_value) as MatchingConfig;
        } catch {
          return DEFAULT_CONFIG;
        }
      }
      return DEFAULT_CONFIG;
    },
    enabled: !!companyId,
  });

  const config = matchingConfig || DEFAULT_CONFIG;

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: MatchingConfig) => {
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: "qb_matching_config",
          setting_value: JSON.stringify(newConfig),
          setting_type: "json",
          description: "QuickBooks auto-matching configuration",
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb-matching-config", companyId] });
      toast.success("Matching rules saved");
    },
    onError: (error: Error) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const updateConfig = (updates: Partial<MatchingConfig>) => {
    const newConfig = { ...config, ...updates };
    saveConfigMutation.mutate(newConfig);
  };

  // Normalize string for matching
  const normalize = (str: string | null | undefined): string => {
    return (str || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  };

  // Check if strings match based on match type
  const matchStrings = (a: string, b: string, matchType: "exact" | "contains" | "fuzzy"): boolean => {
    const normA = normalize(a);
    const normB = normalize(b);

    if (!normA || !normB) return false;

    switch (matchType) {
      case "exact":
        return normA === normB;
      case "contains":
        return normA.includes(normB) || normB.includes(normA);
      case "fuzzy":
        // Simple fuzzy: check if 80% of characters match in sequence
        const longer = normA.length > normB.length ? normA : normB;
        const shorter = normA.length > normB.length ? normB : normA;
        if (shorter.length < 3) return normA === normB;
        
        let matchCount = 0;
        let lastIndex = -1;
        for (const char of shorter) {
          const idx = longer.indexOf(char, lastIndex + 1);
          if (idx > lastIndex) {
            matchCount++;
            lastIndex = idx;
          }
        }
        return matchCount / shorter.length >= 0.8;
      default:
        return false;
    }
  };

  // Find best match for a contact
  const findCustomerMatch = (contact: Contact): QBEntity | null => {
    const contactName = contact.contact_name || 
      `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
    const contactEmail = contact.email;

    for (const customer of qbCustomers) {
      // Check by email first (most reliable)
      if (config.customerRules.matchByEmail && contactEmail) {
        // QB customer name sometimes contains email
        if (customer.name.toLowerCase().includes(contactEmail.toLowerCase())) {
          return customer;
        }
      }

      // Check by name
      if (config.customerRules.matchByName && contactName) {
        if (matchStrings(contactName, customer.name, config.customerRules.nameMatchType)) {
          return customer;
        }
      }
    }

    return null;
  };

  // Find best match for a subcontractor
  const findVendorMatch = (sub: Subcontractor): QBEntity | null => {
    if (!sub.company_name) return null;

    for (const vendor of qbVendors) {
      if (config.vendorRules.matchByCompanyName) {
        if (matchStrings(sub.company_name, vendor.name, config.vendorRules.nameMatchType)) {
          return vendor;
        }
      }
    }

    return null;
  };

  // Auto-match mutation
  const autoMatchMutation = useMutation({
    mutationFn: async () => {
      const mappingsToCreate: Array<{
        company_id: string;
        mapping_type: string;
        source_value: string;
        qbo_id: string;
        qbo_name: string;
        is_default: boolean;
      }> = [];

      // Find customer matches
      for (const contact of contacts) {
        // Skip if already mapped
        const alreadyMapped = existingMappings.some(
          (m) => m.mapping_type === "customer" && m.source_value === contact.id
        );
        if (alreadyMapped) continue;

        const match = findCustomerMatch(contact);
        if (match) {
          mappingsToCreate.push({
            company_id: companyId!,
            mapping_type: "customer",
            source_value: contact.id,
            qbo_id: match.id,
            qbo_name: match.name,
            is_default: false,
          });
        }
      }

      // Find vendor matches
      for (const sub of subcontractors) {
        const alreadyMapped = existingMappings.some(
          (m) => m.mapping_type === "vendor" && m.source_value === sub.id
        );
        if (alreadyMapped) continue;

        const match = findVendorMatch(sub);
        if (match) {
          mappingsToCreate.push({
            company_id: companyId!,
            mapping_type: "vendor",
            source_value: sub.id,
            qbo_id: match.id,
            qbo_name: match.name,
            is_default: false,
          });
        }
      }

      if (mappingsToCreate.length === 0) {
        return { created: 0 };
      }

      const { error } = await supabase
        .from("quickbooks_mappings")
        .upsert(mappingsToCreate, { onConflict: "company_id,mapping_type,source_value" });

      if (error) throw error;

      return { created: mappingsToCreate.length };
    },
    onSuccess: (result) => {
      if (result.created > 0) {
        toast.success(`Auto-matched ${result.created} records`);
        onMappingCreated();
      } else {
        toast.info("No new matches found");
      }
      setIsAutoMatching(false);
    },
    onError: (error: Error) => {
      toast.error("Auto-match failed: " + error.message);
      setIsAutoMatching(false);
    },
  });

  const handleAutoMatch = () => {
    setIsAutoMatching(true);
    autoMatchMutation.mutate();
  };

  // Count potential matches (preview)
  const countPotentialMatches = () => {
    let customerMatches = 0;
    let vendorMatches = 0;

    for (const contact of contacts) {
      const alreadyMapped = existingMappings.some(
        (m) => m.mapping_type === "customer" && m.source_value === contact.id
      );
      if (!alreadyMapped && findCustomerMatch(contact)) {
        customerMatches++;
      }
    }

    for (const sub of subcontractors) {
      const alreadyMapped = existingMappings.some(
        (m) => m.mapping_type === "vendor" && m.source_value === sub.id
      );
      if (!alreadyMapped && findVendorMatch(sub)) {
        vendorMatches++;
      }
    }

    return { customerMatches, vendorMatches };
  };

  const { customerMatches, vendorMatches } = countPotentialMatches();
  const totalPotential = customerMatches + vendorMatches;

  if (configLoading) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Auto-Matching Rules
                    {totalPotential > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {totalPotential} potential matches
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure how contacts and subcontractors are matched to QuickBooks
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Customer Matching Rules */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Customer Matching (Contacts → QB Customers)
              </h4>
              
              <div className="grid gap-4 pl-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="match-by-name">Match by Name</Label>
                    <p className="text-xs text-muted-foreground">
                      Compare contact names with QB customer names
                    </p>
                  </div>
                  <Switch
                    id="match-by-name"
                    checked={config.customerRules.matchByName}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        customerRules: { ...config.customerRules, matchByName: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="match-by-email">Match by Email</Label>
                    <p className="text-xs text-muted-foreground">
                      Check if QB customer name contains contact email
                    </p>
                  </div>
                  <Switch
                    id="match-by-email"
                    checked={config.customerRules.matchByEmail}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        customerRules: { ...config.customerRules, matchByEmail: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Name Match Sensitivity</Label>
                    <p className="text-xs text-muted-foreground">
                      How strict should name matching be?
                    </p>
                  </div>
                  <Select
                    value={config.customerRules.nameMatchType}
                    onValueChange={(value: "exact" | "contains" | "fuzzy") =>
                      updateConfig({
                        customerRules: { ...config.customerRules, nameMatchType: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="fuzzy">Fuzzy Match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Vendor Matching Rules */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Vendor Matching (Subcontractors → QB Vendors)
              </h4>
              
              <div className="grid gap-4 pl-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="match-by-company">Match by Company Name</Label>
                    <p className="text-xs text-muted-foreground">
                      Compare subcontractor company names with QB vendor names
                    </p>
                  </div>
                  <Switch
                    id="match-by-company"
                    checked={config.vendorRules.matchByCompanyName}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        vendorRules: { ...config.vendorRules, matchByCompanyName: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Name Match Sensitivity</Label>
                    <p className="text-xs text-muted-foreground">
                      How strict should name matching be?
                    </p>
                  </div>
                  <Select
                    value={config.vendorRules.nameMatchType}
                    onValueChange={(value: "exact" | "contains" | "fuzzy") =>
                      updateConfig({
                        vendorRules: { ...config.vendorRules, nameMatchType: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="fuzzy">Fuzzy Match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Auto-Match Button */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Run Auto-Match</p>
                  <p className="text-xs text-muted-foreground">
                    {totalPotential > 0 ? (
                      <>
                        Found {customerMatches} customer and {vendorMatches} vendor potential matches
                      </>
                    ) : (
                      "No unmatched records found or no matches available"
                    )}
                  </p>
                </div>
                <Button
                  onClick={handleAutoMatch}
                  disabled={isAutoMatching || autoMatchMutation.isPending || totalPotential === 0}
                >
                  {isAutoMatching || autoMatchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Auto-Match ({totalPotential})
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
