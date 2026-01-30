import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Search,
  Merge,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  User,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string;
  ghl_id?: string | null;
  name?: string | null;
  contact_id?: string | null;
  contact_uuid?: string | null;
  stage_name?: string | null;
  pipeline_name?: string | null;
  monetary_value?: number | null;
  status?: string | null;
  address?: string | null;
  scope_of_work?: string | null;
  assigned_to?: string | null;
  ghl_date_added?: string | null;
  created_at?: string;
  won_at?: string | null;
}

interface MergeOpportunitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: Opportunity[];
  contacts: any[];
  users: any[];
}

type MergeField = {
  key: keyof Opportunity;
  label: string;
  icon: React.ElementType;
  format?: (value: any) => string;
};

const MERGE_FIELDS: MergeField[] = [
  { key: "name", label: "Opportunity Name", icon: FileText },
  { key: "address", label: "Address", icon: MapPin },
  { key: "scope_of_work", label: "Scope of Work", icon: FileText },
  { key: "monetary_value", label: "Value", icon: DollarSign, format: (v) => v ? `$${Number(v).toLocaleString()}` : "—" },
  { key: "stage_name", label: "Stage", icon: CheckCircle2 },
  { key: "assigned_to", label: "Assigned To", icon: User },
  { key: "won_at", label: "Won Date", icon: Calendar, format: (v) => v ? format(new Date(v), "MMM d, yyyy") : "—" },
];

export function MergeOpportunitiesDialog({
  open,
  onOpenChange,
  opportunities,
  contacts,
  users,
}: MergeOpportunitiesDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<"select" | "compare">("select");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [oppA, setOppA] = useState<Opportunity | null>(null);
  const [oppB, setOppB] = useState<Opportunity | null>(null);
  const [primary, setPrimary] = useState<"A" | "B">("A");
  const [fieldSelections, setFieldSelections] = useState<Record<string, "A" | "B">>({});

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select");
      setSearchA("");
      setSearchB("");
      setOppA(null);
      setOppB(null);
      setPrimary("A");
      setFieldSelections({});
    }
    onOpenChange(isOpen);
  };

  // Filter opportunities for search
  const filterOpps = (search: string, exclude?: string) => {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return opportunities
      .filter((o) => o.id !== exclude)
      .filter((o) => {
        const name = o.name?.toLowerCase() || "";
        const address = o.address?.toLowerCase() || "";
        const contact = contacts.find(
          (c) => c.id === o.contact_uuid || c.ghl_id === o.contact_id
        );
        const contactName = contact?.contact_name?.toLowerCase() || "";
        return name.includes(lower) || address.includes(lower) || contactName.includes(lower);
      })
      .slice(0, 8);
  };

  const resultsA = useMemo(() => filterOpps(searchA, oppB?.id), [searchA, opportunities, oppB?.id]);
  const resultsB = useMemo(() => filterOpps(searchB, oppA?.id), [searchB, opportunities, oppA?.id]);

  // Get contact name helper
  const getContactName = (opp: Opportunity) => {
    const contact = contacts.find(
      (c) => c.id === opp.contact_uuid || c.ghl_id === opp.contact_id
    );
    return contact?.contact_name || "Unknown";
  };

  // Get user name helper
  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users.find((u) => u.ghl_id === userId || u.id === userId);
    return user?.name || user?.email || userId;
  };

  // Initialize field selections when moving to compare step
  const initializeSelections = () => {
    const selections: Record<string, "A" | "B"> = {};
    MERGE_FIELDS.forEach((field) => {
      // Default to primary, or prefer the one with data
      const valueA = oppA?.[field.key];
      const valueB = oppB?.[field.key];
      const aHasValue = valueA !== null && valueA !== undefined && valueA !== "";
      const bHasValue = valueB !== null && valueB !== undefined && valueB !== "";
      
      if (aHasValue && !bHasValue) {
        selections[field.key] = "A";
      } else if (!aHasValue && bHasValue) {
        selections[field.key] = "B";
      } else {
        selections[field.key] = primary;
      }
    });
    setFieldSelections(selections);
  };

  const handleProceedToCompare = () => {
    if (!oppA || !oppB) {
      toast.error("Please select both opportunities to merge");
      return;
    }
    initializeSelections();
    setStep("compare");
  };

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!oppA || !oppB || !companyId) throw new Error("Missing data");

      const primaryOpp = primary === "A" ? oppA : oppB;
      const secondaryOpp = primary === "A" ? oppB : oppA;

      // Build merged data based on field selections
      const mergedData: Record<string, any> = {};
      MERGE_FIELDS.forEach((field) => {
        const selection = fieldSelections[field.key];
        const sourceOpp = selection === "A" ? oppA : oppB;
        if (sourceOpp[field.key] !== undefined) {
          mergedData[field.key] = sourceOpp[field.key];
        }
      });

      // Always keep primary's core fields
      mergedData.ghl_id = primaryOpp.ghl_id;
      mergedData.contact_id = primaryOpp.contact_id;
      mergedData.contact_uuid = primaryOpp.contact_uuid;
      mergedData.updated_at = new Date().toISOString();

      // 1. Update the primary opportunity with merged data
      const { error: updateError } = await supabase
        .from("opportunities")
        .update(mergedData)
        .eq("id", primaryOpp.id);

      if (updateError) throw updateError;

      // 2. Transfer related records from secondary to primary
      // Estimates
      await supabase
        .from("estimates")
        .update({
          opportunity_id: primaryOpp.ghl_id,
          opportunity_uuid: primaryOpp.id,
        })
        .eq("opportunity_uuid", secondaryOpp.id);

      // Also update by ghl_id if present
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("estimates")
          .update({
            opportunity_id: primaryOpp.ghl_id,
            opportunity_uuid: primaryOpp.id,
          })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Projects
      await supabase
        .from("projects")
        .update({
          opportunity_id: primaryOpp.ghl_id,
          opportunity_uuid: primaryOpp.id,
        })
        .eq("opportunity_uuid", secondaryOpp.id);

      if (secondaryOpp.ghl_id) {
        await supabase
          .from("projects")
          .update({
            opportunity_id: primaryOpp.ghl_id,
            opportunity_uuid: primaryOpp.id,
          })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Tasks
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("tasks")
          .update({ opportunity_id: primaryOpp.ghl_id })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Scope submissions
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("scope_submissions")
          .update({ opportunity_id: primaryOpp.ghl_id })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // 3. Delete the secondary opportunity
      const { error: deleteError } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", secondaryOpp.id);

      if (deleteError) throw deleteError;

      return { primaryId: primaryOpp.id, secondaryId: secondaryOpp.id };
    },
    onSuccess: () => {
      toast.success("Opportunities merged successfully");
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });

  const renderOpportunityCard = (opp: Opportunity, side: "A" | "B") => {
    const isPrimary = primary === side;
    return (
      <div
        className={cn(
          "p-4 rounded-lg border-2 transition-all",
          isPrimary 
            ? "border-primary bg-primary/5" 
            : "border-muted bg-muted/30"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{opp.name || "Unnamed"}</h4>
            <p className="text-sm text-muted-foreground truncate">
              {getContactName(opp)}
            </p>
          </div>
          <Button
            variant={isPrimary ? "default" : "outline"}
            size="sm"
            onClick={() => setPrimary(side)}
            className="shrink-0"
          >
            {isPrimary ? "Primary" : "Set Primary"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{opp.stage_name || "No stage"}</Badge>
          {opp.monetary_value && (
            <Badge variant="secondary">
              ${Number(opp.monetary_value).toLocaleString()}
            </Badge>
          )}
        </div>
        {isPrimary && (
          <p className="text-xs text-primary mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            This opportunity will be kept
          </p>
        )}
      </div>
    );
  };

  const renderFieldComparison = (field: MergeField) => {
    const valueA = oppA?.[field.key];
    const valueB = oppB?.[field.key];
    const displayA = field.format ? field.format(valueA) : (valueA || "—");
    const displayB = field.format ? field.format(valueB) : (valueB || "—");
    const Icon = field.icon;
    const selected = fieldSelections[field.key];

    // Handle assigned_to specially to show names
    const finalDisplayA = field.key === "assigned_to" ? getUserName(valueA as string) : displayA;
    const finalDisplayB = field.key === "assigned_to" ? getUserName(valueB as string) : displayB;

    return (
      <div key={field.key} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-3">
        <button
          onClick={() => setFieldSelections((prev) => ({ ...prev, [field.key]: "A" }))}
          className={cn(
            "p-3 rounded-lg border text-left transition-all",
            selected === "A"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-muted hover:border-primary/50"
          )}
        >
          <p className="text-sm font-medium truncate">{finalDisplayA}</p>
        </button>

        <div className="flex flex-col items-center gap-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground text-center">{field.label}</span>
        </div>

        <button
          onClick={() => setFieldSelections((prev) => ({ ...prev, [field.key]: "B" }))}
          className={cn(
            "p-3 rounded-lg border text-left transition-all",
            selected === "B"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-muted hover:border-primary/50"
          )}
        >
          <p className="text-sm font-medium truncate">{finalDisplayB}</p>
        </button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Opportunities
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Search and select two opportunities to merge together."
              : "Choose which values to keep for the merged opportunity."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Opportunity A Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">First Opportunity</Label>
              {oppA ? (
                <div className="relative">
                  {renderOpportunityCard(oppA, "A")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setOppA(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, or contact..."
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsA.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsA.map((opp) => (
                        <button
                          key={opp.id}
                          onClick={() => {
                            setOppA(opp);
                            setSearchA("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">{opp.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getContactName(opp)} • {opp.address || "No address"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Opportunity B Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Second Opportunity</Label>
              {oppB ? (
                <div className="relative">
                  {renderOpportunityCard(oppB, "B")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setOppB(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, or contact..."
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsB.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsB.map((opp) => (
                        <button
                          key={opp.id}
                          onClick={() => {
                            setOppB(opp);
                            setSearchB("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">{opp.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getContactName(opp)} • {opp.address || "No address"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {/* Primary Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                {oppA && renderOpportunityCard(oppA, "A")}
                {oppB && renderOpportunityCard(oppB, "B")}
              </div>

              <Separator />

              {/* Field-by-field comparison */}
              <div>
                <h4 className="font-medium mb-2">Choose values for each field</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on a value to select it for the merged opportunity.
                </p>
                <div className="space-y-1 divide-y">
                  {MERGE_FIELDS.map(renderFieldComparison)}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All linked records (estimates, projects, tasks) will be transferred to the 
                  primary opportunity. The other opportunity will be permanently deleted.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "compare" && (
            <Button variant="outline" onClick={() => setStep("select")}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {step === "select" ? (
            <Button
              onClick={handleProceedToCompare}
              disabled={!oppA || !oppB}
            >
              Compare & Merge
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
              variant="destructive"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-1" />
                  Merge Opportunities
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
