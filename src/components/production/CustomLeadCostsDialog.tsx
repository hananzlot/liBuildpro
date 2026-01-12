import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Info, Calculator } from "lucide-react";

interface CustomLeadCostsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultLeadCostPercent: number;
  onWeightedAverageCalculated: (weightedAvg: number, isWeighted: boolean) => void;
}

interface AgreementLeadCost {
  id: string;
  agreementNumber: string | null;
  agreementType: string | null;
  totalPrice: number;
  leadCostPercent: number | null;
  category: "Contract" | "Change Order / Other";
}

export function CustomLeadCostsDialog({
  open,
  onOpenChange,
  projectId,
  defaultLeadCostPercent,
  onWeightedAverageCalculated,
}: CustomLeadCostsDialogProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  // Local state for editing lead costs
  const [contractLeadCost, setContractLeadCost] = useState<number>(defaultLeadCostPercent);
  const [changeOrderLeadCost, setChangeOrderLeadCost] = useState<number>(defaultLeadCostPercent);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch agreements for this project
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["project-agreements-lead-costs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, agreement_number, agreement_type, total_price, lead_cost_percent")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: open && !!projectId,
  });

  // Categorize agreements and calculate defaults
  const categorizedAgreements = useMemo(() => {
    return agreements.map((agreement): AgreementLeadCost => ({
      id: agreement.id,
      agreementNumber: agreement.agreement_number,
      agreementType: agreement.agreement_type,
      totalPrice: agreement.total_price || 0,
      leadCostPercent: agreement.lead_cost_percent,
      category: agreement.agreement_type === "Contract" ? "Contract" : "Change Order / Other",
    }));
  }, [agreements]);

  // Group by category
  const contractAgreements = categorizedAgreements.filter(a => a.category === "Contract");
  const changeOrderAgreements = categorizedAgreements.filter(a => a.category === "Change Order / Other");

  // Calculate totals by category
  const contractTotal = contractAgreements.reduce((sum, a) => sum + a.totalPrice, 0);
  const changeOrderTotal = changeOrderAgreements.reduce((sum, a) => sum + a.totalPrice, 0);
  const grandTotal = contractTotal + changeOrderTotal;

  // Determine current lead cost % for each category (from first agreement or default)
  useEffect(() => {
    if (agreements.length > 0) {
      // Get lead cost from first Contract type agreement, or default
      const firstContract = contractAgreements[0];
      const firstChangeOrder = changeOrderAgreements[0];
      
      setContractLeadCost(firstContract?.leadCostPercent ?? defaultLeadCostPercent);
      setChangeOrderLeadCost(firstChangeOrder?.leadCostPercent ?? defaultLeadCostPercent);
    } else {
      setContractLeadCost(defaultLeadCostPercent);
      setChangeOrderLeadCost(defaultLeadCostPercent);
    }
  }, [agreements, defaultLeadCostPercent, contractAgreements, changeOrderAgreements]);

  // Calculate weighted average
  const weightedAverage = useMemo(() => {
    if (grandTotal === 0) return defaultLeadCostPercent;
    
    const contractWeightedCost = contractTotal * contractLeadCost;
    const changeOrderWeightedCost = changeOrderTotal * changeOrderLeadCost;
    
    return (contractWeightedCost + changeOrderWeightedCost) / grandTotal;
  }, [contractTotal, changeOrderTotal, contractLeadCost, changeOrderLeadCost, grandTotal, defaultLeadCostPercent]);

  // Check if using weighted average (different percentages)
  const isUsingWeightedAverage = contractLeadCost !== changeOrderLeadCost && grandTotal > 0;

  // Save mutation
  const saveLeadCosts = async () => {
    setIsSaving(true);
    try {
      // Update all Contract type agreements
      if (contractAgreements.length > 0) {
        const { error: contractError } = await supabase
          .from("project_agreements")
          .update({ lead_cost_percent: contractLeadCost })
          .eq("project_id", projectId)
          .eq("agreement_type", "Contract");
        
        if (contractError) throw contractError;
      }

      // Update all non-Contract type agreements
      if (changeOrderAgreements.length > 0) {
        const { error: changeOrderError } = await supabase
          .from("project_agreements")
          .update({ lead_cost_percent: changeOrderLeadCost })
          .neq("agreement_type", "Contract")
          .eq("project_id", projectId);
        
        if (changeOrderError) throw changeOrderError;
      }

      // Update the project's lead_cost_percent with weighted average
      const { error: projectError } = await supabase
        .from("projects")
        .update({ lead_cost_percent: Math.round(weightedAverage * 100) / 100 })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["project-agreements-lead-costs", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      // Callback with new weighted average
      onWeightedAverageCalculated(Math.round(weightedAverage * 100) / 100, isUsingWeightedAverage);

      toast.success("Lead costs updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving lead costs:", error);
      toast.error("Failed to save lead costs");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Custom Lead Costs by Contract Type
          </DialogTitle>
          <DialogDescription>
            Set different lead cost percentages for Contracts vs Change Orders. The system will calculate a weighted average based on the contract values.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lead Cost Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Total Value</TableHead>
                  <TableHead className="text-xs text-right w-[100px]">Lead Cost %</TableHead>
                  <TableHead className="text-xs text-right">Lead Cost $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Contract Row */}
                <TableRow>
                  <TableCell className="text-xs font-medium">
                    Contracts
                    <span className="text-muted-foreground ml-1">({contractAgreements.length})</span>
                  </TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(contractTotal)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={contractLeadCost}
                        onChange={(e) => setContractLeadCost(parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 text-xs text-right ml-auto"
                      />
                    ) : (
                      <span className="text-xs">{contractLeadCost}%</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right text-amber-600">
                    {formatCurrency(contractTotal * (contractLeadCost / 100))}
                  </TableCell>
                </TableRow>

                {/* Change Order Row */}
                <TableRow>
                  <TableCell className="text-xs font-medium">
                    Change Orders / Others
                    <span className="text-muted-foreground ml-1">({changeOrderAgreements.length})</span>
                  </TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(changeOrderTotal)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={changeOrderLeadCost}
                        onChange={(e) => setChangeOrderLeadCost(parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 text-xs text-right ml-auto"
                      />
                    ) : (
                      <span className="text-xs">{changeOrderLeadCost}%</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right text-amber-600">
                    {formatCurrency(changeOrderTotal * (changeOrderLeadCost / 100))}
                  </TableCell>
                </TableRow>

                {/* Total Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(grandTotal)}</TableCell>
                  <TableCell className="text-xs text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-end gap-1 cursor-help">
                            {weightedAverage.toFixed(2)}%
                            {isUsingWeightedAverage && <Info className="h-3 w-3 text-muted-foreground" />}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-medium mb-1">Weighted Average Calculation:</p>
                          <p className="text-xs text-muted-foreground">
                            ({formatCurrency(contractTotal)} × {contractLeadCost}% + {formatCurrency(changeOrderTotal)} × {changeOrderLeadCost}%) ÷ {formatCurrency(grandTotal)}
                          </p>
                          <p className="text-xs mt-1">
                            = ({formatCurrency(contractTotal * (contractLeadCost / 100))} + {formatCurrency(changeOrderTotal * (changeOrderLeadCost / 100))}) ÷ {formatCurrency(grandTotal)}
                          </p>
                          <p className="text-xs font-medium mt-1">
                            = {weightedAverage.toFixed(2)}%
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-xs text-right text-amber-600 font-semibold">
                    {formatCurrency(grandTotal * (weightedAverage / 100))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Explanation */}
            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">How it works:</p>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>Set different lead cost % for Contracts vs Change Orders</li>
                    <li>The weighted average is calculated based on each category's total value</li>
                    <li>This weighted average will be used for profit calculations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isAdmin && (
            <Button onClick={saveLeadCosts} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Standalone component for viewing weighted average breakdown
export function WeightedAverageTooltip({
  projectId,
  leadCostPercent,
}: {
  projectId: string;
  leadCostPercent: number;
}) {
  // Fetch agreements to show breakdown
  const { data: agreements = [] } = useQuery({
    queryKey: ["project-agreements-lead-costs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, agreement_type, total_price, lead_cost_percent")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
  });

  // Check if there are different lead costs across agreements
  const hasMultipleLeadCosts = useMemo(() => {
    const leadCosts = agreements
      .map(a => a.lead_cost_percent)
      .filter(lc => lc !== null);
    
    if (leadCosts.length <= 1) return false;
    return new Set(leadCosts).size > 1;
  }, [agreements]);

  if (!hasMultipleLeadCosts || agreements.length === 0) {
    return null;
  }

  // Group by type
  const contractAgreements = agreements.filter(a => a.agreement_type === "Contract");
  const changeOrderAgreements = agreements.filter(a => a.agreement_type !== "Contract");
  
  const contractTotal = contractAgreements.reduce((sum, a) => sum + (a.total_price || 0), 0);
  const changeOrderTotal = changeOrderAgreements.reduce((sum, a) => sum + (a.total_price || 0), 0);
  const grandTotal = contractTotal + changeOrderTotal;
  
  const contractLeadCost = contractAgreements[0]?.lead_cost_percent ?? leadCostPercent;
  const changeOrderLeadCost = changeOrderAgreements[0]?.lead_cost_percent ?? leadCostPercent;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-help">
            (Weighted Avg)
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-medium mb-2">Weighted Average Breakdown:</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Contracts ({formatCurrency(contractTotal)}):</span>
              <span>{contractLeadCost}%</span>
            </div>
            <div className="flex justify-between">
              <span>Change Orders ({formatCurrency(changeOrderTotal)}):</span>
              <span>{changeOrderLeadCost}%</span>
            </div>
            <div className="border-t pt-1 mt-1 flex justify-between font-medium">
              <span>Weighted Average:</span>
              <span>{leadCostPercent}%</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
