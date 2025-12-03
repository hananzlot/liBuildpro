import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Megaphone, Calendar, DollarSign, Clock } from "lucide-react";

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

interface SalesRepDetailSheetProps {
  repName: string;
  repGhlId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: Opportunity[];
  appointments: Appointment[];
  contacts: Contact[];
}

export function SalesRepDetailSheet({
  repName,
  repGhlId,
  open,
  onOpenChange,
  opportunities,
  appointments,
  contacts,
}: SalesRepDetailSheetProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  // Get contacts assigned to this rep
  const repContacts = useMemo(() => {
    return contacts.filter(c => c.assigned_to === repGhlId);
  }, [contacts, repGhlId]);

  // Get contact IDs for this rep
  const repContactIds = useMemo(() => {
    return new Set(repContacts.map(c => c.ghl_id));
  }, [repContacts]);

  // Get opportunities for these contacts
  const repOpportunities = useMemo(() => {
    return opportunities.filter(o => o.contact_id && repContactIds.has(o.contact_id));
  }, [opportunities, repContactIds]);

  // Get appointments for these contacts
  const repAppointments = useMemo(() => {
    return appointments.filter(a => a.contact_id && repContactIds.has(a.contact_id));
  }, [appointments, repContactIds]);

  // Group contacts by source (sorted by count)
  const leadsBySource = useMemo(() => {
    const sourceMap = new Map<string, Contact[]>();
    repContacts.forEach(c => {
      const source = c.source || 'No Source';
      if (!sourceMap.has(source)) sourceMap.set(source, []);
      sourceMap.get(source)!.push(c);
    });
    return Array.from(sourceMap.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [repContacts]);

  // Calculate totals
  const totalValue = repOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const wonOpps = repOpportunities.filter(o => o.status?.toLowerCase() === 'won');
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-hidden p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold">{repName}</SheetTitle>
                <p className="text-sm text-muted-foreground">{repContacts.length} leads assigned</p>
              </div>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4 space-y-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/40 rounded-md p-2.5">
                <div className="text-muted-foreground text-xs mb-0.5">Total Opportunities</div>
                <div className="font-medium">{repOpportunities.length}</div>
              </div>
              <div className="bg-muted/40 rounded-md p-2.5">
                <div className="text-muted-foreground text-xs mb-0.5">Pipeline Value</div>
                <div className="font-medium text-emerald-400">{formatCurrency(totalValue)}</div>
              </div>
              <div className="bg-muted/40 rounded-md p-2.5">
                <div className="text-muted-foreground text-xs mb-0.5">Won Deals</div>
                <div className="font-medium">{wonOpps.length}</div>
              </div>
              <div className="bg-muted/40 rounded-md p-2.5">
                <div className="text-muted-foreground text-xs mb-0.5">Won Value</div>
                <div className="font-medium text-emerald-400">{formatCurrency(wonValue)}</div>
              </div>
            </div>

            {/* Leads by Source */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Leads by Source ({leadsBySource.length})
                </span>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {leadsBySource.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No leads</div>
                ) : (
                  leadsBySource.map(([source, sourceContacts]) => (
                    <div key={source} className="p-3 flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{source}</span>
                      <Badge variant="secondary" className="text-xs">{sourceContacts.length}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Opportunities */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Opportunities ({repOpportunities.length})
                </span>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {repOpportunities.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No opportunities</div>
                ) : (
                  repOpportunities
                    .sort((a, b) => new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime())
                    .map((opp) => {
                      const contact = contacts.find(c => c.ghl_id === opp.contact_id);
                      return (
                        <div key={opp.ghl_id} className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{opp.name || 'Unnamed'}</span>
                            <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(opp.status)}`}>
                              {opp.status || 'Unknown'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(opp.ghl_date_added)}
                            </div>
                            <span className="font-mono text-emerald-400">{formatCurrency(opp.monetary_value)}</span>
                          </div>
                          {contact?.source && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Megaphone className="h-3 w-3" />
                              {contact.source}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Appointments */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Appointments ({repAppointments.length})
                </span>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {repAppointments.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No appointments</div>
                ) : (
                  repAppointments
                    .sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime())
                    .slice(0, 10)
                    .map((appt) => (
                      <div key={appt.ghl_id} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{appt.title || 'Untitled'}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(appt.start_time)}</div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs shrink-0 ${
                            appt.appointment_status?.toLowerCase() === 'confirmed' 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : appt.appointment_status?.toLowerCase() === 'cancelled'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {appt.appointment_status || 'Unknown'}
                        </Badge>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
