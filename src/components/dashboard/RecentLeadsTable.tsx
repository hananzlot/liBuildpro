import { useState } from "react";
import { format } from "date-fns";
import { ContactDetailSheet } from "./ContactDetailSheet";

interface Contact {
  id: string;
  ghl_id: string;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[] | null;
  ghl_date_added?: string | null;
  assigned_to?: string | null;
  attributions?: any;
  custom_fields?: unknown;
}

interface Opportunity {
  id: string;
  ghl_id: string;
  name?: string | null;
  contact_id?: string | null;
  monetary_value?: number | null;
  status?: string | null;
  stage_name?: string | null;
  pipeline_name?: string | null;
  ghl_date_added?: string | null;
}

interface Appointment {
  id: string;
  ghl_id: string;
  title?: string | null;
  contact_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  appointment_status?: string | null;
  notes?: string | null;
}

interface GHLUser {
  id: string;
  ghl_id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface RecentLeadsTableProps {
  leads: Contact[];
  opportunities: Opportunity[];
  appointments: Appointment[];
  users: GHLUser[];
}

export function RecentLeadsTable({ leads, opportunities, appointments, users }: RecentLeadsTableProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setSheetOpen(true);
  };

  // Get opportunity status for a contact
  const getContactOpportunity = (contactGhlId: string) => {
    return opportunities.find(o => o.contact_id === contactGhlId);
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-emerald-500/20 text-emerald-400';
      case 'lost':
      case 'abandoned': return 'bg-red-500/20 text-red-400';
      case 'open': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-card p-6 border border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Recent Leads</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3">
                  Email
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3">
                  Source
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3">
                  Date Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {leads.map((lead) => {
                const opportunity = getContactOpportunity(lead.ghl_id);
                return (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(lead)}
                  >
                    <td className="py-4 text-sm font-medium text-foreground">
                      {lead.contact_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {lead.email || 'N/A'}
                    </td>
                    <td className="py-4">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {lead.source || 'Direct'}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(opportunity?.status)}`}>
                        {opportunity?.status || 'No Opp'}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {lead.ghl_date_added ? format(new Date(lead.ghl_date_added), 'MMM d, yyyy') : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leads.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No leads found
            </p>
          )}
        </div>
      </div>

      <ContactDetailSheet
        contact={selectedContact}
        opportunities={opportunities}
        appointments={appointments}
        users={users}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
