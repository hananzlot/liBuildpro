import type { GHLContact } from "@/types/ghl";
import { format } from "date-fns";

interface RecentLeadsTableProps {
  leads: GHLContact[];
}

export function RecentLeadsTable({ leads }: RecentLeadsTableProps) {
  return (
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
                Date Added
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-4 text-sm font-medium text-foreground">
                  {lead.contactName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'N/A'}
                </td>
                <td className="py-4 text-sm text-muted-foreground">
                  {lead.email || 'N/A'}
                </td>
                <td className="py-4">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {lead.source || lead.attributions?.[0]?.utmSource || 'Direct'}
                  </span>
                </td>
                <td className="py-4 text-sm text-muted-foreground">
                  {lead.dateAdded ? format(new Date(lead.dateAdded), 'MMM d, yyyy') : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No leads found
          </p>
        )}
      </div>
    </div>
  );
}
