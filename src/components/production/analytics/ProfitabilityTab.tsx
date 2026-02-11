import { useMemo, useState, useCallback, useRef } from "react";
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
import { DollarSign, TrendingUp, TrendingDown, Percent, Receipt, Wallet, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const tableRef = useRef<HTMLDivElement>(null);
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

  // Sort by Status (Asc), then by Profit (Desc)
  const sortedProjects = useMemo(() => {
    return [...projectsWithSales].sort((a, b) => {
      const statusA = (a.project_status || 'Unknown').toLowerCase();
      const statusB = (b.project_status || 'Unknown').toLowerCase();
      if (statusA !== statusB) return statusA.localeCompare(statusB);
      return b.expectedNetProfit - a.expectedNetProfit;
    });
  }, [projectsWithSales]);

  // Summary grouped by status
  const statusSummary = useMemo(() => {
    const groups: Record<string, { status: string; count: number; sold: number; costs: number; profit: number }> = {};
    projectsWithSales.forEach(p => {
      const status = p.project_status || 'Unknown';
      if (!groups[status]) groups[status] = { status, count: 0, sold: 0, costs: 0, profit: 0 };
      const isCompleted = p.project_status === 'Completed';
      const cost = isCompleted ? p.totalBillsReceived : Math.max(p.totalBillsReceived, p.effectiveEstimatedCost);
      groups[status].count += 1;
      groups[status].sold += p.contractsTotal;
      groups[status].costs += cost;
      groups[status].profit += p.expectedNetProfit;
    });
    return groups;
  }, [projectsWithSales]);

  // Group projects by status in sorted order for rendering
  const groupedByStatus = useMemo(() => {
    const groups: { status: string; projects: typeof sortedProjects }[] = [];
    let currentStatus = '';
    sortedProjects.forEach(p => {
      const status = p.project_status || 'Unknown';
      if (status !== currentStatus) {
        currentStatus = status;
        groups.push({ status, projects: [] });
      }
      groups[groups.length - 1].projects.push(p);
    });
    return groups;
  }, [sortedProjects]);

  const handleExportPDF = useCallback(() => {
    const now = new Date();
    const asOf = now.toLocaleDateString() + " " + now.toLocaleTimeString();
    let html = `<!DOCTYPE html><html><head><title>Project Profitability Details</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
      th { text-align: left; font-weight: 600; background: #f3f4f6; }
      td:nth-child(n+4) { text-align: right; font-variant-numeric: tabular-nums; }
      th:nth-child(n+4) { text-align: right; }
      h1 { font-size: 16px; margin-bottom: 2px; }
      .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 12px; }
      .positive { color: #059669; }
      .negative { color: #dc2626; }
      .summary-row { background: #f9fafb; font-weight: 600; }
      .grand-total { background: #e5e7eb; font-weight: 700; }
      @media print { body { padding: 0; } }
    </style></head><body>`;
    html += `<h1>Project Profitability Details</h1>`;
    html += `<p class="subtitle">As of ${asOf} — ${sortedProjects.length} projects · Profits are net of commissions due on each project</p>`;
    html += `<table><thead><tr><th>#</th><th>Project</th><th>Salesperson</th><th>Sold</th><th>Costs</th><th>Profit</th><th>Margin</th><th>Status</th></tr></thead><tbody>`;
    groupedByStatus.forEach(({ status, projects: groupProjects }) => {
      groupProjects.forEach(p => {
        const isCompleted = p.project_status === 'Completed';
        const cost = isCompleted ? p.totalBillsReceived : Math.max(p.totalBillsReceived, p.effectiveEstimatedCost);
        const margin = p.contractsTotal > 0 ? (p.expectedNetProfit / p.contractsTotal * 100) : 0;
        const profitClass = p.expectedNetProfit >= 0 ? 'positive' : 'negative';
        html += `<tr><td>${p.project_number}</td><td>${p.project_address || p.project_name}</td><td>${p.primary_salesperson || '-'}</td><td>${formatCurrency(p.contractsTotal)}</td><td>${formatCurrency(cost)}</td><td class="${profitClass}">${formatCurrency(p.expectedNetProfit)}</td><td class="${profitClass}">${margin.toFixed(1)}%</td><td>${p.project_status || 'Unknown'}</td></tr>`;
      });
      const g = statusSummary[status];
      if (g) {
        const m = g.sold > 0 ? (g.profit / g.sold * 100) : 0;
        const cls = g.profit >= 0 ? 'positive' : 'negative';
        html += `<tr class="summary-row"><td></td><td>${g.status} — ${g.count} projects</td><td></td><td>${formatCurrency(g.sold)}</td><td>${formatCurrency(g.costs)}</td><td class="${cls}">${formatCurrency(g.profit)}</td><td class="${cls}">${m.toFixed(1)}%</td><td></td></tr>`;
      }
    });
    const gm = filteredTotals.profitMargin;
    const gc = filteredTotals.totalNetProfit >= 0 ? 'positive' : 'negative';
    html += `<tr class="grand-total"><td></td><td>Grand Total — ${projectsWithSales.length} projects</td><td></td><td>${formatCurrency(filteredTotals.totalRevenue)}</td><td>${formatCurrency(filteredTotals.totalCosts)}</td><td class="${gc}">${formatCurrency(filteredTotals.totalNetProfit)}</td><td class="${gc}">${gm.toFixed(1)}%</td><td></td></tr>`;
    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      }, 250);
    };
  }, [groupedByStatus, statusSummary, filteredTotals, projectsWithSales.length, sortedProjects]);

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
          title="Gross Profit"
          value={formatCurrency(filteredTotals.totalGrossProfit)}
          subValue="Sold - Max(Bills, Est)"
          icon={TrendingUp}
          variant={filteredTotals.totalGrossProfit > 0 ? 'success' : 'danger'}
          onClick={() => handleKPIClick('grossProfit')}
        />
        <MetricCard
          title="Lead % Fee"
          value={formatCurrency(filteredTotals.totalLeadCost)}
          subValue="Company fee from sales"
          icon={TrendingDown}
          variant="success"
          onClick={() => handleKPIClick('leadFee')}
        />
        <MetricCard
          title="Commissions"
          value={formatCurrency(filteredTotals.totalCommission)}
          subValue="(Sold - Lead Fee - Costs) × %"
          icon={Wallet}
          variant="warning"
          onClick={() => handleKPIClick('commissions')}
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(filteredTotals.totalNetProfit)}
          subValue="Gross - Commission + Lead Fee"
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Project Profitability Details</CardTitle>
            <CardDescription>Click a row to view project details · Profits are net of commissions due on each project</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
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
                {groupedByStatus.map(({ status, projects: groupProjects }) => {
                  const group = statusSummary[status];
                  const groupMargin = group && group.sold > 0 ? (group.profit / group.sold) * 100 : 0;
                  return groupProjects.map((project, idx) => {
                    const margin = project.contractsTotal > 0 
                      ? (project.expectedNetProfit / project.contractsTotal) * 100 
                      : 0;
                    const isCompleted = project.project_status === 'Completed';
                    const costForDisplay = isCompleted 
                      ? project.totalBillsReceived 
                      : Math.max(project.totalBillsReceived, project.effectiveEstimatedCost);
                    const isUsingEstimate = !isCompleted && project.effectiveEstimatedCost > project.totalBillsReceived;
                    const isLast = idx === groupProjects.length - 1;
                    
                    return (
                      <>
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
                              ) : !isCompleted && project.exceededExpectedCosts ? (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] bg-red-500/10 text-red-600 border-red-500/20">
                                  ToDate
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
                        {isLast && group && (
                          <TableRow key={`summary-${status}`} className="bg-muted/40 font-semibold border-t">
                            <TableCell />
                            <TableCell colSpan={2}>
                              <Badge variant="outline" className="text-xs mr-2">{group.status}</Badge>
                              {group.count} projects
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(group.sold)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(group.costs)}</TableCell>
                            <TableCell className={`text-right font-medium ${group.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(group.profit)}
                            </TableCell>
                            <TableCell className={`text-right ${groupMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {groupMargin.toFixed(1)}%
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                      </>
                    );
                  });
                })}
              </TableBody>
              <tfoot>
                <TableRow className="bg-primary/10 font-bold border-t-2">
                  <TableCell />
                  <TableCell colSpan={2}>Grand Total — {projectsWithSales.length} projects</TableCell>
                  <TableCell className="text-right">{formatCurrency(filteredTotals.totalRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(filteredTotals.totalCosts)}</TableCell>
                  <TableCell className={`text-right ${filteredTotals.totalNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(filteredTotals.totalNetProfit)}
                  </TableCell>
                  <TableCell className={`text-right ${filteredTotals.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {filteredTotals.profitMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell />
                </TableRow>
              </tfoot>
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
