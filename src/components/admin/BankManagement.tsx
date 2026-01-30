import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Building2, ChevronDown, Search, X, Calendar, DollarSign, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils";

interface Bank {
  id: string;
  name: string;
  company_id: string;
  created_at: string;
  created_by: string | null;
}

interface BankStats {
  paymentCount: number;
  totalReceived: number;
  totalPaid: number;
}

interface PaymentDetail {
  id: string;
  type: "received" | "paid";
  amount: number;
  date: string | null;
  projectName: string | null;
  projectAddress: string | null;
  projectId: string | null;
  reference: string | null;
  status: string | null;
}

export function BankManagement() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [bankName, setBankName] = useState("");
  
  // Detail sheet state
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch banks
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["banks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data as Bank[];
    },
    enabled: !!companyId,
  });

  // Get stats for each bank (payment count + total received)
  const { data: bankStats = {} } = useQuery({
    queryKey: ["bank-stats", companyId, banks.map(b => b.name).join(",")],
    queryFn: async () => {
      if (!companyId || banks.length === 0) return {};
      
      const bankNames = banks.map(b => b.name);

      // Get project payments (received) with amounts
      const { data: projectPayments } = await supabase
        .from("project_payments")
        .select("bank_name, payment_amount, payment_status, is_voided")
        .eq("company_id", companyId)
        .in("bank_name", bankNames);

      // Get bill payments (paid out)
      const { data: billPayments } = await supabase
        .from("bill_payments")
        .select("bank_name, payment_amount")
        .eq("company_id", companyId)
        .in("bank_name", bankNames);

      // Get commission payments (paid out)
      const { data: commissionPayments } = await supabase
        .from("commission_payments")
        .select("bank_name, payment_amount")
        .eq("company_id", companyId)
        .in("bank_name", bankNames);

      const stats: Record<string, BankStats> = {};
      
      // Initialize stats for all banks
      bankNames.forEach(name => {
        stats[name] = { paymentCount: 0, totalReceived: 0, totalPaid: 0 };
      });

      // Count project payments (received) - only count non-voided received payments
      (projectPayments || []).forEach(p => {
        if (p.bank_name && !p.is_voided) {
          stats[p.bank_name].paymentCount += 1;
          if (p.payment_status === "Received") {
            stats[p.bank_name].totalReceived += (p.payment_amount || 0);
          }
        }
      });

      // Count bill payments and sum amounts
      (billPayments || []).forEach(p => {
        if (p.bank_name) {
          stats[p.bank_name].paymentCount += 1;
          stats[p.bank_name].totalPaid += (p.payment_amount || 0);
        }
      });

      // Count commission payments and sum amounts
      (commissionPayments || []).forEach(p => {
        if (p.bank_name) {
          stats[p.bank_name].paymentCount += 1;
          stats[p.bank_name].totalPaid += (p.payment_amount || 0);
        }
      });
      
      return stats;
    },
    enabled: !!companyId && banks.length > 0,
  });

  // Fetch detailed payments for selected bank
  const { data: bankPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["bank-payments-detail", companyId, selectedBank?.name],
    queryFn: async () => {
      if (!companyId || !selectedBank) return [];
      
      const payments: PaymentDetail[] = [];

      // Get project payments with project info
      const { data: projectPayments } = await supabase
        .from("project_payments")
        .select("id, payment_amount, projected_received_date, payment_status, check_number, is_voided, project_id")
        .eq("company_id", companyId)
        .eq("bank_name", selectedBank.name)
        .eq("is_voided", false);

      // Get project names and addresses for the payments
      const projectIds = [...new Set((projectPayments || []).map(p => p.project_id).filter(Boolean))];
      let projectMap: Record<string, { name: string; address: string | null }> = {};
      
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, project_name, project_address")
          .in("id", projectIds);
        
        projectMap = (projects || []).reduce((acc, p) => {
          acc[p.id] = { 
            name: p.project_name || "Unknown Project",
            address: p.project_address || null
          };
          return acc;
        }, {} as Record<string, { name: string; address: string | null }>);
      }

      (projectPayments || []).forEach(p => {
        const projectInfo = p.project_id ? projectMap[p.project_id] : null;
        payments.push({
          id: p.id,
          type: "received",
          amount: p.payment_amount || 0,
          date: p.projected_received_date,
          projectName: projectInfo?.name || null,
          projectAddress: projectInfo?.address || null,
          projectId: p.project_id,
          reference: p.check_number,
          status: p.payment_status,
        });
      });

      // Get bill payments with project info
      const { data: billPayments } = await supabase
        .from("bill_payments")
        .select("id, payment_amount, payment_date, payment_reference, bill_id")
        .eq("company_id", companyId)
        .eq("bank_name", selectedBank.name);

      // Get bill -> project mapping
      const billIds = [...new Set((billPayments || []).map(p => p.bill_id).filter(Boolean))];
      let billProjectMap: Record<string, { projectId: string; projectName: string; projectAddress: string | null }> = {};
      
      if (billIds.length > 0) {
        const { data: bills } = await supabase
          .from("project_bills")
          .select("id, project_id")
          .in("id", billIds);
        
        const billProjectIds = [...new Set((bills || []).map(b => b.project_id).filter(Boolean))];
        if (billProjectIds.length > 0) {
          const { data: billProjects } = await supabase
            .from("projects")
            .select("id, project_name, project_address")
            .in("id", billProjectIds);
          
          const billProjectData = (billProjects || []).reduce((acc, p) => {
            acc[p.id] = { 
              name: p.project_name || "Unknown Project",
              address: p.project_address || null
            };
            return acc;
          }, {} as Record<string, { name: string; address: string | null }>);

          (bills || []).forEach(b => {
            if (b.project_id) {
              const projData = billProjectData[b.project_id];
              billProjectMap[b.id] = {
                projectId: b.project_id,
                projectName: projData?.name || "Unknown",
                projectAddress: projData?.address || null,
              };
            }
          });
        }
      }

      (billPayments || []).forEach(p => {
        const billInfo = p.bill_id ? billProjectMap[p.bill_id] : null;
        payments.push({
          id: p.id,
          type: "paid",
          amount: p.payment_amount || 0,
          date: p.payment_date,
          projectName: billInfo?.projectName || null,
          projectAddress: billInfo?.projectAddress || null,
          projectId: billInfo?.projectId || null,
          reference: p.payment_reference,
          status: null,
        });
      });

      // Get commission payments with project info
      const { data: commissionPayments } = await supabase
        .from("commission_payments")
        .select("id, payment_amount, payment_date, payment_reference, salesperson_name, project_id")
        .eq("company_id", companyId)
        .eq("bank_name", selectedBank.name);

      const commProjectIds = [...new Set((commissionPayments || []).map(p => p.project_id).filter(Boolean))];
      let commProjectMap: Record<string, { name: string; address: string | null }> = {};
      
      if (commProjectIds.length > 0) {
        const { data: commProjects } = await supabase
          .from("projects")
          .select("id, project_name, project_address")
          .in("id", commProjectIds);
        
        commProjectMap = (commProjects || []).reduce((acc, p) => {
          acc[p.id] = { 
            name: p.project_name || "Unknown Project",
            address: p.project_address || null
          };
          return acc;
        }, {} as Record<string, { name: string; address: string | null }>);
      }

      (commissionPayments || []).forEach(p => {
        const projInfo = p.project_id ? commProjectMap[p.project_id] : null;
        payments.push({
          id: p.id,
          type: "paid",
          amount: p.payment_amount || 0,
          date: p.payment_date,
          projectName: projInfo?.name || null,
          projectAddress: projInfo?.address || null,
          projectId: p.project_id,
          reference: p.salesperson_name ? `Commission: ${p.salesperson_name}` : p.payment_reference,
          status: null,
        });
      });

      // Sort by date descending
      return payments.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    },
    enabled: !!companyId && !!selectedBank,
  });

  // Filter payments
  const filteredPayments = useMemo(() => {
    return bankPayments.filter(p => {
      // Project name or address filter
      if (projectFilter) {
        const searchTerm = projectFilter.toLowerCase();
        const nameMatch = p.projectName?.toLowerCase().includes(searchTerm);
        const addressMatch = p.projectAddress?.toLowerCase().includes(searchTerm);
        if (!nameMatch && !addressMatch) {
          return false;
        }
      }
      
      // Date range filter
      if (startDate && p.date) {
        if (new Date(p.date) < new Date(startDate)) {
          return false;
        }
      }
      if (endDate && p.date) {
        if (new Date(p.date) > new Date(endDate + "T23:59:59")) {
          return false;
        }
      }
      
      return true;
    });
  }, [bankPayments, projectFilter, startDate, endDate]);

  // Calculate totals for filtered payments
  const filteredTotals = useMemo(() => {
    const received = filteredPayments
      .filter(p => p.type === "received" && p.status === "Received")
      .reduce((sum, p) => sum + p.amount, 0);
    const paid = filteredPayments
      .filter(p => p.type === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    return { received, paid, net: received - paid };
  }, [filteredPayments]);

  // Save bank mutation
  const saveBankMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("No company selected");
      
      if (editingBank) {
        // Update existing bank
        const { error } = await supabase
          .from("banks")
          .update({ name })
          .eq("id", editingBank.id);
        if (error) throw error;
        
        // Update all payment references to the new name
        const oldName = editingBank.name;
        if (oldName !== name) {
          await Promise.all([
            supabase
              .from("bill_payments")
              .update({ bank_name: name })
              .eq("company_id", companyId)
              .eq("bank_name", oldName),
            supabase
              .from("project_payments")
              .update({ bank_name: name })
              .eq("company_id", companyId)
              .eq("bank_name", oldName),
            supabase
              .from("commission_payments")
              .update({ bank_name: name })
              .eq("company_id", companyId)
              .eq("bank_name", oldName),
          ]);
        }
      } else {
        // Create new bank
        const { error } = await supabase
          .from("banks")
          .insert({ name, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingBank ? "Bank updated" : "Bank added");
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bank-stats", companyId] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Delete bank mutation
  const deleteBankMutation = useMutation({
    mutationFn: async (bank: Bank) => {
      // First, clear bank_name references in payment tables
      await Promise.all([
        supabase
          .from("bill_payments")
          .update({ bank_name: null })
          .eq("company_id", companyId)
          .eq("bank_name", bank.name),
        supabase
          .from("project_payments")
          .update({ bank_name: null })
          .eq("company_id", companyId)
          .eq("bank_name", bank.name),
        supabase
          .from("commission_payments")
          .update({ bank_name: null })
          .eq("company_id", companyId)
          .eq("bank_name", bank.name),
      ]);

      // Then delete the bank
      const { error } = await supabase
        .from("banks")
        .delete()
        .eq("id", bank.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank deleted");
      queryClient.invalidateQueries({ queryKey: ["banks", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bank-stats", companyId] });
      setDeleteDialogOpen(false);
      setDeletingBank(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleOpenDialog = (bank?: Bank, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (bank) {
      setEditingBank(bank);
      setBankName(bank.name);
    } else {
      setEditingBank(null);
      setBankName("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBank(null);
    setBankName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      toast.error("Bank name is required");
      return;
    }
    saveBankMutation.mutate(bankName.trim());
  };

  const handleDelete = (bank: Bank, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingBank(bank);
    setDeleteDialogOpen(true);
  };

  const handleRowClick = (bank: Bank) => {
    setSelectedBank(bank);
    setProjectFilter("");
    setStartDate("");
    setEndDate("");
    setDetailSheetOpen(true);
  };

  const clearFilters = () => {
    setProjectFilter("");
    setStartDate("");
    setEndDate("");
  };

  const hasFilters = projectFilter || startDate || endDate;

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base">Bank Accounts</CardTitle>
                  <CardDescription>
                    Manage bank accounts used for payments
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex justify-end mb-4">
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bank
              </Button>
            </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No bank accounts configured</p>
            <p className="text-sm mt-1">Add your first bank account to use in payments</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank Name</TableHead>
                <TableHead className="text-center">Payments</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => {
                const stats = bankStats[bank.name] || { paymentCount: 0, totalReceived: 0, totalPaid: 0 };
                return (
                  <TableRow 
                    key={bank.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(bank)}
                  >
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {stats.paymentCount}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(stats.totalReceived)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {formatCurrency(stats.totalPaid)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {bank.created_at ? format(new Date(bank.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleOpenDialog(bank, e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => handleDelete(bank, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
          </CardContent>
        </CollapsibleContent>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBank ? "Edit Bank" : "Add Bank Account"}</DialogTitle>
            <DialogDescription>
              {editingBank 
                ? "Update the bank account name. All payment references will be updated automatically."
                : "Add a new bank account that can be used when recording payments."
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Chase Business Checking"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveBankMutation.isPending}>
                {saveBankMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingBank ? "Update" : "Add Bank"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deletingBank?.name}" from your bank list.
              {((bankStats[deletingBank?.name || ""]?.paymentCount || 0) > 0) && (
                <span className="block mt-2 text-amber-600">
                  Warning: This bank is referenced in {bankStats[deletingBank?.name || ""]?.paymentCount} payment(s). 
                  Those payments will have their bank field cleared.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBank && deleteBankMutation.mutate(deletingBank)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBankMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bank Payments Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedBank?.name}
            </SheetTitle>
            <SheetDescription>
              All payments associated with this bank account
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by project name or address..."
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1"
                    placeholder="Start date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1"
                    placeholder="End date"
                  />
                </div>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="shrink-0">
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3" />
                  Received
                </div>
                <div className="text-lg font-semibold text-green-700">
                  {formatCurrency(filteredTotals.received)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-xs text-red-600 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Paid Out
                </div>
                <div className="text-lg font-semibold text-red-700">
                  {formatCurrency(filteredTotals.paid)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Net
                </div>
                <div className={`text-lg font-semibold ${filteredTotals.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(filteredTotals.net)}
                </div>
              </div>
            </div>

            {/* Payments List */}
            <ScrollArea className="h-[calc(100vh-380px)]">
              {loadingPayments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No payments found</p>
                  {hasFilters && (
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPayments.map((payment) => (
                    <div
                      key={`${payment.type}-${payment.id}`}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Badge 
                            variant={payment.type === "received" ? "default" : "secondary"}
                            className={payment.type === "received" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}
                          >
                            {payment.type === "received" 
                              ? (payment.status ? `Received - ${payment.status}` : "Received")
                              : "Paid"
                            }
                          </Badge>
                          <p className="mt-1 font-medium truncate">
                            {payment.projectName || "No project"}
                          </p>
                          {payment.reference && (
                            <p className="text-sm text-muted-foreground truncate">
                              {payment.reference}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold ${payment.type === "received" ? "text-green-600" : "text-red-600"}`}>
                            {payment.type === "received" ? "+" : "-"}{formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.date ? format(new Date(payment.date), "MMM d, yyyy") : "No date"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  </Collapsible>
  );
}
