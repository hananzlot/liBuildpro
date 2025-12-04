import { useState } from "react";
import { Calendar, Trophy, DollarSign } from "lucide-react";
import type { SalesRepPerformance } from "@/types/ghl";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        <div className="rounded-2xl bg-card p-6 border border-border/50">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Sales Rep Performance</h3>
            <span className="text-xs text-muted-foreground">{data.length} reps</span>
          </div>

          {/* Rep List */}
          <div className="space-y-2">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No assigned reps found in this date range
              </p>
            ) : (
              data.slice(0, 10).map((rep, index) => (
                <div 
                  key={rep.assignedTo} 
                  className="group flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/30 hover:border-border/50 cursor-pointer transition-all duration-200"
                  onClick={() => handleRepClick(rep)}
                >
                  {/* Avatar with Rank */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(rep.assignedTo)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -top-1 -right-1 text-xs">
                      {getRankBadge(index)}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {rep.assignedTo}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    {/* Unique Appointments (unique contacts with appointments) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">{rep.uniqueAppointments}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-popover border-border">
                        <p className="text-xs">Unique contacts with appointments<br />(not counting repeat appointments)</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Won/Total Ratio with Success Rate */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                          <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-medium text-foreground">
                            {rep.wonOpportunities}/{rep.uniqueAppointments}
                          </span>
                          <span className="text-muted-foreground">
                            ({rep.conversionRate.toFixed(0)}%)
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-popover border-border">
                        <p className="text-xs">Won Opportunities / Unique Contacts<br />Success rate: {rep.conversionRate.toFixed(1)}%</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Won Value */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 min-w-[60px] justify-end cursor-help">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-semibold text-emerald-500">
                            {formatCurrency(rep.wonValue)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-popover border-border">
                        <p className="text-xs">Total value of won opportunities</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>
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
