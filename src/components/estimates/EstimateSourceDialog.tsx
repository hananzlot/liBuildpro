import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { fetchAllPages } from "@/lib/supabasePagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Plus, Search, Loader2, User, DollarSign, MapPin } from "lucide-react";

export interface LinkedOpportunity {
  id: string;
  ghl_id: string | null;
  name: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  address?: string | null;
  scope_of_work?: string | null;
  monetary_value?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  salesperson_name?: string | null;
  /** Lead source from the linked contact */
  lead_source?: string | null;
}

interface EstimateSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (opportunity: LinkedOpportunity | null, createOpportunityOnSave: boolean) => void;
}

export function EstimateSourceDialog({
  open,
  onOpenChange,
  onContinue,
}: EstimateSourceDialogProps) {
  const { companyId } = useCompanyContext();
  const [sourceType, setSourceType] = useState<"existing" | "new">("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  // Fetch opportunities with contact info - paginated to handle large datasets
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ["opportunities-for-estimate", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Fetch opportunities - paginated to get all open/won opportunities
      const opps = await fetchAllPages(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, ghl_id, name, contact_id, contact_uuid, address, scope_of_work, monetary_value, status")
          .eq("company_id", companyId)
          .in("status", ["open", "won"])
          .order("ghl_date_added", { ascending: false })
          .range(from, to);
        
        if (error) throw error;
        return data;
      });
      
      // Fetch contacts for these opportunities (by UUID for better reliability)
      const contactUuids = [...new Set(opps?.filter(o => o.contact_uuid).map(o => o.contact_uuid) || [])];
      const contactGhlIds = [...new Set(opps?.filter(o => o.contact_id && !o.contact_uuid).map(o => o.contact_id) || [])];
      
      let contactMapByUuid = new Map<string, { name: string | null; email: string | null; phone: string | null; source: string | null }>();
      let contactMapByGhlId = new Map<string, { id: string | null; name: string | null; email: string | null; phone: string | null; source: string | null }>();
      
      if (contactUuids.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, ghl_id, contact_name, email, phone, source")
          .in("id", contactUuids);
        
        contacts?.forEach(c => {
          contactMapByUuid.set(c.id, {
            name: c.contact_name,
            email: c.email,
            phone: c.phone,
            source: c.source,
          });
        });
      }
      
      if (contactGhlIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, ghl_id, contact_name, email, phone, source")
          .in("ghl_id", contactGhlIds);
        
        contacts?.forEach(c => {
          contactMapByGhlId.set(c.ghl_id, {
            id: c.id,
            name: c.contact_name,
            email: c.email,
            phone: c.phone,
            source: c.source,
          });
        });
      }
      
      return (opps || []).map(opp => {
        // Get contact info - prefer UUID lookup, fall back to GHL ID
        const contactByUuid = opp.contact_uuid ? contactMapByUuid.get(opp.contact_uuid) : null;
        const contactByGhlId = opp.contact_id ? contactMapByGhlId.get(opp.contact_id) : null;
        const contactInfo = contactByUuid || contactByGhlId;
        
        return {
          ...opp,
          // Ensure contact_uuid is set even if only contact_id was on the opportunity
          contact_uuid: opp.contact_uuid || contactByGhlId?.id || null,
          contact_name: contactInfo?.name || null,
          contact_email: contactInfo?.email || null,
          contact_phone: contactInfo?.phone || null,
          lead_source: contactInfo?.source || null,
        };
      });
    },
    enabled: open && !!companyId,
  });

  // Filter opportunities by search
  const filteredOpportunities = useMemo(() => {
    if (!searchQuery.trim()) return opportunities;
    const query = searchQuery.toLowerCase();
    return opportunities.filter(opp => 
      opp.name?.toLowerCase().includes(query) ||
      opp.contact_name?.toLowerCase().includes(query) ||
      opp.contact_email?.toLowerCase().includes(query) ||
      opp.address?.toLowerCase().includes(query)
    );
  }, [opportunities, searchQuery]);

  const selectedOpportunity = opportunities.find(o => o.id === selectedOpportunityId);

  const handleContinue = () => {
    if (sourceType === "existing" && selectedOpportunity) {
      onContinue(selectedOpportunity as LinkedOpportunity, false);
    } else {
      onContinue(null, sourceType === "new");
    }
    // Reset state
    setSourceType("existing");
    setSearchQuery("");
    setSelectedOpportunityId(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Estimate</DialogTitle>
          <DialogDescription>
            Choose whether to link this estimate to an existing opportunity or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={sourceType}
            onValueChange={(value) => setSourceType(value as "existing" | "new")}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="existing"
                id="existing"
                className="peer sr-only"
              />
              <Label
                htmlFor="existing"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <FileText className="mb-3 h-6 w-6" />
                <span className="font-semibold">Link to Existing Opportunity</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  Auto-fill customer info from opportunity
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="new"
                id="new"
                className="peer sr-only"
              />
              <Label
                htmlFor="new"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Plus className="mb-3 h-6 w-6" />
                <span className="font-semibold">Create New Opportunity</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  A new opportunity will be created when you save
                </span>
              </Label>
            </div>
          </RadioGroup>

          {sourceType === "existing" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities by name, contact, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No opportunities found matching your search" : "No opportunities available"}
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        onClick={() => setSelectedOpportunityId(opp.id)}
                        className={`p-3 rounded-md cursor-pointer transition-colors ${
                          selectedOpportunityId === opp.id
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {opp.name || "Untitled Opportunity"}
                            </div>
                            {opp.contact_name && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">{opp.contact_name}</span>
                                {opp.contact_email && (
                                  <span className="text-xs">({opp.contact_email})</span>
                                )}
                              </div>
                            )}
                            {opp.address && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{opp.address}</span>
                              </div>
                            )}
                          </div>
                          {opp.monetary_value && opp.monetary_value > 0 && (
                            <div className="flex items-center gap-1 text-sm font-medium text-green-600 ml-2">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(opp.monetary_value)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {sourceType === "new" && (
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                When you save this estimate, a new opportunity will be automatically created with:
              </p>
              <ul className="mt-2 text-sm space-y-1 text-muted-foreground list-disc list-inside">
                <li>Customer information from the estimate</li>
                <li>Source set to <span className="font-medium text-foreground">"Manual estimate created"</span></li>
                <li>Stage set to <span className="font-medium text-foreground">"Estimate Prepared"</span></li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={sourceType === "existing" && !selectedOpportunityId}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
