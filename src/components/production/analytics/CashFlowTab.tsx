import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "./MetricCard";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";
import { Banknote, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashFlowTabProps {
  projects: ProjectWithFinancials[];
  totals: {
    totalCollected: number;
    totalBillsPaid: number;
    totalReceivables: number;
    totalPayables: number;
    cashPosition: number;
  };
  onProjectClick?: (projectId: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getCashStatusColor = (status: string) => {
  switch (status) {
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'low':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'negative':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'overdue':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getCashStatusLabel = (status: string) => {
  switch (status) {
    case 'positive':
      return 'Cash Positive';
    case 'low':
      return 'Low Collection';
    case 'negative':
      return 'Cash Negative';
    case 'overdue':
      return 'Overdue AR';
    default:
      return 'Unknown';
  }
};

export function CashFlowTab({ projects, totals, onProjectClick }: CashFlowTabProps) {
  // Summary counts
  const statusCounts = useMemo(() => {
    return projects.reduce((acc, p) => {
      acc[p.cashStatus] = (acc[p.cashStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [projects]);

  // Sort projects by cash status priority (worst first)
  const sortedProjects = useMemo(() => {
    const priority = { negative: 0, overdue: 1, low: 2, positive: 3 };
    return [...projects].sort((a, b) => {
      const priorityDiff = priority[a.cashStatus] - priority[b.cashStatus];
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(b.cashPosition) - Math.abs(a.cashPosition);
    });
  }, [projects]);

  // Projects needing attention
  const problemProjects = sortedProjects.filter(p => 
    p.cashStatus === 'negative' || p.cashStatus === 'overdue' || p.cashStatus === 'low'
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Cash Position"
          value={formatCurrency(totals.cashPosition)}
          subValue="Collected - Paid"
          icon={Banknote}
          variant={totals.cashPosition >= 0 ? 'success' : 'danger'}
        />
        <MetricCard
          title="Total Collected"
          value={formatCurrency(totals.totalCollected)}
          subValue="Payments received"
          icon={ArrowDownToLine}
          variant="success"
        />
        <MetricCard
          title="Bills Paid"
          value={formatCurrency(totals.totalBillsPaid)}
          subValue="Vendor payments"
          icon={ArrowUpFromLine}
        />
        <MetricCard
          title="Outstanding AR"
          value={formatCurrency(totals.totalReceivables)}
          subValue="To collect"
          icon={Wallet}
          variant={totals.totalReceivables > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Outstanding AP"
          value={formatCurrency(totals.totalPayables)}
          subValue="Bills unpaid"
          icon={AlertTriangle}
          variant={totals.totalPayables > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Projects At Risk"
          value={problemProjects.length.toString()}
          subValue={`of ${projects.length} total`}
          icon={AlertTriangle}
          variant={problemProjects.length > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cn("border-2", getCashStatusColor('positive'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.positive || 0}</p>
            <p className="text-sm font-medium">Cash Positive</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('low'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.low || 0}</p>
            <p className="text-sm font-medium">Low Collection</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('negative'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.negative || 0}</p>
            <p className="text-sm font-medium">Cash Negative</p>
          </CardContent>
        </Card>
        <Card className={cn("border-2", getCashStatusColor('overdue'))}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{statusCounts.overdue || 0}</p>
            <p className="text-sm font-medium">Overdue AR</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Cash Status Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Project Cash Status</CardTitle>
          <CardDescription>All projects sorted by cash health (worst first)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Bills Paid</TableHead>
                  <TableHead className="text-right">Cash Position</TableHead>
                  <TableHead className="text-right">AR Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.slice(0, 100).map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onProjectClick?.(project.id)}
                  >
                    <TableCell className="font-medium">{project.project_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {project.project_address || project.project_name}
                    </TableCell>
                    <TableCell>{project.primary_salesperson || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.contractsTotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.invoicesCollected)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.totalBillsPaid)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      project.cashPosition >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {formatCurrency(project.cashPosition)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right",
                      project.invoiceBalanceDue > 0 ? 'text-amber-600' : ''
                    )}>
                      {formatCurrency(project.invoiceBalanceDue)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getCashStatusColor(project.cashStatus))}
                      >
                        {getCashStatusLabel(project.cashStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
