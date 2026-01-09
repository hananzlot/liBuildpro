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
import { SalespersonCommission } from "@/hooks/useProductionAnalytics";
import { Users, DollarSign, Wallet, CheckCircle, Clock, TrendingUp } from "lucide-react";
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
} from "recharts";

interface CommissionPayment {
  id: string;
  project_id: string;
  salesperson_name: string;
  payment_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
}

interface CommissionReportTabProps {
  commissionSummary: SalespersonCommission[];
  commissionPayments: CommissionPayment[];
  totals: {
    totalCommission: number;
    commissionPaid: number;
    commissionBalance: number;
  };
}


export function CommissionReportTab({ commissionSummary, commissionPayments, totals }: CommissionReportTabProps) {
  // Chart data
  const chartData = useMemo(() => {
    return commissionSummary
      .slice(0, 10)
      .map(sp => ({
        name: sp.name.split(' ')[0], // First name only for chart
        Calculated: sp.calculated,
        Paid: sp.paid,
        Balance: sp.balance,
      }));
  }, [commissionSummary]);

  // Payout rate
  const payoutRate = totals.totalCommission > 0 
    ? ((totals.commissionPaid / totals.totalCommission) * 100).toFixed(1)
    : '0';

  // Salespeople with balance
  const withBalance = commissionSummary.filter(sp => sp.balance > 0).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Calculated"
          value={formatCurrency(totals.totalCommission)}
          subValue={`${commissionSummary.length} salespeople`}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Paid"
          value={formatCurrency(totals.commissionPaid)}
          subValue={`${payoutRate}% payout rate`}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(totals.commissionBalance)}
          subValue={`${withBalance} with balance`}
          icon={Wallet}
          variant={totals.commissionBalance > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Payments Made"
          value={commissionPayments.length.toString()}
          subValue="Commission payments"
          icon={Clock}
        />
        <MetricCard
          title="Salespeople"
          value={commissionSummary.length.toString()}
          subValue="With commissions"
          icon={Users}
        />
        <MetricCard
          title="Avg Commission"
          value={formatCurrency(commissionSummary.length > 0 ? totals.totalCommission / commissionSummary.length : 0)}
          subValue="Per salesperson"
          icon={TrendingUp}
        />
      </div>

      {/* Commission Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Commission by Salesperson</CardTitle>
          <CardDescription>Calculated vs paid amounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={formatCompactCurrency} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="Calculated" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No commission data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salesperson Commission Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Commission Summary</CardTitle>
            <CardDescription>By salesperson</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="text-right">Calculated</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No commission data
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissionSummary.map((sp) => (
                      <TableRow key={sp.name}>
                        <TableCell className="font-medium">{sp.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sp.calculated)}</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatCurrency(sp.paid)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          sp.balance > 0 ? 'text-amber-600' : 'text-muted-foreground'
                        )}>
                          {formatCurrency(sp.balance)}
                        </TableCell>
                        <TableCell className="text-right">{sp.projectCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Commission Payments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
            <CardDescription>Recent commission payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No commission payments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissionPayments
                      .sort((a, b) => {
                        if (!a.payment_date) return 1;
                        if (!b.payment_date) return -1;
                        return new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
                      })
                      .slice(0, 50)
                      .map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.payment_date 
                              ? new Date(payment.payment_date).toLocaleDateString() 
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="font-medium">{payment.salesperson_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {payment.payment_method || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatCurrency(payment.payment_amount || 0)}
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
    </div>
  );
}
