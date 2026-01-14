import { useState } from "react";
import { Calendar, Trophy } from "lucide-react";
import type { SalesRepPerformance } from "@/types/ghl";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '$0';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
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

  return (
    <>
      <TooltipProvider>
        <div className="rounded-2xl bg-card p-4 border border-border/50 h-[280px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">Sales Rep Performance</h3>
            <span className="text-xs text-muted-foreground">{data.length} reps</span>
          </div>

          {/* Rep List - Scrollable */}
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-1 pr-2">
              {data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No assigned reps found in this date range
                </p>
              ) : (
                data.slice(0, 10).map((rep, index) => (
                  <div 
                    key={rep.assignedTo} 
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-all"
                    onClick={() => handleRepClick(rep)}
                  >
                    {/* Rank */}
                    <span className="w-5 text-xs text-center shrink-0">
                      {getRankBadge(index)}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-6 w-6 border border-border/50 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                        {getInitials(rep.assignedTo)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {rep.assignedTo}
                      </span>
                      {rep.wonOpportunitiesFromWonAt > 0 && rep.uniqueAppointments === 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium shrink-0 cursor-help">
                              won
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-popover border-border">
                            <p className="text-xs">Based on won_at date (no appointments in range)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Stats - Compact Inline */}
                    <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                      {rep.uniqueAppointments > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-0.5 text-muted-foreground cursor-help">
                              <Calendar className="h-3 w-3" />
                              <span className="font-medium text-foreground">{rep.uniqueAppointments}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-popover border-border">
                            <p className="text-xs">Unique contacts with appointments in range</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Won from appointments */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-0.5 cursor-help">
                            <Trophy className="h-3 w-3 text-emerald-500" />
                            <span className="font-medium text-foreground">
                              {rep.wonOpportunities}{rep.uniqueAppointments > 0 ? `/${rep.uniqueAppointments}` : ''}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-popover border-border">
                          <p className="text-xs">
                            {rep.uniqueAppointments > 0 
                              ? `Won from appts in range / Unique (${rep.conversionRate.toFixed(1)}%)` 
                              : 'No appointments in range'}
                          </p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Additional won from won_at */}
                      {rep.wonOpportunitiesFromWonAt > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-0.5 cursor-help">
                              <span className="text-amber-500 font-medium">+{rep.wonOpportunitiesFromWonAt}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-popover border-border">
                            <p className="text-xs">Additional wins (won_at in range, appt outside range)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Total value */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-semibold min-w-[40px] text-right cursor-help text-emerald-500">
                            {formatCurrency(rep.wonValue + rep.wonValueFromWonAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-popover border-border">
                          <div className="text-xs space-y-0.5">
                            {rep.wonValue > 0 && <p>From appts: {formatCurrency(rep.wonValue)}</p>}
                            {rep.wonValueFromWonAt > 0 && <p className="text-amber-500">From won_at: {formatCurrency(rep.wonValueFromWonAt)}</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </TooltipProvider>

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
    </>
  );
}
