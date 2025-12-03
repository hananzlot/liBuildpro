import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  stage_name: string | null;
  monetary_value: number | null;
  status: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  appointments?: Appointment[];
  contacts?: Contact[];
  users?: GHLUser[];
}

export function OpportunitiesTable({ 
  opportunities, 
  appointments = [], 
  contacts = [], 
  users = [] 
}: OpportunitiesTableProps) {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const handleRowClick = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setSheetOpen(true);
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recent Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Stage</TableHead>
                <TableHead className="text-muted-foreground">Value</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No opportunities found
                  </TableCell>
                </TableRow>
              ) : (
                opportunities.map((opp) => (
                  <TableRow 
                    key={opp.ghl_id} 
                    className="border-border/30 hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleRowClick(opp)}
                  >
                    <TableCell className="font-medium">
                      {opp.name || 'Unnamed'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {opp.stage_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400">
                      {formatCurrency(opp.monetary_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(opp.status)}>
                        {opp.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {opp.ghl_date_added
                        ? new Date(opp.ghl_date_added).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}