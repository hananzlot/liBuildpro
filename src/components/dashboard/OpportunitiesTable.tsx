import { useState, useMemo } from "react";
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
import { DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  source: string | null;
  custom_fields?: unknown;
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

type SortColumn = "name" | "stage" | "value" | "status" | "date";
type SortDirection = "asc" | "desc";

export function OpportunitiesTable({ 
  opportunities, 
  appointments = [], 
  contacts = [], 
  users = [] 
}: OpportunitiesTableProps) {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("stage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const uniqueStages = useMemo(() => {
    const stages = new Set<string>();
    opportunities.forEach(opp => {
      if (opp.stage_name) stages.add(opp.stage_name);
    });
    return Array.from(stages).sort();
  }, [opportunities]);

  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = opportunities;
    
    // Apply stage filter
    if (stageFilter !== "all") {
      filtered = filtered.filter(opp => opp.stage_name === stageFilter);
    }

    // Helper to get effective date (quickbase stage = 90 days ago)
    const getEffectiveDate = (opp: Opportunity): number => {
      if (opp.stage_name?.toLowerCase() === "quickbase") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ninetyDaysAgo.getTime();
      }
      return opp.ghl_date_added ? new Date(opp.ghl_date_added).getTime() : 0;
    };

    // Sort opportunities
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "stage":
          comparison = (a.stage_name || "").localeCompare(b.stage_name || "");
          // Secondary sort by date descending when sorting by stage
          if (comparison === 0) {
            return getEffectiveDate(b) - getEffectiveDate(a); // Always descending for secondary date sort
          }
          break;
        case "value":
          comparison = (a.monetary_value || 0) - (b.monetary_value || 0);
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "date":
          comparison = getEffectiveDate(a) - getEffectiveDate(b);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [opportunities, stageFilter, sortColumn, sortDirection]);

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "date" || column === "value" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Recent Opportunities</CardTitle>
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px] bg-background border-border">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Stages</SelectItem>
              {uniqueStages.map(stage => (
                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Name
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("stage")}
                >
                  <div className="flex items-center">
                    Pipeline/Stage
                    <SortIcon column="stage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("value")}
                >
                  <div className="flex items-center">
                    Value
                    <SortIcon column="value" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon column="date" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No opportunities found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedOpportunities.map((opp) => (
                  <TableRow 
                    key={opp.ghl_id} 
                    className="border-border/30 hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleRowClick(opp)}
                  >
                    <TableCell className="font-medium">
                      {opp.name || 'Unnamed'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {opp.pipeline_name && opp.stage_name 
                        ? `${opp.pipeline_name} / ${opp.stage_name}`
                        : opp.stage_name || opp.pipeline_name || '-'}
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
        allOpportunities={opportunities}
      />
    </>
  );
}
