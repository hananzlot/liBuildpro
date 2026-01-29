import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Building2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Bank {
  id: string;
  name: string;
  company_id: string;
  created_at: string;
  created_by: string | null;
}

export function BankManagement() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [bankName, setBankName] = useState("");

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

  // Count usage of each bank across payment tables
  const { data: bankUsage = {} } = useQuery({
    queryKey: ["bank-usage", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      
      const bankNames = banks.map(b => b.name);
      if (bankNames.length === 0) return {};

      // Get counts from each payment table
      const [billPayments, projectPayments, commissionPayments] = await Promise.all([
        supabase
          .from("bill_payments")
          .select("bank_name")
          .eq("company_id", companyId)
          .in("bank_name", bankNames),
        supabase
          .from("project_payments")
          .select("bank_name")
          .eq("company_id", companyId)
          .in("bank_name", bankNames),
        supabase
          .from("commission_payments")
          .select("bank_name")
          .eq("company_id", companyId)
          .in("bank_name", bankNames),
      ]);

      const usage: Record<string, number> = {};
      [...(billPayments.data || []), ...(projectPayments.data || []), ...(commissionPayments.data || [])]
        .forEach(p => {
          if (p.bank_name) {
            usage[p.bank_name] = (usage[p.bank_name] || 0) + 1;
          }
        });
      
      return usage;
    },
    enabled: !!companyId && banks.length > 0,
  });

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
      queryClient.invalidateQueries({ queryKey: ["bank-usage", companyId] });
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
      queryClient.invalidateQueries({ queryKey: ["bank-usage", companyId] });
      setDeleteDialogOpen(false);
      setDeletingBank(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleOpenDialog = (bank?: Bank) => {
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

  const handleDelete = (bank: Bank) => {
    setDeletingBank(bank);
    setDeleteDialogOpen(true);
  };

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
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => (
                <TableRow key={bank.id}>
                  <TableCell className="font-medium">{bank.name}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {bankUsage[bank.name] || 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(bank.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(bank)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(bank)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
              {(bankUsage[deletingBank?.name || ""] || 0) > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This bank is referenced in {bankUsage[deletingBank?.name || ""]} payment(s). 
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
    </Card>
  </Collapsible>
  );
}
