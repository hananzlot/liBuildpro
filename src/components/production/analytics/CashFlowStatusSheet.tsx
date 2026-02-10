import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectWithFinancials, BankTransaction } from "@/hooks/useProductionAnalytics";
import { cn, formatCurrency } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

interface CashFlowStatusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string | null;
  statusLabel: string;
  projects: ProjectWithFinancials[];
  bankTransactions: BankTransaction[];
  onProjectClick?: (projectId: string) => void;
}

type SortField = "date" | "entity";

export function CashFlowStatusSheet({
  open,
  onOpenChange,
  status,
  statusLabel,
  projects,
  bankTransactions,
  onProjectClick,
}: CashFlowStatusSheetProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Filter projects by status
  const statusProjects = useMemo(() => {
    if (!status) return [];
    return projects.filter(p => p.cashStatus === status);
  }, [projects, status]);

  const projectIds = useMemo(() => new Set(statusProjects.map(p => p.id)), [statusProjects]);

  // Get transactions for these projects
  const transactions = useMemo(() => {
    return bankTransactions.filter(t => t.project_id && projectIds.has(t.project_id));
  }, [bankTransactions, projectIds]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions];
    if (sortField === "date") {
      sorted.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return sortAsc ? da - db : db - da;
      });
    } else {
      sorted.sort((a, b) => {
        const entityA = a.type === "out" ? (a.vendor_name || a.project_name) : a.project_name;
        const entityB = b.type === "out" ? (b.vendor_name || b.project_name) : b.project_name;
        const cmp = entityA.localeCompare(entityB);
        return sortAsc ? cmp : -cmp;
      });
    }
    return sorted;
  }, [transactions, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "entity");
    }
  };

  const totalIn = transactions.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{statusLabel} — Transaction Details</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {statusProjects.length} project{statusProjects.length !== 1 ? "s" : ""} · {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-600 font-medium">In: {formatCurrency(totalIn)}</span>
            <span className="text-red-600 font-medium">Out: {formatCurrency(totalOut)}</span>
            <span className="font-semibold">Net: {formatCurrency(totalIn - totalOut)}</span>
          </div>
        </SheetHeader>

        <div className="mt-4">
          <div className="flex gap-2 mb-3">
            <Button
              variant={sortField === "date" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("date")}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              Date {sortField === "date" && (sortAsc ? "↑" : "↓")}
            </Button>
            <Button
              variant={sortField === "entity" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("entity")}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              Entity {sortField === "entity" && (sortAsc ? "↑" : "↓")}
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found for these projects
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTransactions.map(t => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => t.project_id && onProjectClick?.(t.project_id)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {t.date ? new Date(t.date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            t.type === "in"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20"
                          )}
                        >
                          {t.type === "in" ? "IN" : "OUT"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {t.project_name}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {t.type === "out" ? (t.vendor_name || t.bank_or_method || "-") : (t.bank_or_method || "-")}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {t.description}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
                          t.type === "in" ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {t.type === "in" ? "+" : "-"}{formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
