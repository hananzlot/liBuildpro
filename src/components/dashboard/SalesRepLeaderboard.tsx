import { useState } from "react";
import type { SalesRepPerformance } from "@/types/ghl";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  assigned_to: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface SalesRepLeaderboardProps {
  data: SalesRepPerformance[];
  opportunities?: Opportunity[];
  appointments?: Appointment[];
  contacts?: Contact[];
  users?: GHLUser[];
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
      <div className="rounded-2xl bg-card p-6 border border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Sales Rep Performance</h3>
        <div className="space-y-4">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assigned reps found
            </p>
          ) : (
            data.slice(0, 5).map((rep, index) => (
              <div 
                key={rep.assignedTo} 
                className="flex items-center gap-4 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleRepClick(rep)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {rep.assignedTo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rep.totalLeads} leads
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">
                    {rep.conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">conversion</p>
                </div>
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
      />
    </>
  );
}
