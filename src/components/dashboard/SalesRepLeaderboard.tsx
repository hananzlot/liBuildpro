import { useState } from "react";
import { Users, TrendingUp, DollarSign, Trophy, Target, Briefcase } from "lucide-react";
import type { SalesRepPerformance } from "@/types/ghl";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  assigned_to: string | null;
  custom_fields?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface SalesRepLeaderboardProps {
  data: SalesRepPerformance[];
  opportunities?: Opportunity[];
  appointments?: Appointment[];
  contacts?: Contact[];
  users?: GHLUser[];
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function getConversionColor(rate: number): string {
  if (rate >= 30) return "bg-emerald-500";
  if (rate >= 15) return "bg-amber-500";
  return "bg-rose-500";
}

function getConversionBgColor(rate: number): string {
  if (rate >= 30) return "bg-emerald-500/20";
  if (rate >= 15) return "bg-amber-500/20";
  return "bg-rose-500/20";
}

function getRankBadge(index: number): string {
  switch (index) {
    case 0: return "🏆";
    case 1: return "🥈";
    case 2: return "🥉";
    default: return `${index + 1}`;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function SalesRepLeaderboard({ 
  data,
  opportunities = [],
  appointments = [],
  contacts = [],
  users = [],
}: SalesRepLeaderboardProps) {
  const [selectedRep, setSelectedRep] = useState<{ name: string; ghlId: string | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create reverse lookup from display name to ghl_id
  const nameToGhlId = new Map<string, string>();
  users.forEach(u => {
    const displayName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.ghl_id;
    nameToGhlId.set(displayName, u.ghl_id);
  });

  const handleRepClick = (rep: SalesRepPerformance) => {
    const ghlId = nameToGhlId.get(rep.assignedTo) || null;
    setSelectedRep({ name: rep.assignedTo, ghlId });
    setSheetOpen(true);
  };

  // Calculate team totals
  const teamTotals = data.reduce(
    (acc, rep) => ({
      leads: acc.leads + rep.totalLeads,
      opportunities: acc.opportunities + rep.totalOpportunities,
      wonDeals: acc.wonDeals + rep.wonOpportunities,
      pipelineValue: acc.pipelineValue + rep.pipelineValue,
      wonValue: acc.wonValue + rep.wonValue,
    }),
    { leads: 0, opportunities: 0, wonDeals: 0, pipelineValue: 0, wonValue: 0 }
  );

  const avgConversion = teamTotals.opportunities > 0 
    ? (teamTotals.wonDeals / teamTotals.opportunities) * 100 
    : 0;

  return (
    <TooltipProvider>
      <div className="rounded-2xl bg-card p-6 border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Sales Rep Performance</h3>
          <span className="text-xs text-muted-foreground">{data.length} reps</span>
        </div>

        {/* Team Summary Stats */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-sm font-semibold text-foreground">{teamTotals.leads}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Conv.</p>
                <p className="text-sm font-semibold text-foreground">{avgConversion.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Briefcase className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(teamTotals.pipelineValue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Trophy className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Won</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(teamTotals.wonValue)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rep List */}
        <div className="space-y-3">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assigned reps found in this date range
            </p>
          ) : (
            data.slice(0, 5).map((rep, index) => (
              <div 
                key={rep.assignedTo} 
                className="group p-4 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/30 hover:border-border/50 cursor-pointer transition-all duration-200"
                onClick={() => handleRepClick(rep)}
              >
                {/* Top Row: Avatar, Name, Rank */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-background">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(rep.assignedTo)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -top-1 -right-1 text-xs">
                      {getRankBadge(index)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {rep.assignedTo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rep.totalLeads} leads • {rep.totalOpportunities} opps
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-500">
                      {formatCurrency(rep.wonValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">won</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-foreground">{rep.totalLeads}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total Leads</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-foreground">{rep.totalOpportunities}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total Opportunities</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Trophy className="h-3 w-3 text-emerald-500" />
                        <span className="font-medium text-emerald-500">{rep.wonOpportunities}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Won Deals</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs">
                        <DollarSign className="h-3 w-3 text-blue-500" />
                        <span className="font-medium text-blue-500">{formatCurrency(rep.pipelineValue)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pipeline Value (Open)</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Conversion Rate Bar */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Conversion</span>
                        <span className={`font-semibold ${rep.conversionRate >= 30 ? 'text-emerald-500' : rep.conversionRate >= 15 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {rep.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`h-2 rounded-full ${getConversionBgColor(rep.conversionRate)} overflow-hidden`}>
                        <div 
                          className={`h-full rounded-full ${getConversionColor(rep.conversionRate)} transition-all duration-500`}
                          style={{ width: `${Math.min(rep.conversionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{rep.wonOpportunities} won / {rep.totalOpportunities} total opportunities</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))
          )}
        </div>
      </div>

      <SalesRepDetailSheet
        repName={selectedRep?.name || ''}
        repGhlId={selectedRep?.ghlId || null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        opportunities={opportunities}
        appointments={appointments}
        contacts={contacts}
        users={users}
      />
    </TooltipProvider>
  );
}
