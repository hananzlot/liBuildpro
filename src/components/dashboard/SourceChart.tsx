import { useState } from "react";
import { SourceDetailSheet } from "./SourceDetailSheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

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
type OpportunitiesViewTab = "opportunities" | "appointments" | "noAppointments";

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
  oppsWithoutAppointmentsBySource?: SourceData[];
  userId?: string | null;
}

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
  oppsWithoutAppointmentsBySource,
  userId,
}: SourceChartProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OpportunitiesViewTab>("opportunities");
  const [clickedFromAppointments, setClickedFromAppointments] = useState(false);
  const [clickedFromNoAppointments, setClickedFromNoAppointments] = useState(false);

  const isOpportunitiesMode = mode === "opportunities";
  const showingAppointments = isOpportunitiesMode && activeTab === "appointments";
  const showingNoAppointments = isOpportunitiesMode && activeTab === "noAppointments";
  
  const rawChartData = showingAppointments 
    ? (appointmentsBySource || []) 
    : showingNoAppointments 
      ? (oppsWithoutAppointmentsBySource || [])
      : data;
  
  // Show top 6 sources for quick view
  const chartData = rawChartData.slice(0, 6);
  
  // Get max value for percentage calculation (use sqrt for better distribution)
  const maxValue = Math.max(...chartData.map(d => {
    const val = dataKey === "value" && !showingAppointments && !showingNoAppointments ? (d.value || 0) : d.count;
    return Math.sqrt(val);
  }), 1);

  const handleBarClick = (entry: SourceData) => {
    setSelectedSource(entry.source);
    setClickedFromAppointments(showingAppointments);
    setClickedFromNoAppointments(showingNoAppointments);
    setSheetOpen(true);
  };

  const formatValue = (value: number) => {
    if (dataKey === "value" && !showingAppointments && !showingNoAppointments) {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value}`;
    }
    return value;
  };

  const getChartTitle = () => {
    if (!isOpportunitiesMode) return title;
    switch (activeTab) {
      case "opportunities": return "Opportunities by Source";
      case "appointments": return "Appointments by Source";
      case "noAppointments": return "No Appointments by Source";
      default: return title;
    }
  };

  // Get color based on source type
  const getSourceColor = (source: string) => {
    const lower = source.toLowerCase();
    if (lower.includes('facebook')) return 'hsl(221 83% 53%)'; // Blue for Facebook
    if (lower.includes('google')) return 'hsl(142 76% 36%)'; // Green for Google
    if (mode === 'won') return 'hsl(142 76% 36%)';
    if (showingAppointments) return 'hsl(262 83% 58%)';
    if (showingNoAppointments) return 'hsl(25 95% 53%)';
    return 'hsl(var(--primary))';
  };

  const getProgressValue = (item: SourceData) => {
    const val = dataKey === "value" && !showingAppointments && !showingNoAppointments ? (item.value || 0) : item.count;
    // Use square root scaling for better distribution
    return (Math.sqrt(val) / maxValue) * 100;
  };

  const getDisplayValue = (item: SourceData) => {
    if (dataKey === "value" && !showingAppointments && !showingNoAppointments) {
      return formatValue(item.value || 0);
    }
    return item.count;
  };

  return (
    <>
      <div className="rounded-2xl bg-card p-4 border border-border/50 h-[280px] flex flex-col">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-base font-semibold text-foreground">{getChartTitle()}</h3>
          {isOpportunitiesMode && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OpportunitiesViewTab)}>
              <TabsList className="h-7">
                <TabsTrigger value="opportunities" className="text-xs px-2 h-6">Opps</TabsTrigger>
                <TabsTrigger value="appointments" className="text-xs px-2 h-6">Appts</TabsTrigger>
                <TabsTrigger value="noAppointments" className="text-xs px-2 h-6">No Appts</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-1.5 pr-2">
            {chartData.map((item) => (
              <div 
                key={item.source}
                className="group cursor-pointer hover:bg-muted/30 rounded-md p-1.5 transition-colors"
                onClick={() => handleBarClick(item)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]" title={item.source}>
                    {item.source}
                  </span>
                  <span className="text-xs font-bold text-foreground ml-2">
                    {getDisplayValue(item)}
                  </span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all group-hover:opacity-80"
                    style={{ 
                      width: `${getProgressValue(item)}%`,
                      backgroundColor: getSourceColor(item.source)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-center gap-2 mt-1 pt-1 border-t border-border/30">
          <p className="text-xs text-muted-foreground">Click to see details</p>
          {rawChartData.length > 6 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <button 
                onClick={() => setViewAllOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                +{rawChartData.length - 6} more
              </button>
            </>
          )}
        </div>
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
        showNoAppointments={clickedFromNoAppointments}
        userId={userId}
      />

      {/* View All Sources Sheet */}
      <Sheet open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{getChartTitle()}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-2 pr-4">
              {rawChartData.map((item) => (
                <div 
                  key={item.source}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setViewAllOpen(false);
                    handleBarClick(item);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: getSourceColor(item.source) }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.source}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {getDisplayValue(item)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
