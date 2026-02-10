import { useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  // Group deposits by bank
  const depositsByBank = useMemo(() => {
    const deposits = transactions.filter(t => t.type === 'in');
    const grouped: Record<string, { bankName: string; transactions: BankTransaction[]; total: number }> = {};
    deposits.forEach(t => {
      const key = t.bank_or_method || 'Unassigned';
      if (!grouped[key]) grouped[key] = { bankName: key, transactions: [], total: 0 };
      grouped[key].transactions.push(t);
      grouped[key].total += t.amount;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Group payments out by bank
  const paymentsByBank = useMemo(() => {
    const outs = transactions.filter(t => t.type === 'out');
    const grouped: Record<string, { bankName: string; transactions: BankTransaction[]; total: number }> = {};
    outs.forEach(t => {
      const key = t.bank_or_method || 'Unassigned';
      if (!grouped[key]) grouped[key] = { bankName: key, transactions: [], total: 0 };
      grouped[key].transactions.push(t);
      grouped[key].total += t.amount;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [transactions]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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

      {/* Charts Row - Collapsible */}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full pb-2">
          <span>Charts</span>
          <span className="text-xs">(click to expand)</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>

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

      {/* Deposits (Cash In) - Grouped by Bank */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deposits (Cash In)</CardTitle>
          <CardDescription>Payments received, grouped by bank account</CardDescription>
        </CardHeader>
        <CardContent>
          {depositsByBank.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No deposits in the selected period</p>
          ) : (
            <div className="space-y-4">
              {depositsByBank.map((group) => (
                <Collapsible key={group.bankName} defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{group.bankName}</span>
                      <Badge variant="secondary" className="text-xs">{group.transactions.length}</Badge>
                    </div>
                    <span className="font-semibold text-sm text-emerald-600">{formatCurrency(group.total)}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Project #</TableHead>
                            <TableHead className="text-xs">Project Name</TableHead>
                            <TableHead className="text-xs">Address</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.transactions.map((t) => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => t.project_id && onProjectClick?.(t.project_id)}
                            >
                              <TableCell className="text-xs">{t.date ? new Date(t.date).toLocaleDateString() : '-'}</TableCell>
                              <TableCell className="text-xs font-medium">{t.project_number ? `#${t.project_number}` : '-'}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{t.project_name}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{t.project_address || '-'}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{t.customer_name || '-'}</TableCell>
                              <TableCell className="text-xs max-w-[180px] truncate">{t.description}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-emerald-600">+{formatCurrency(t.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Out - Grouped by Bank */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payments Out</CardTitle>
          <CardDescription>Bill payments and expenses, grouped by bank/method</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsByBank.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payments out in the selected period</p>
          ) : (
            <div className="space-y-4">
              {paymentsByBank.map((group) => (
                <Collapsible key={group.bankName} defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{group.bankName}</span>
                      <Badge variant="secondary" className="text-xs">{group.transactions.length}</Badge>
                    </div>
                    <span className="font-semibold text-sm text-red-600">{formatCurrency(group.total)}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Vendor</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs">Project #</TableHead>
                            <TableHead className="text-xs">Project Name</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.transactions.map((t) => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => t.project_id && onProjectClick?.(t.project_id)}
                            >
                              <TableCell className="text-xs">{t.date ? new Date(t.date).toLocaleDateString() : '-'}</TableCell>
                              <TableCell className="text-xs font-medium max-w-[140px] truncate">{t.vendor_name || '-'}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{t.vendor_type || '-'}</TableCell>
                              <TableCell className="text-xs">{t.project_number ? `#${t.project_number}` : '-'}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{t.project_name}</TableCell>
                              <TableCell className="text-xs max-w-[180px] truncate">{t.description}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-red-600">-{formatCurrency(t.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
