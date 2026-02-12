import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, FileText, Receipt, CreditCard, Building2, ArrowRight } from "lucide-react";

interface FinancialRecord {
  projectId: string;
  projectNumber: number;
  projectName: string;
  amount: number;
  description?: string;
  date?: string;
  reference?: string;
}

interface FinancialSearchResultsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionType: string;
  searchQuery: string;
  records: FinancialRecord[];
  onNavigateToProject: (projectId: string, tab: string, subTab?: string) => void;
}

interface SectionConfigItem {
  icon: React.ElementType;
  title: string;
  tab: string;
  subTab?: string;
}

const sectionConfig: Record<string, SectionConfigItem> = {
  'Invoiced': { icon: FileText, title: 'Invoiced Amounts', tab: 'finance', subTab: 'invoices' },
  'Payments Received': { icon: CreditCard, title: 'Payments Received', tab: 'finance', subTab: 'invoices' },
  'Phases': { icon: DollarSign, title: 'Payment Phases', tab: 'finance', subTab: 'agreements' },
  'Contracts': { icon: FileText, title: 'Contract Amounts', tab: 'finance', subTab: 'agreements' },
  'Bills Received': { icon: Receipt, title: 'Bills Received', tab: 'finance', subTab: 'bills' },
  'Bills Paid': { icon: Receipt, title: 'Bills Paid', tab: 'finance', subTab: 'bills' },
  'Project Balance': { icon: DollarSign, title: 'Project Balance', tab: 'finance', subTab: undefined },
  'Invoice Balance': { icon: FileText, title: 'Invoice Balance', tab: 'finance', subTab: 'invoices' },
};

export function FinancialSearchResultsSheet({
  open,
  onOpenChange,
  sectionType,
  searchQuery,
  records,
  onNavigateToProject,
}: FinancialSearchResultsSheetProps) {
  const config: SectionConfigItem = sectionConfig[sectionType] || { icon: DollarSign, title: sectionType, tab: 'finance', subTab: undefined };
  const IconComponent = config.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {config.title}
              </SheetTitle>
              <SheetDescription>
                {records.length} record{records.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Project</TableHead>
                <TableHead className="w-[35%]">{sectionType === 'Bills Received' || sectionType === 'Bills Paid' ? 'Vendor' : 'Description'}</TableHead>
                <TableHead className="w-[20%] text-right">Amount</TableHead>
                <TableHead className="w-[15%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No matching records found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record, index) => (
                  <TableRow key={`${record.projectId}-${index}`} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">#{record.projectNumber}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {record.projectName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {record.description || '-'}
                        {record.reference && (
                          <div className="text-xs text-muted-foreground">
                            Ref: {record.reference}
                          </div>
                        )}
                        {record.date && (
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(record.date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: '2-digit'})}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          onNavigateToProject(record.projectId, config.tab, config.subTab);
                          onOpenChange(false);
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
