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

interface Opportunity {
  ghl_id: string;
  name: string | null;
  stage_name: string | null;
  monetary_value: number | null;
  status: string | null;
  ghl_date_added: string | null;
}

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
}

export function OpportunitiesTable({ opportunities }: OpportunitiesTableProps) {
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

  return (
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
                <TableRow key={opp.ghl_id} className="border-border/30 hover:bg-muted/30">
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
  );
}
