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

function PnLTable({ lines }: { lines: PnLLineItem[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
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

function buildPnLLines(data: {
  totalRevenue: number;
  totalCOGS: number;
  totalLeadCost: number;
  totalCommission: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
}): PnLLineItem[] {
  return [
    { label: "Revenue (Contracts Total)", amount: data.totalRevenue },
    { label: "Cost of Goods Sold (Bills Received)", amount: -data.totalCOGS, indent: true },
    { label: "Gross Profit", amount: data.grossProfit, isTotal: true },
    { label: "Lead Costs", amount: -data.totalLeadCost, indent: true },
    { label: "Commissions", amount: -data.totalCommission, indent: true },
    { label: "Total Operating Expenses", amount: -data.operatingExpenses, isTotal: true },
    { label: "Net Income", amount: data.netIncome, isGrandTotal: true },
  ];
}

function computeAggregate(projects: ProjectWithFinancials[]) {
  const totalRevenue = projects.reduce((s, p) => s + p.contractsTotal, 0);
  const totalCOGS = projects.reduce((s, p) => s + p.totalBillsReceived, 0);
  const totalLeadCost = projects.reduce((s, p) => s + p.leadCostAmount, 0);
  const totalCommission = projects.reduce((s, p) => s + p.totalCommission, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const operatingExpenses = totalLeadCost + totalCommission;
  const netIncome = grossProfit - operatingExpenses;
  return { totalRevenue, totalCOGS, totalLeadCost, totalCommission, grossProfit, operatingExpenses, netIncome };
}

export function PnLStatement({ projects, allProjects, viewMode, onProjectClick }: PnLStatementProps) {
  const aggregate = useMemo(() => computeAggregate(allProjects), [allProjects]);

  const perProjectData = useMemo(() => {
    return projects
      .filter(p => p.contractsTotal > 0 || p.totalBillsReceived > 0)
      .sort((a, b) => b.contractsTotal - a.contractsTotal)
      .map(p => {
        const grossProfit = p.contractsTotal - p.totalBillsReceived;
        const operatingExpenses = p.leadCostAmount + p.totalCommission;
        return {
          project: p,
          lines: buildPnLLines({
            totalRevenue: p.contractsTotal,
            totalCOGS: p.totalBillsReceived,
            totalLeadCost: p.leadCostAmount,
            totalCommission: p.totalCommission,
            grossProfit,
            operatingExpenses,
            netIncome: grossProfit - operatingExpenses,
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
            <PnLTable lines={buildPnLLines(aggregate)} />
            <p className="text-xs text-muted-foreground mt-3">
              Based on {allProjects.length} projects. Revenue = contract totals. COGS = bills received.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Company total first */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Company Total</CardTitle>
            </CardHeader>
            <CardContent>
              <PnLTable lines={buildPnLLines(aggregate)} />
            </CardContent>
          </Card>

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
