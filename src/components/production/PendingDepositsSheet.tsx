import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Loader2, Check, ExternalLink } from "lucide-react";

interface PendingDepositsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProject: (projectId: string) => void;
}

interface PendingPayment {
  id: string;
  project_id: string | null;
  bank_name: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  projected_received_date: string | null;
  check_number: string | null;
  deposit_verified: boolean | null;
  project?: {
    project_number: number;
    project_name: string;
    project_address: string | null;
  };
}

export function PendingDepositsSheet({ open, onOpenChange, onOpenProject }: PendingDepositsSheetProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const { data: pendingPayments = [], isLoading } = useQuery({
    queryKey: ["pending-deposits", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("project_payments")
        .select(`
          id,
          project_id,
          bank_name,
          payment_amount,
          payment_method,
          projected_received_date,
          check_number,
          deposit_verified,
          project:projects(project_number, project_name, project_address)
        `)
        .eq("company_id", companyId)
        .eq("payment_status", "Received")
        .eq("is_voided", false)
        .or("deposit_verified.is.null,deposit_verified.eq.false")
        .order("projected_received_date", { ascending: true });
      
      if (error) throw error;
      return data as PendingPayment[];
    },
    enabled: open && !!companyId,
  });

  const verifyMutation = useMutation({
    mutationFn: async (paymentIds: string[]) => {
      const { error } = await supabase
        .from("project_payments")
        .update({ deposit_verified: true })
        .in("id", paymentIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deposits verified successfully");
      queryClient.invalidateQueries({ queryKey: ["pending-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["project-payments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits-count"] });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits-count-tab"] });
      setSelectedPayments([]);
    },
    onError: (error) => {
      toast.error(`Failed to verify deposits: ${error.message}`);
    },
  });

  const handleSelectAll = () => {
    if (selectedPayments.length === pendingPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(pendingPayments.map(p => p.id));
    }
  };

  const handleSelectPayment = (paymentId: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId) 
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const handleVerifySelected = () => {
    if (selectedPayments.length === 0) return;
    verifyMutation.mutate(selectedPayments);
  };

  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const selectedTotal = pendingPayments
    .filter(p => selectedPayments.includes(p.id))
    .reduce((sum, p) => sum + (p.payment_amount || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Pending Deposit Verification
            <Badge variant="secondary">{pendingPayments.length}</Badge>
          </SheetTitle>
          <SheetDescription>
            Payments received but not yet verified as deposited. Total: {formatCurrency(totalPending)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {selectedPayments.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-sm">
                <span className="font-medium">{selectedPayments.length}</span> selected • {formatCurrency(selectedTotal)}
              </div>
              <Button 
                size="sm" 
                onClick={handleVerifySelected}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Mark as Deposited
              </Button>
            </div>
          )}

          <ScrollArea className="h-[calc(100vh-220px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Check className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>All deposits have been verified!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedPayments.length === pendingPayments.length && pendingPayments.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs">Bank</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Check #</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedPayments.includes(payment.id)}
                          onCheckedChange={() => handleSelectPayment(payment.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <p className="font-medium">
                            #{payment.project?.project_number} - {payment.project?.project_name || "Unknown"}
                          </p>
                          <p className="text-muted-foreground truncate max-w-[200px]">
                            {payment.project?.project_address || "No address"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{payment.bank_name || "-"}</TableCell>
                      <TableCell className="text-xs">{payment.payment_method || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {payment.projected_received_date 
                          ? format(parseISO(payment.projected_received_date), "MMM d, yyyy")
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-xs">{payment.check_number || "-"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(payment.payment_amount)}
                      </TableCell>
                      <TableCell>
                        {payment.project_id && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenProject(payment.project_id!);
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
