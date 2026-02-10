import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";
import { cn } from "@/lib/utils";

interface BalanceSheetProps {
  projects: ProjectWithFinancials[];
  allProjects: ProjectWithFinancials[];
  viewMode: "aggregate" | "per-project";
  onProjectClick?: (projectId: string, initialTab?: string) => void;
}

interface BSLineItem {
  label: string;
  amount: number;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  indent?: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
              <td className={cn("py-2 px-4", line.indent && "pl-8")}>
                {line.label}
              </td>
              <td
                className={cn(
                  "py-2 px-4 text-right tabular-nums",
                  line.amount < 0 && "text-destructive"
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

function computeAggregateBS(projects: ProjectWithFinancials[]) {
  const cashCollected = projects.reduce((s, p) => s + p.invoicesCollected, 0);
  const accountsReceivable = projects.reduce((s, p) => s + p.invoiceBalanceDue, 0);
  const totalAssets = cashCollected + accountsReceivable;
  const billsOutstanding = projects.reduce((s, p) => s + (p.totalBillsReceived - p.totalBillsPaid), 0);
  const totalLiabilities = billsOutstanding;
  const retainedEarnings = totalAssets - totalLiabilities;
  return { cashCollected, accountsReceivable, totalAssets, billsOutstanding, totalLiabilities, retainedEarnings };
}

export function BalanceSheet({ projects, allProjects, viewMode, onProjectClick }: BalanceSheetProps) {
  const data = useMemo(() => computeAggregateBS(allProjects), [allProjects]);

  const perProject = useMemo(() => {
    return projects
      .filter(p => p.invoicesCollected > 0 || p.invoiceBalanceDue > 0 || p.totalBillsReceived > 0)
      .sort((a, b) => b.invoicesCollected - a.invoicesCollected)
      .map(p => {
        const cash = p.invoicesCollected;
        const ar = p.invoiceBalanceDue;
        const ap = p.totalBillsReceived - p.totalBillsPaid;
        return {
          project: p,
          cash,
          ar,
          totalAssets: cash + ar,
          ap,
          totalLiabilities: ap,
          equity: cash + ar - ap,
        };
      });
  }, [projects]);

  const assetLines: BSLineItem[] = [
    { label: "Cash (Payments Collected)", amount: data.cashCollected, indent: true },
    { label: "Accounts Receivable", amount: data.accountsReceivable, indent: true },
    { label: "Total Assets", amount: data.totalAssets, isTotal: true },
  ];

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
              Project-based view. Assets = collected payments + outstanding invoices. 
              Liabilities = unpaid bills. Equity = retained earnings (assets − liabilities).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Company total */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Company Total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BSTable lines={assetLines} title="Assets" />
              <BSTable lines={liabilityLines} title="Liabilities" />
              <BSTable lines={equityLines} title="Equity" />
              <BSTable lines={balanceCheck} />
            </CardContent>
          </Card>

          {/* Per-project */}
          {perProject.map(({ project, cash, ar, totalAssets, ap, totalLiabilities, equity }) => (
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
                    { label: "Cash Collected", amount: cash, indent: true },
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
