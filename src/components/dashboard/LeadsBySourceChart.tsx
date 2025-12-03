import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LeadsBySource } from "@/types/ghl";

interface LeadsBySourceChartProps {
  data: LeadsBySource[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.8)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.3)",
];

export function LeadsBySourceChart({ data }: LeadsBySourceChartProps) {
  return (
    <div className="rounded-2xl bg-card p-6 border border-border/50">
      <h3 className="text-lg font-semibold text-foreground mb-6">Leads by Source</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis 
              type="category" 
              dataKey="source" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              width={100}
              tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
