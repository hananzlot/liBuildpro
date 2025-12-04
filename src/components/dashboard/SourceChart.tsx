import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { SourceDetailSheet } from "./SourceDetailSheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SourceData {
  source: string;
  count: number;
  value?: number;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  ghl_date_added: string | null;
  custom_fields?: unknown;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

type ChartMode = "opportunities" | "won";
type OpportunitiesViewTab = "opportunities" | "appointments";

interface SourceChartProps {
  title: string;
  data: SourceData[];
  mode: ChartMode;
  dataKey?: "count" | "value";
  contacts: Contact[];
  filteredContacts: Contact[];
  opportunities: Opportunity[];
  filteredOpportunities: Opportunity[];
  appointments: Appointment[];
  filteredAppointments?: Appointment[];
  users: GHLUser[];
  appointmentsBySource?: SourceData[];
}

const LEAD_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.8)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.3)",
];

const WON_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(142 76% 36% / 0.8)",
  "hsl(142 76% 36% / 0.6)",
  "hsl(142 76% 36% / 0.4)",
  "hsl(142 76% 36% / 0.3)",
];

const APPOINTMENT_COLORS = [
  "hsl(262 83% 58%)",
  "hsl(262 83% 58% / 0.8)",
  "hsl(262 83% 58% / 0.6)",
  "hsl(262 83% 58% / 0.4)",
  "hsl(262 83% 58% / 0.3)",
];

export function SourceChart({ 
  title, 
  data, 
  mode, 
  dataKey = "count",
  contacts,
  filteredContacts,
  opportunities,
  filteredOpportunities,
  appointments,
  filteredAppointments,
  users,
  appointmentsBySource,
}: SourceChartProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OpportunitiesViewTab>("opportunities");
  const [clickedFromAppointments, setClickedFromAppointments] = useState(false);

  const isOpportunitiesMode = mode === "opportunities";
  const showingAppointments = isOpportunitiesMode && activeTab === "appointments";
  
  const chartData = showingAppointments ? (appointmentsBySource || []) : data;
  const colors = mode === "won" ? WON_COLORS : (showingAppointments ? APPOINTMENT_COLORS : LEAD_COLORS);

  const handleBarClick = (entry: SourceData) => {
    setSelectedSource(entry.source);
    setClickedFromAppointments(showingAppointments);
    setSheetOpen(true);
  };

  const formatValue = (value: number) => {
    if (dataKey === "value" && !showingAppointments) {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value}`;
    }
    return value;
  };

  const getChartTitle = () => {
    if (!isOpportunitiesMode) return title;
    return activeTab === "opportunities" ? "Opportunities by Source" : "Appointments by Source";
  };

  return (
    <>
      <div className="rounded-2xl bg-card p-6 border border-border/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">{getChartTitle()}</h3>
          {isOpportunitiesMode && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OpportunitiesViewTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="opportunities" className="text-xs px-3 h-7">Opportunities</TabsTrigger>
                <TabsTrigger value="appointments" className="text-xs px-3 h-7">Appointments</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickFormatter={(value) => String(formatValue(value))}
              />
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
                formatter={(value: number) => [
                  dataKey === "value" && !showingAppointments ? String(formatValue(value)) : String(value),
                  showingAppointments ? "Unique Contacts" : (dataKey === "value" ? "Value" : "Count")
                ]}
              />
              <Bar 
                dataKey={showingAppointments ? "count" : dataKey} 
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(_, index) => handleBarClick(chartData[index])}
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={colors[index % colors.length]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
                <LabelList 
                  dataKey={showingAppointments ? "count" : dataKey}
                  position="insideRight"
                  fill="hsl(var(--background))"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(value: number) => showingAppointments || dataKey === "count" ? value : formatValue(value)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">Click a bar to see details</p>
      </div>

      <SourceDetailSheet
        source={selectedSource}
        mode={mode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        contacts={contacts}
        filteredContacts={filteredContacts}
        opportunities={opportunities}
        filteredOpportunities={filteredOpportunities}
        appointments={appointments}
        filteredAppointments={filteredAppointments || []}
        users={users}
        showAppointments={clickedFromAppointments}
      />
    </>
  );
}
