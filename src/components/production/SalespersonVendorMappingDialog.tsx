import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Search, Plus, UserCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface QBVendor {
  id: string;
  name: string;
  type?: string;
  subType?: string | null;
}

interface SalespersonVendorMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salespersonId: string;
  salespersonName: string;
  onMappingComplete: () => void;
}

export function SalespersonVendorMappingDialog({
  open,
  onOpenChange,
  salespersonId,
  salespersonName,
  onMappingComplete,
}: SalespersonVendorMappingDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOption, setSelectedOption] = useState<"search" | "create">("search");
  const [selectedVendor, setSelectedVendor] = useState<QBVendor | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm(salespersonName || "");
      setSelectedOption("search");
      setSelectedVendor(null);
    }
  }, [open, salespersonName]);

  // Fetch QB vendors with search
  const { data: qbVendors = [], isLoading: isLoadingVendors, refetch: searchVendors } = useQuery({
    queryKey: ["qb-vendor-search", companyId, searchTerm],
    queryFn: async (): Promise<QBVendor[]> => {
      if (!companyId || !searchTerm.trim()) return [];

      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: {
          companyId,
          entityType: "Vendor",
          search: searchTerm.trim(),
        },
      });

      if (error) throw error;
      return data?.entities || [];
    },
    enabled: !!companyId && !!searchTerm.trim() && open,
    staleTime: 30000,
  });

  // Mutation to create mapping
  const createMappingMutation = useMutation({
    mutationFn: async (params: { qboId: string; qboName: string } | { createNew: true }) => {
      if (!companyId) throw new Error("No company context");

      if ("createNew" in params) {
        // Mark for auto-creation: store a special mapping that indicates "create on sync"
        const { error } = await supabase.from("quickbooks_mappings").upsert(
          {
            company_id: companyId,
            mapping_type: "salesperson_vendor",
            source_value: salespersonId,
            qbo_id: "PENDING_CREATE",
            qbo_name: salespersonName,
          },
          { onConflict: "company_id,mapping_type,source_value" }
        );
        if (error) throw error;
      } else {
        // Map to existing vendor
        const { error } = await supabase.from("quickbooks_mappings").upsert(
          {
            company_id: companyId,
            mapping_type: "salesperson_vendor",
            source_value: salespersonId,
            qbo_id: params.qboId,
            qbo_name: params.qboName,
          },
          { onConflict: "company_id,mapping_type,source_value" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["qb-salesperson-vendor-mappings"] });
      toast.success(
        selectedOption === "create"
          ? "Vendor will be created in QuickBooks on next sync"
          : "Salesperson mapped to vendor successfully"
      );
      onMappingComplete();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to save mapping: " + (error as Error).message);
    },
  });

  const handleConfirm = () => {
    if (selectedOption === "search" && selectedVendor) {
      createMappingMutation.mutate({ qboId: selectedVendor.id, qboName: selectedVendor.name });
    } else if (selectedOption === "create") {
      createMappingMutation.mutate({ createNew: true });
    }
  };

  const canConfirm =
    (selectedOption === "search" && selectedVendor) || selectedOption === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Map Salesperson to QuickBooks Vendor
          </DialogTitle>
          <DialogDescription>
            <strong>{salespersonName}</strong> is not mapped to a QuickBooks vendor.
            Commission payments need a vendor mapping to sync to QuickBooks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={selectedOption}
            onValueChange={(v) => setSelectedOption(v as "search" | "create")}
            className="space-y-3"
          >
            {/* Option 1: Search existing vendors */}
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedOption === "search" ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => setSelectedOption("search")}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="search" id="search" className="mt-1" />
                <div className="flex-1 space-y-3">
                  <Label htmlFor="search" className="cursor-pointer font-medium">
                    Find existing vendor in QuickBooks
                  </Label>

                  {selectedOption === "search" && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search vendor name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              searchVendors();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => searchVendors()}
                          disabled={isLoadingVendors}
                        >
                          {isLoadingVendors ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {qbVendors.length > 0 && (
                        <ScrollArea className="h-40 border rounded-md">
                          <div className="p-2 space-y-1">
                            {qbVendors.map((vendor) => (
                              <div
                                key={vendor.id}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                  selectedVendor?.id === vendor.id
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted"
                                }`}
                                onClick={() => setSelectedVendor(vendor)}
                              >
                                <span className="truncate">{vendor.name}</span>
                                {selectedVendor?.id === vendor.id && (
                                  <Badge variant="secondary" className="ml-2">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}

                      {searchTerm && !isLoadingVendors && qbVendors.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No vendors found matching "{searchTerm}"
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Create new vendor on sync */}
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedOption === "create" ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => setSelectedOption("create")}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="create" id="create" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="create" className="cursor-pointer font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create new vendor in QuickBooks
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    A new vendor named "{salespersonName}" will be automatically created in
                    QuickBooks the next time you sync a commission payment.
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>

          {selectedOption === "create" && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="text-amber-800 dark:text-amber-200">
                The vendor will be created with the salesperson's name. You can edit it in
                QuickBooks after creation.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || createMappingMutation.isPending}
          >
            {createMappingMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {selectedOption === "create" ? "Mark for Creation" : "Map to Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
