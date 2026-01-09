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
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { DollarSign, TrendingUp, TrendingDown, Percent, Receipt, Wallet, Filter } from "lucide-react";
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

const DEFAULT_STATUSES = ['Completed', 'In-Progress', 'New Job'];

export function ProfitabilityTab({ projects, totals, onProjectClick }: ProfitabilityTabProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPIType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES);

  const handleKPIClick = (kpi: KPIType) => {
    setSelectedKPI(kpi);
    setSheetOpen(true);
  };

  // Get unique statuses from projects
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    projects.forEach(p => {
      if (p.project_status) statuses.add(p.project_status);
    });
    return Array.from(statuses)
      .sort()
      .map(status => ({ value: status, label: status }));
  }, [projects]);

  // Filter projects by selected statuses and with sales
  const projectsWithSales = useMemo(() => {
    return projects.filter(p => {
      const hasSales = p.contractsTotal > 0;
      const matchesStatus = selectedStatuses.length === 0 || 
        selectedStatuses.includes(p.project_status || '');
      return hasSales && matchesStatus;
    });
  }, [projects, selectedStatuses]);

  // Recalculate totals using only projects with sales
  const filteredTotals = useMemo(() => {
    const totalRevenue = projectsWithSales.reduce((sum, p) => sum + p.contractsTotal, 0);
    // Use Max(Bills, Est) for costs - same logic as profit calculation
    const totalCosts = projectsWithSales.reduce((sum, p) => {
      const isCompleted = p.project_status === 'Completed';
      return sum + (isCompleted 
        ? p.totalBillsReceived 
        : Math.max(p.totalBillsReceived, p.effectiveEstimatedCost));
    }, 0);
    const totalLeadCost = projectsWithSales.reduce((sum, p) => sum + p.leadCostAmount, 0);
    const totalGrossProfit = projectsWithSales.reduce((sum, p) => sum + p.grossProfit, 0);
    const totalCommission = projectsWithSales.reduce((sum, p) => sum + p.totalCommission, 0);
    const totalNetProfit = projectsWithSales.reduce((sum, p) => sum + p.expectedNetProfit, 0);
    const profitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCosts,
      totalLeadCost,
      totalGrossProfit,
      totalCommission,
      totalNetProfit,
      profitMargin,
      projectCount: projectsWithSales.length,
    };
  }, [projectsWithSales]);

  // Profitability by Project chart data
  const projectChartData = useMemo(() => {
    return projectsWithSales
      .sort((a, b) => b.expectedNetProfit - a.expectedNetProfit)
      .slice(0, 15)
      .map(p => {
        // Create a short display name from address or project name
        const fullName = p.project_address || p.project_name || `Project ${p.project_number}`;
        // Truncate to ~25 chars for chart display
        const displayName = fullName.length > 25 ? fullName.substring(0, 22) + '...' : fullName;
        return {
          name: displayName,
          fullName,
          profit: p.expectedNetProfit,
          revenue: p.contractsTotal,
        };
      });
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
      {/* Filters */}
      <div className="flex items-center gap-3">
        <MultiSelectFilter
          options={statusOptions}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
          placeholder="Project Status"
          icon={<Filter className="h-3.5 w-3.5" />}
          className="w-[180px]"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Sold"
          value={formatCurrency(filteredTotals.totalRevenue)}
          subValue={`${filteredTotals.projectCount} projects`}
          icon={DollarSign}
          onClick={() => handleKPIClick('totalSold')}
        />
        <MetricCard
          title="Total Costs"
          value={formatCurrency(filteredTotals.totalCosts)}
          subValue="Max(Bills, Est)"
          icon={Receipt}
          variant="warning"
          onClick={() => handleKPIClick('totalCosts')}
        />
        <MetricCard
          title="Lead % Fee"
          value={formatCurrency(filteredTotals.totalLeadCost)}
          subValue="Company fee from sales"
          icon={TrendingDown}
          onClick={() => handleKPIClick('leadFee')}
        />
        <MetricCard
          title="Gross Profit"
          value={formatCurrency(filteredTotals.totalGrossProfit)}
          subValue="Sold - Max(Bills, Est)"
          icon={TrendingUp}
          variant={filteredTotals.totalGrossProfit > 0 ? 'success' : 'danger'}
          onClick={() => handleKPIClick('grossProfit')}
        />
        <MetricCard
          title="Commissions"
          value={formatCurrency(filteredTotals.totalCommission)}
          subValue="(Sold - Lead Fee - Max(Bills, Est)) × %"
          icon={Wallet}
          onClick={() => handleKPIClick('commissions')}
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(filteredTotals.totalNetProfit)}
          subValue="Gross - Commission"
          icon={Percent}
          variant={filteredTotals.totalNetProfit > 0 ? 'success' : 'danger'}
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
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCompactCurrency} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={140} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
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
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salespersonProfitData} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} className="text-xs" />
                  <YAxis tickFormatter={formatCompactCurrency} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {salespersonProfitData.map((entry, index) => (
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
                  
                  // For completed projects, always use real bills - no estimates
                  const isCompleted = project.project_status === 'Completed';
                  const costForDisplay = isCompleted 
                    ? project.totalBillsReceived 
                    : Math.max(project.totalBillsReceived, project.effectiveEstimatedCost);
                  const isUsingEstimate = !isCompleted && project.effectiveEstimatedCost > project.totalBillsReceived;
                  
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(costForDisplay)}
                          {isCompleted ? (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-green-500/10 text-green-600 border-green-500/20">
                              ✓
                            </Badge>
                          ) : isUsingEstimate ? (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                              est
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
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
        projects={projectsWithSales}
        onProjectClick={(id) => onProjectClick?.(id)}
      />
    </div>
  );
}
