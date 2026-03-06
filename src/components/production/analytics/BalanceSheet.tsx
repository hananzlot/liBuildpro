import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectWithFinancials, BankTransaction } from "@/hooks/useProductionAnalytics";
import { cn, formatCurrency } from "@/lib/utils";

interface BalanceSheetProps {
  projects: ProjectWithFinancials[];
  allProjects: ProjectWithFinancials[];
  viewMode: "aggregate" | "per-project";
  onProjectClick?: (projectId: string, initialTab?: string) => void;
  bankTransactions?: BankTransaction[];
}

interface BSLineItem {
  label: string;
  amount: number;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  indent?: boolean;
  isSubItem?: boolean;
}

function BSTable({ lines, title }: { lines: BSLineItem[]; title?: string }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {title && (
        <div className="bg-muted/50 px-4 py-2 border-b">
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
      )}
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={cn(
                "border-b last:border-0",
                line.isTotal && "bg-muted/30 font-semibold",
                line.isGrandTotal && "bg-primary/10 font-bold text-base"
              )}
            >
              <td className={cn("py-2 px-4", line.indent && "pl-8", line.isSubItem && "pl-12 text-xs text-muted-foreground")}>
                {line.label}
              </td>
              <td
                className={cn(
                  "py-2 px-4 text-right tabular-nums",
                  line.amount < 0 && "text-destructive",
                  line.isSubItem && "text-xs text-muted-foreground"
                )}
              >
                {formatCurrency(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function computeBankBreakdown(bankTransactions: BankTransaction[]) {
  const bankMap = new Map<string, number>();

  bankTransactions.forEach((txn) => {
    const bankName = txn.bank_or_method || "Unassigned";
    const current = bankMap.get(bankName) || 0;
    if (txn.type === "in") {
      bankMap.set(bankName, current + txn.amount);
    } else {
      bankMap.set(bankName, current - txn.amount);
    }
  });

  return Array.from(bankMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, balance]) => ({ name, balance }));
}

function computeAggregateBS(projects: ProjectWithFinancials[], bankTransactions?: BankTransaction[]) {
  const cashCollected = projects.reduce((s, p) => s + p.invoicesCollected, 0);
  const cashPaidOut = projects.reduce((s, p) => s + p.totalBillsPaid, 0);
  const netCash = cashCollected - cashPaidOut;
  const accountsReceivable = projects.reduce((s, p) => s + p.invoiceBalanceDue, 0);
  const totalAssets = netCash + accountsReceivable;
  const billsOutstanding = projects.reduce((s, p) => s + (p.totalBillsReceived - p.totalBillsPaid), 0);
  const totalLiabilities = billsOutstanding;
  const retainedEarnings = totalAssets - totalLiabilities;

  const bankBreakdown = bankTransactions ? computeBankBreakdown(bankTransactions) : [];

  return { cashCollected, cashPaidOut, netCash, accountsReceivable, totalAssets, billsOutstanding, totalLiabilities, retainedEarnings, bankBreakdown };
}

export function BalanceSheet({ projects, allProjects, viewMode, onProjectClick, bankTransactions }: BalanceSheetProps) {
  const data = useMemo(() => computeAggregateBS(allProjects, bankTransactions), [allProjects, bankTransactions]);

  const perProject = useMemo(() => {
    return projects
      .filter(p => p.invoicesCollected > 0 || p.invoiceBalanceDue > 0 || p.totalBillsReceived > 0)
      .sort((a, b) => b.invoicesCollected - a.invoicesCollected)
      .map(p => {
        const cashIn = p.invoicesCollected;
        const cashOut = p.totalBillsPaid;
        const netCash = cashIn - cashOut;
        const ar = p.invoiceBalanceDue;
        const ap = p.totalBillsReceived - p.totalBillsPaid;
        return {
          project: p,
          netCash,
          ar,
          totalAssets: netCash + ar,
          ap,
          totalLiabilities: ap,
          equity: netCash + ar - ap,
        };
      });
  }, [projects]);

  // Build asset lines with bank breakdown
  const assetLines: BSLineItem[] = useMemo(() => {
    const lines: BSLineItem[] = [];

    // Cash section header
    lines.push({ label: "Cash", amount: data.netCash, indent: true });

    // Bank sub-items
    if (data.bankBreakdown.length > 0) {
      data.bankBreakdown.forEach((bank) => {
        lines.push({ label: bank.name, amount: bank.balance, isSubItem: true });
      });
    }

    lines.push({ label: "Accounts Receivable", amount: data.accountsReceivable, indent: true });
    lines.push({ label: "Total Assets", amount: data.totalAssets, isTotal: true });

    return lines;
  }, [data]);

  const liabilityLines: BSLineItem[] = [
    { label: "Accounts Payable (Bills Outstanding)", amount: data.billsOutstanding, indent: true },
    { label: "Total Liabilities", amount: data.totalLiabilities, isTotal: true },
  ];

  const equityLines: BSLineItem[] = [
    { label: "Retained Earnings", amount: data.retainedEarnings, indent: true },
    { label: "Total Equity", amount: data.retainedEarnings, isTotal: true },
  ];

  const balanceCheck: BSLineItem[] = [
    {
      label: "Total Liabilities + Equity",
      amount: data.totalLiabilities + data.retainedEarnings,
      isGrandTotal: true,
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Balance Sheet</h2>

      {viewMode === "aggregate" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Company Balance Sheet — All Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BSTable lines={assetLines} title="Assets" />
            <BSTable lines={liabilityLines} title="Liabilities" />
            <BSTable lines={equityLines} title="Equity" />
            <BSTable lines={balanceCheck} />
            <p className="text-xs text-muted-foreground">
              Cash = collections received − bill payments made. Assets = cash + outstanding invoices.
              Liabilities = unpaid bills. Equity = retained earnings (assets − liabilities).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">

          {/* Per-project */}
          {perProject.map(({ project, netCash, ar, totalAssets, ap, totalLiabilities, equity }) => (
            <Card key={project.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    #{project.project_number} — {project.project_name}
                  </span>
                  {onProjectClick && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onProjectClick(project.id, "finance")}
                    >
                      View Project
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BSTable
                  lines={[
                    { label: "Cash (Net)", amount: netCash, indent: true },
                    { label: "Accounts Receivable", amount: ar, indent: true },
                    { label: "Total Assets", amount: totalAssets, isTotal: true },
                  ]}
                  title="Assets"
                />
                <BSTable
                  lines={[
                    { label: "Accounts Payable", amount: ap, indent: true },
                    { label: "Total Liabilities", amount: totalLiabilities, isTotal: true },
                  ]}
                  title="Liabilities"
                />
                <BSTable
                  lines={[
                    { label: "Equity (Net Position)", amount: equity, isGrandTotal: true },
                  ]}
                />
              </CardContent>
            </Card>
          ))}

          {perProject.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No projects with financial activity found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
