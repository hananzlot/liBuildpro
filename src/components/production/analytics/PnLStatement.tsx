import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";
import { cn } from "@/lib/utils";

interface PnLStatementProps {
  projects: ProjectWithFinancials[];
  allProjects: ProjectWithFinancials[];
  viewMode: "aggregate" | "per-project";
  onProjectClick?: (projectId: string, initialTab?: string) => void;
}

interface PnLLineItem {
  label: string | React.ReactNode;
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

function PnLTable({ lines }: { lines: PnLLineItem[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={cn(
                "border-b last:border-0 pnl-row",
                line.isTotal && "bg-muted/30 font-semibold pnl-subtotal",
                line.isGrandTotal && "bg-primary/10 font-bold text-base pnl-grand-total"
              )}
            >
              <td className={cn("py-2 px-4", line.indent && "pl-8 pnl-indent")}>
                {line.label}
              </td>
              <td
                className={cn(
                  "py-2 px-4 text-right tabular-nums",
                  line.amount < 0 && "text-destructive pnl-negative"
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

function PctLabel({ text, pct, isAvg }: { text: string; pct?: number | null; isAvg?: boolean }) {
  if (pct == null) return <>{text}</>;
  const formatted = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return (
    <span>
      {text} <span className="text-muted-foreground text-xs">({isAvg ? `avg ${formatted}%` : `${formatted}%`})</span>
    </span>
  );
}

function buildPnLLines(data: {
  totalRevenue: number;
  totalBillsPaid: number;
  billsOutstanding: number;
  totalCOGS: number;
  grossIncome: number;
  totalCommission: number;
  grossIncomeAfterCommission: number;
  totalLeadCost: number;
  netIncome: number;
  avgCommissionPct?: number | null;
  avgLeadCostPct?: number | null;
  isAvg?: boolean;
}): PnLLineItem[] {
  return [
    { label: "Revenues (Contracts Invoiced)", amount: data.totalRevenue },
    { label: "Bills Paid", amount: -data.totalBillsPaid, indent: true },
    { label: "Bills Outstanding", amount: -data.billsOutstanding, indent: true },
    { label: "Cost of Sales Total", amount: -data.totalCOGS, isTotal: true },
    { label: "Gross Income", amount: data.grossIncome, isTotal: true },
    { label: <PctLabel text="Commissions" pct={data.avgCommissionPct} isAvg={data.isAvg} />, amount: -data.totalCommission, indent: true },
    { label: "Gross Income After Commission", amount: data.grossIncomeAfterCommission, isTotal: true },
    { label: <PctLabel text="Lead Cost Income" pct={data.avgLeadCostPct} isAvg={data.isAvg} />, amount: data.totalLeadCost, indent: true },
    { label: "Net Income", amount: data.netIncome, isGrandTotal: true },
  ];
}

function computeAggregate(projects: ProjectWithFinancials[]) {
  const totalRevenue = projects.reduce((s, p) => s + p.contractsTotal, 0);
  const totalCOGS = projects.reduce((s, p) => s + p.totalBillsReceived, 0);
  const totalBillsPaid = projects.reduce((s, p) => s + p.totalBillsPaid, 0);
  const billsOutstanding = totalCOGS - totalBillsPaid;
  const grossIncome = totalRevenue - totalCOGS;
  const totalCommission = projects.reduce((s, p) => s + p.totalCommission, 0);
  const grossIncomeAfterCommission = grossIncome - totalCommission;
  const totalLeadCost = projects.reduce((s, p) => s + p.leadCostAmount, 0);
  const netIncome = grossIncomeAfterCommission + totalLeadCost;

  // Revenue-weighted average percentages
  const revenueProjects = projects.filter(p => p.contractsTotal > 0);
  const weightedRevenue = revenueProjects.reduce((s, p) => s + p.contractsTotal, 0);
  const avgCommissionPct = weightedRevenue > 0
    ? revenueProjects.reduce((s, p) => s + p.contractsTotal * (p.commission_split_pct ?? 50), 0) / weightedRevenue
    : null;
  const avgLeadCostPct = weightedRevenue > 0
    ? revenueProjects.reduce((s, p) => s + p.contractsTotal * (p.lead_cost_percent ?? 18), 0) / weightedRevenue
    : null;

  return { totalRevenue, totalBillsPaid, billsOutstanding, totalCOGS, grossIncome, totalCommission, grossIncomeAfterCommission, totalLeadCost, netIncome, avgCommissionPct, avgLeadCostPct };
}

export function PnLStatement({ projects, allProjects, viewMode, onProjectClick }: PnLStatementProps) {
  const aggregate = useMemo(() => computeAggregate(allProjects), [allProjects]);

  const perProjectData = useMemo(() => {
    return projects
      .filter(p => p.contractsTotal > 0 || p.totalBillsReceived > 0)
      .sort((a, b) => b.contractsTotal - a.contractsTotal)
      .map(p => {
        const billsOutstanding = p.totalBillsReceived - p.totalBillsPaid;
        const grossIncome = p.contractsTotal - p.totalBillsReceived;
        const grossIncomeAfterCommission = grossIncome - p.totalCommission;
        const netIncome = grossIncomeAfterCommission + p.leadCostAmount;
        return {
          project: p,
          lines: buildPnLLines({
            totalRevenue: p.contractsTotal,
            totalBillsPaid: p.totalBillsPaid,
            billsOutstanding,
            totalCOGS: p.totalBillsReceived,
            grossIncome,
            totalCommission: p.totalCommission,
            grossIncomeAfterCommission,
            totalLeadCost: p.leadCostAmount,
            netIncome,
            avgCommissionPct: p.commission_split_pct ?? 50,
            avgLeadCostPct: p.lead_cost_percent ?? 18,
          }),
        };
      });
  }, [projects]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profit & Loss Statement</h2>

      {viewMode === "aggregate" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Company P&L — All Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <PnLTable lines={buildPnLLines({ ...aggregate, isAvg: true })} />
            <p className="text-xs text-muted-foreground mt-3">
              Based on {allProjects.length} projects. Revenue = contract totals. COGS = bills received.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">

          {/* Per-project */}
          {perProjectData.map(({ project, lines }) => (
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
                {project.project_address && (
                  <p className="text-xs text-muted-foreground">{project.project_address}</p>
                )}
              </CardHeader>
              <CardContent>
                <PnLTable lines={lines} />
              </CardContent>
            </Card>
          ))}

          {perProjectData.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No projects with financial activity found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
