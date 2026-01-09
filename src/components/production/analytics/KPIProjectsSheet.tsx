import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectWithFinancials } from "@/hooks/useProductionAnalytics";

export type KPIType = 'totalSold' | 'totalCosts' | 'leadFee' | 'grossProfit' | 'commissions' | 'netProfit';

interface KPIProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: KPIType | null;
  projects: ProjectWithFinancials[];
  onProjectClick: (projectId: string) => void;
}

const kpiConfig: Record<KPIType, { title: string; description: string; valueKey: keyof ProjectWithFinancials }> = {
  totalSold: {
    title: "Total Sold",
    description: "All projects contributing to total sold amount",
    valueKey: "contractsTotal",
  },
  totalCosts: {
    title: "Total Costs",
    description: "All projects with bills received",
    valueKey: "totalBillsReceived",
  },
  leadFee: {
    title: "Lead % Fee",
    description: "Lead fee amount charged per project",
    valueKey: "leadCostAmount",
  },
  grossProfit: {
    title: "Gross Profit",
    description: "Gross profit by project (Sold - Max(Bills, Est))",
    valueKey: "grossProfit",
  },
  commissions: {
    title: "Commissions",
    description: "Commission amounts owed per project",
    valueKey: "totalCommission",
  },
  netProfit: {
    title: "Net Profit",
    description: "Net profit by project after all deductions",
    valueKey: "expectedNetProfit",
  },
};

export function KPIProjectsSheet({
  open,
  onOpenChange,
  kpiType,
  projects,
  onProjectClick,
}: KPIProjectsSheetProps) {
  const config = kpiType ? kpiConfig[kpiType] : null;

  const sortedProjects = useMemo(() => {
    if (!config) return [];
    return [...projects]
      .filter(p => {
        const value = p[config.valueKey] as number;
        return value !== 0;
      })
      .sort((a, b) => {
        const aVal = a[config.valueKey] as number;
        const bVal = b[config.valueKey] as number;
        return Math.abs(bVal) - Math.abs(aVal);
      });
  }, [projects, config]);

  const total = useMemo(() => {
    if (!config) return 0;
    return sortedProjects.reduce((sum, p) => sum + (p[config.valueKey] as number), 0);
  }, [sortedProjects, config]);

  if (!config) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{config.title}</SheetTitle>
          <SheetDescription>{config.description}</SheetDescription>
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              Total: {formatCurrency(total)}
            </Badge>
            <Badge variant="outline">
              {sortedProjects.length} projects
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => {
                const value = project[config.valueKey] as number;
                const isNegative = value < 0;

                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      onOpenChange(false);
                      onProjectClick(project.id);
                    }}
                  >
                    <TableCell className="font-medium">{project.project_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {project.project_address || project.project_name}
                    </TableCell>
                    <TableCell>{project.primary_salesperson || '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${isNegative ? 'text-red-600' : ''}`}>
                      {formatCurrency(value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {project.project_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No projects with data for this metric
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}