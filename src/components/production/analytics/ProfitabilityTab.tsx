import { useMemo, useState } from "react";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";
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
import { KPIProjectsSheet, KPIType } from "./KPIProjectsSheet";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";
import { DollarSign, TrendingUp, TrendingDown, Percent, Receipt, Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface ProfitabilityTabProps {
  projects: ProjectWithFinancials[];
  totals: {
    totalRevenue: number;
    totalCosts: number;
    totalLeadCost: number;
    totalGrossProfit: number;
    totalCommission: number;
    totalNetProfit: number;
    profitMargin: number;
    projectCount: number;
  };
  onProjectClick?: (projectId: string) => void;
}


export function ProfitabilityTab({ projects, totals, onProjectClick }: ProfitabilityTabProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPIType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleKPIClick = (kpi: KPIType) => {
    setSelectedKPI(kpi);
    setSheetOpen(true);
  };

  // Filter out projects with zero sold amounts for profitability report
  const projectsWithSales = useMemo(() => {
    return projects.filter(p => p.contractsTotal > 0);
  }, [projects]);

  // Profitability by Project chart data
  const projectChartData = useMemo(() => {
    return projectsWithSales
      .sort((a, b) => b.expectedNetProfit - a.expectedNetProfit)
      .slice(0, 15)
      .map(p => ({
        name: `#${p.project_number}`,
        profit: p.expectedNetProfit,
        revenue: p.contractsTotal,
      }));
  }, [projectsWithSales]);

  // Profitability by Salesperson (only projects with sales)
  const salespersonProfitData = useMemo(() => {
    const profitBySalesperson: Record<string, { revenue: number; profit: number }> = {};
    
    projectsWithSales.forEach(p => {
      const sp = p.primary_salesperson || 'Unassigned';
      if (!profitBySalesperson[sp]) {
        profitBySalesperson[sp] = { revenue: 0, profit: 0 };
      }
      profitBySalesperson[sp].revenue += p.contractsTotal;
      profitBySalesperson[sp].profit += p.expectedNetProfit;
    });

    return Object.entries(profitBySalesperson)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [projectsWithSales]);

  // Monthly trend data (only projects with sales)
  const monthlyTrendData = useMemo(() => {
    const monthlyData: Record<string, { revenue: number; profit: number; count: number }> = {};
    
    projectsWithSales.forEach(p => {
      const date = new Date(p.agreement_signed_date || p.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, profit: 0, count: 0 };
      }
      monthlyData[monthKey].revenue += p.contractsTotal;
      monthlyData[monthKey].profit += p.expectedNetProfit;
      monthlyData[monthKey].count += 1;
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        ...data,
      }));
  }, [projectsWithSales]);

  // Sorted projects for table (only projects with sales)
  const sortedProjects = useMemo(() => {
    return [...projectsWithSales].sort((a, b) => b.contractsTotal - a.contractsTotal);
  }, [projectsWithSales]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Sold"
          value={formatCurrency(totals.totalRevenue)}
          subValue={`${totals.projectCount} projects`}
          icon={DollarSign}
          onClick={() => handleKPIClick('totalSold')}
        />
        <MetricCard
          title="Total Costs"
          value={formatCurrency(totals.totalCosts)}
          subValue="Bills received"
          icon={Receipt}
          variant="warning"
          onClick={() => handleKPIClick('totalCosts')}
        />
        <MetricCard
          title="Lead % Fee"
          value={formatCurrency(totals.totalLeadCost)}
          subValue="Company fee from sales"
          icon={TrendingDown}
          onClick={() => handleKPIClick('leadFee')}
        />
        <MetricCard
          title="Gross Profit"
          value={formatCurrency(totals.totalGrossProfit)}
          subValue="Sold - Max(Bills, Est)"
          icon={TrendingUp}
          variant={totals.totalGrossProfit > 0 ? 'success' : 'danger'}
          onClick={() => handleKPIClick('grossProfit')}
        />
        <MetricCard
          title="Commissions"
          value={formatCurrency(totals.totalCommission)}
          subValue="% of Gross to sales"
          icon={Wallet}
          onClick={() => handleKPIClick('commissions')}
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(totals.totalNetProfit)}
          subValue="Gross - Commissions"
          icon={Percent}
          variant={totals.totalNetProfit > 0 ? 'success' : 'danger'}
          onClick={() => handleKPIClick('netProfit')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit by Project */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profit by Project</CardTitle>
            <CardDescription>Top 15 projects by expected net profit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCompactCurrency} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={50} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                    {projectChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.profit >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit by Salesperson */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profit by Salesperson</CardTitle>
            <CardDescription>Net profit contribution by sales rep</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salespersonProfitData} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} className="text-xs" />
                  <YAxis tickFormatter={formatCompactCurrency} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Profit Trend</CardTitle>
          <CardDescription>Revenue and profit over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis tickFormatter={formatCompactCurrency} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="profit" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Project Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Project Profitability Details</CardTitle>
          <CardDescription>Click a row to view project details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Sold Amount</TableHead>
                  <TableHead className="text-right">Costs</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.slice(0, 50).map((project) => {
                  const margin = project.contractsTotal > 0 
                    ? (project.expectedNetProfit / project.contractsTotal) * 100 
                    : 0;
                  
                  return (
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
                      <TableCell className="text-right">{formatCurrency(project.totalBillsReceived)}</TableCell>
                      <TableCell className={`text-right font-medium ${project.expectedNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(project.expectedNetProfit)}
                      </TableCell>
                      <TableCell className={`text-right ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {margin.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {project.project_status || 'Unknown'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* KPI Projects Sheet */}
      <KPIProjectsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kpiType={selectedKPI}
        projects={projects}
        onProjectClick={(id) => onProjectClick?.(id)}
      />
    </div>
  );
}
