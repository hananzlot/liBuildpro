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
import { BankTransaction, ProjectWithFinancials } from "@/hooks/useProductionAnalytics";
import { Building, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { cn, formatCurrency, formatCompactCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface BankActivitiesTabProps {
  transactions: BankTransaction[];
  projects: ProjectWithFinancials[];
  totals: {
    totalCollected: number;
    totalBillsPaid: number;
    cashPosition: number;
    totalPayables: number;
    totalCosts: number;
  };
  onProjectClick?: (projectId: string) => void;
}


const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function BankActivitiesTab({ transactions, projects, totals, onProjectClick }: BankActivitiesTabProps) {
  // Transactions summary
  const incomingTotal = useMemo(() => 
    transactions.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0)
  , [transactions]);

  const outgoingTotal = useMemo(() => 
    transactions.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0)
  , [transactions]);

  // Bank/Method summary for payments in
  const bankSummary = useMemo(() => {
    const summary: Record<string, { deposits: number; payments: number }> = {};
    
    transactions.forEach(t => {
      const key = t.bank_or_method || 'Unknown';
      if (!summary[key]) {
        summary[key] = { deposits: 0, payments: 0 };
      }
      if (t.type === 'in') {
        summary[key].deposits += t.amount;
      } else {
        summary[key].payments += t.amount;
      }
    });

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data, net: data.deposits - data.payments }))
      .sort((a, b) => b.deposits - a.deposits);
  }, [transactions]);

  // Monthly cash flow
  const monthlyCashFlow = useMemo(() => {
    const monthly: Record<string, { in: number; out: number }> = {};
    
    transactions.forEach(t => {
      if (!t.date) return;
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = { in: 0, out: 0 };
      }
      if (t.type === 'in') {
        monthly[monthKey].in += t.amount;
      } else {
        monthly[monthKey].out += t.amount;
      }
    });

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        'Cash In': data.in,
        'Cash Out': data.out,
      }));
  }, [transactions]);

  // Payment method distribution (for outgoing)
  const paymentMethodDist = useMemo(() => {
    const methods: Record<string, number> = {};
    
    transactions
      .filter(t => t.type === 'out')
      .forEach(t => {
        const method = t.bank_or_method || 'Unknown';
        methods[method] = (methods[method] || 0) + t.amount;
      });

    return Object.entries(methods)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Cash In (Period)"
          value={formatCurrency(incomingTotal)}
          icon={ArrowDownToLine}
          variant="success"
        />
        <MetricCard
          title="Cash Out (Period)"
          value={formatCurrency(outgoingTotal)}
          icon={ArrowUpFromLine}
          variant="warning"
        />
        <MetricCard
          title="Net Cash Flow"
          value={formatCurrency(incomingTotal - outgoingTotal)}
          icon={Building}
          variant={incomingTotal - outgoingTotal >= 0 ? 'success' : 'danger'}
        />
        <MetricCard
          title="Transactions"
          value={transactions.length.toString()}
          subValue={`${transactions.filter(t => t.type === 'in').length} in / ${transactions.filter(t => t.type === 'out').length} out`}
          icon={Wallet}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Cash Flow Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Cash Flow</CardTitle>
            <CardDescription>Cash in vs cash out over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {monthlyCashFlow.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyCashFlow} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis tickFormatter={formatCompactCurrency} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="Cash In" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Cash Out" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No transactions in the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Methods</CardTitle>
            <CardDescription>Distribution of outgoing payments by method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {paymentMethodDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodDist}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentMethodDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No payment data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Summary */}
      {bankSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bank / Payment Method Summary</CardTitle>
            <CardDescription>Activity by bank or payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Method</TableHead>
                    <TableHead className="text-right">Deposits</TableHead>
                    <TableHead className="text-right">Payments Out</TableHead>
                    <TableHead className="text-right">Net Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankSummary.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatCurrency(row.deposits)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(row.payments)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        row.net >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatCurrency(row.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <CardDescription>All bank activity (payments in and out)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Bank/Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions in the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.slice(0, 100).map((transaction) => (
                    <TableRow 
                      key={transaction.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => transaction.project_id && onProjectClick?.(transaction.project_id)}
                    >
                      <TableCell>
                        {transaction.date 
                          ? new Date(transaction.date).toLocaleDateString() 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            transaction.type === 'in' 
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          )}
                        >
                          {transaction.type === 'in' ? 'IN' : 'OUT'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {transaction.project_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        transaction.type === 'in' ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {transaction.type === 'in' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>{transaction.bank_or_method || '-'}</TableCell>
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
