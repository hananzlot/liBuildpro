import { useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PaymentData {
  date: string | null;
  amount: number;
}

interface CashFlowChartProps {
  invoicePayments: PaymentData[];
  billPayments: PaymentData[];
  commissionPayments: PaymentData[];
  dateRange: DateRange | undefined;
}

export function CashFlowChart({
  invoicePayments,
  billPayments,
  commissionPayments,
  dateRange,
}: CashFlowChartProps) {
  const chartData = useMemo(() => {
    // Determine the date range for the chart
    let startDate: Date;
    let endDate: Date;

    if (dateRange?.from && dateRange?.to) {
      startDate = startOfMonth(dateRange.from);
      endDate = endOfMonth(dateRange.to);
    } else {
      // Default to last 12 months if no date range
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      startDate = startOfMonth(startDate);
      endDate = endOfMonth(endDate);
    }

    // Generate all months in range
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    // Aggregate data by month
    const monthlyData = months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const interval = { start: monthStart, end: monthEnd };

      const invoicesIn = invoicePayments
        .filter((p) => {
          if (!p.date) return false;
          const paymentDate = parseISO(p.date);
          return isWithinInterval(paymentDate, interval);
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const billsOut = billPayments
        .filter((p) => {
          if (!p.date) return false;
          const paymentDate = parseISO(p.date);
          return isWithinInterval(paymentDate, interval);
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const commissionsOut = commissionPayments
        .filter((p) => {
          if (!p.date) return false;
          const paymentDate = parseISO(p.date);
          return isWithinInterval(paymentDate, interval);
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const netCashFlow = invoicesIn - billsOut - commissionsOut;

      return {
        month: format(monthStart, "MMM yyyy"),
        shortMonth: format(monthStart, "MMM"),
        invoicesIn,
        billsOut: -billsOut, // Negative for stacking effect
        commissionsOut: -commissionsOut,
        netCashFlow,
      };
    });

    return monthlyData;
  }, [invoicePayments, billPayments, commissionPayments, dateRange]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, month) => ({
        invoicesIn: acc.invoicesIn + month.invoicesIn,
        billsOut: acc.billsOut + Math.abs(month.billsOut),
        commissionsOut: acc.commissionsOut + Math.abs(month.commissionsOut),
        netCashFlow: acc.netCashFlow + month.netCashFlow,
      }),
      { invoicesIn: 0, billsOut: 0, commissionsOut: 0, netCashFlow: 0 }
    );
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-500">Invoices Received:</span>
              <span className="font-medium">{formatCurrency(data.invoicesIn)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-red-500">Bills Paid:</span>
              <span className="font-medium">-{formatCurrency(Math.abs(data.billsOut))}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-orange-500">Commissions Paid:</span>
              <span className="font-medium">-{formatCurrency(Math.abs(data.commissionsOut))}</span>
            </div>
            <div className="border-t pt-1 mt-1 flex items-center justify-between gap-4">
              <span className="font-medium">Net Cash Flow:</span>
              <span className={`font-bold ${data.netCashFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(data.netCashFlow)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              Invoices Received
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.invoicesIn)}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Bills Paid
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-lg font-bold text-red-600">-{formatCurrency(totals.billsOut)}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <Minus className="h-3 w-3 text-orange-500" />
              Commissions Paid
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-lg font-bold text-orange-600">-{formatCurrency(totals.commissionsOut)}</p>
          </CardContent>
        </Card>
        <Card className="p-0 border-primary/30">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Net Cash Flow
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-lg font-bold ${totals.netCashFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {formatCurrency(totals.netCashFlow)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Cash Flow</CardTitle>
          <CardDescription>
            Invoice payments received minus bill and commission payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => {
                    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                    return `$${value}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                <Bar 
                  dataKey="invoicesIn" 
                  name="Invoices Received" 
                  fill="hsl(142.1 76.2% 36.3%)" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="billsOut" 
                  name="Bills Paid" 
                  fill="hsl(0 84.2% 60.2%)" 
                  radius={[0, 0, 4, 4]}
                />
                <Bar 
                  dataKey="commissionsOut" 
                  name="Commissions Paid" 
                  fill="hsl(24.6 95% 53.1%)" 
                  radius={[0, 0, 4, 4]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
