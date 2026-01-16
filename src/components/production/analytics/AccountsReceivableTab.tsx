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
import { InvoiceWithAging } from "@/hooks/useProductionAnalytics";
import { FileText, Clock, AlertCircle, CheckCircle, DollarSign, Calendar } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface AccountsReceivableTabProps {
  invoices: InvoiceWithAging[];
  totals: {
    totalInvoiced: number;
    totalCollected: number;
    totalReceivables: number;
    aging: {
      current: number;
      days31_60: number;
      days61_90: number;
      days90Plus: number;
    };
  };
  onProjectClick?: (projectId: string, invoiceId: string) => void;
}


const getAgingColor = (bucket: string) => {
  switch (bucket) {
    case '0-30':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case '31-60':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case '61-90':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case '90+':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

export function AccountsReceivableTab({ invoices, totals, onProjectClick }: AccountsReceivableTabProps) {
  // Pie chart data
  const pieData = useMemo(() => [
    { name: '0-30 Days', value: totals.aging.current, color: AGING_COLORS[0] },
    { name: '31-60 Days', value: totals.aging.days31_60, color: AGING_COLORS[1] },
    { name: '61-90 Days', value: totals.aging.days61_90, color: AGING_COLORS[2] },
    { name: '90+ Days', value: totals.aging.days90Plus, color: AGING_COLORS[3] },
  ].filter(d => d.value > 0), [totals.aging]);

  // Average collection days
  const avgCollectionDays = useMemo(() => {
    if (invoices.length === 0) return 0;
    const totalDays = invoices.reduce((sum, inv) => sum + inv.daysOutstanding, 0);
    return Math.round(totalDays / invoices.length);
  }, [invoices]);

  // Overdue amount
  const overdueAmount = totals.aging.days31_60 + totals.aging.days61_90 + totals.aging.days90Plus;

  // Collection rate
  const collectionRate = totals.totalInvoiced > 0 
    ? ((totals.totalCollected / totals.totalInvoiced) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Invoiced"
          value={formatCurrency(totals.totalInvoiced)}
          icon={FileText}
        />
        <MetricCard
          title="Total Collected"
          value={formatCurrency(totals.totalCollected)}
          subValue={`${collectionRate}% rate`}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(totals.totalReceivables)}
          subValue={`${invoices.length} invoices`}
          icon={DollarSign}
          variant={totals.totalReceivables > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Avg Collection Days"
          value={`${avgCollectionDays}`}
          subValue="days outstanding"
          icon={Calendar}
          variant={avgCollectionDays > 45 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Overdue (>30 days)"
          value={formatCurrency(overdueAmount)}
          icon={Clock}
          variant={overdueAmount > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          title="Critical (>90 days)"
          value={formatCurrency(totals.aging.days90Plus)}
          icon={AlertCircle}
          variant={totals.aging.days90Plus > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Aging Buckets + Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aging Summary</CardTitle>
            <CardDescription>Outstanding balances by age</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-medium">Current (0-30 days)</span>
                </div>
                <span className="font-bold text-emerald-600">{formatCurrency(totals.aging.current)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-medium">31-60 days</span>
                </div>
                <span className="font-bold text-amber-600">{formatCurrency(totals.aging.days31_60)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="font-medium">61-90 days</span>
                </div>
                <span className="font-bold text-orange-600">{formatCurrency(totals.aging.days61_90)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-medium">90+ days</span>
                </div>
                <span className="font-bold text-red-600">{formatCurrency(totals.aging.days90Plus)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AR Aging Distribution</CardTitle>
            <CardDescription>Visual breakdown of receivables</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No outstanding receivables
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Outstanding Invoices</CardTitle>
          <CardDescription>All unpaid invoices sorted by age (oldest first)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Days Out</TableHead>
                  <TableHead>Aging</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No outstanding invoices
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow 
                      key={invoice.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => invoice.project_id && onProjectClick?.(invoice.project_id, invoice.id)}
                    >
                      <TableCell className="font-medium">{invoice.project_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.project_name}
                      </TableCell>
                      <TableCell>{invoice.invoice_number || '-'}</TableCell>
                      <TableCell>
                        {invoice.invoice_date 
                          ? new Date(invoice.invoice_date).toLocaleDateString() 
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.amount || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.payments_received || 0)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.open_balance || 0)}
                      </TableCell>
                      <TableCell className="text-right">{invoice.daysOutstanding}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getAgingColor(invoice.agingBucket))}
                        >
                          {invoice.agingBucket}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
