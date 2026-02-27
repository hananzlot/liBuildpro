import { useState, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Building2, Loader2, Search, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface QBCustomer {
  id: string;
  name: string;
  type?: string;
}

interface QBCustomerMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  customerName: string | null;
  projectAddress: string | null;
  onMapped: (customerId: string, customerName: string) => void;
  onSkipSync: () => void;
  onCancel: () => void;
  /** Label for the skip/secondary button (defaults to "Record Locally Only") */
  skipLabel?: string;
}

export function QBCustomerMappingDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  customerName,
  projectAddress,
  onMapped,
  onSkipSync,
  onCancel,
  skipLabel = "Record Locally Only",
}: QBCustomerMappingDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<QBCustomer | null>(null);

  // Fetch QB customers
  const { data: customersData, isLoading, error } = useQuery({
    queryKey: ["qb-customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-list-entities", {
        body: { companyId, entityType: "Customer" },
      });
      if (error) throw error;
      return data as { entities: QBCustomer[] };
    },
    enabled: open && !!companyId,
    staleTime: 60000,
  });

  const customers = customersData?.entities || [];

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const lower = search.toLowerCase();
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(lower)
    );
  }, [customers, search]);

  // Mutation to save the mapping
  const saveMappingMutation = useMutation({
    mutationFn: async ({ customerId, customerDisplayName }: { customerId: string; customerDisplayName: string }) => {
      const { error } = await supabase
        .from("quickbooks_mappings")
        .upsert({
          company_id: companyId,
          mapping_type: "project_customer",
          source_value: projectId,
          qbo_id: customerId,
          qbo_name: customerDisplayName,
        }, {
          onConflict: "company_id,mapping_type,source_value",
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Project linked to QuickBooks customer");
      queryClient.invalidateQueries({ queryKey: ["project-qb-mapping"] });
      onMapped(variables.customerId, variables.customerDisplayName);
    },
    onError: (error) => {
      toast.error(`Failed to save mapping: ${error.message}`);
    },
  });

  const handleSelect = () => {
    if (selectedCustomer) {
      saveMappingMutation.mutate({
        customerId: selectedCustomer.id,
        customerDisplayName: selectedCustomer.name,
      });
    }
  };

  const handleSkipSync = () => {
    onSkipSync();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const isSubmitting = saveMappingMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Link Project to QuickBooks Customer
          </DialogTitle>
          <DialogDescription>
            Select which QuickBooks customer this project should be linked to for job costing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project info */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="text-sm font-medium">{projectName}</div>
            {customerName && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <UserCircle className="h-3 w-3" />
                {customerName}
              </div>
            )}
            {projectAddress && (
              <div className="text-xs text-muted-foreground">{projectAddress}</div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search QuickBooks customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load customers: {error instanceof Error ? error.message : "Unknown error"}</span>
            </div>
          )}

          {/* Customer list */}
          {!isLoading && !error && (
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-1">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? "No customers match your search" : "No customers found in QuickBooks"}
                  </div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const isSelected = selectedCustomer?.id === customer.id;
                    return (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-sm">{customer.name}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSkipSync} disabled={isSubmitting}>
            {skipLabel}
          </Button>
          <Button onClick={handleSelect} disabled={!selectedCustomer || isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isSubmitting ? "Saving..." : "Link & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
