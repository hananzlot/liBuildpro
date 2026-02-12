import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Phone, Mail } from "lucide-react";
import { format } from "date-fns";

interface MagazineSale {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  company_name: string | null;
  magazine_issue_date: string;
  ad_sold: string;
  page_size: string;
  page_number: string;
  price: number;
  created_at: string;
  updated_at: string;
  entered_by: string | null;
  sections_sold?: number[] | null;
}

interface MagazineSalesDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sales: MagazineSale[];
  onEdit: (sale: MagazineSale) => void;
  userId?: string;
  isAdmin?: boolean;
}

const PAGE_SIZE_VALUES: Record<string, number> = {
  "1/8": 0.125,
  "1/4": 0.25,
  "3/8": 0.375,
  "1/2": 0.5,
  "5/8": 0.625,
  "3/4": 0.75,
  "7/8": 0.875,
  "Full": 1,
  "Cover": 1,
  "Back Page": 1,
  "Inside Front Cover": 1,
  "Inside Back Cover": 1,
};

// Calculate page value from sale (prioritize sections_sold)
const getPageValue = (sale: MagazineSale): number => {
  if (sale.sections_sold && sale.sections_sold.length > 0) {
    return sale.sections_sold.length / 8;
  }
  return PAGE_SIZE_VALUES[sale.page_size] || 0;
};

// Format page count as fraction (e.g., 7/8, 1 1/2, 2 3/8)
const formatPageCount = (value: number): string => {
  const whole = Math.floor(value);
  const fraction = value - whole;
  
  const fractionMap: Record<number, string> = {
    0.125: "1/8",
    0.25: "1/4",
    0.375: "3/8",
    0.5: "1/2",
    0.625: "5/8",
    0.75: "3/4",
    0.875: "7/8",
  };
  
  const roundedFraction = Math.round(fraction * 8) / 8;
  const fractionStr = fractionMap[roundedFraction] || "";
  
  if (whole === 0 && fractionStr) return fractionStr;
  if (fractionStr) return `${whole} ${fractionStr}`;
  return String(whole);
};

export const MagazineSalesDetailSheet = ({
  open,
  onOpenChange,
  sales,
  onEdit,
  userId,
  isAdmin,
}: MagazineSalesDetailSheetProps) => {
  const [filterIssueDate, setFilterIssueDate] = useState<string>("all");

  // Get unique issue dates
  const issueDates = useMemo(() => {
    const dates = new Set(sales.map((s) => s.magazine_issue_date));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [sales]);

  // Filter sales
  const filteredSales = useMemo(() => {
    if (filterIssueDate === "all") return sales;
    return sales.filter((s) => s.magazine_issue_date === filterIssueDate);
  }, [sales, filterIssueDate]);

  // Calculate totals
  const { totalPages, totalSales } = useMemo(() => {
    let totalPages = 0;
    let totalSales = 0;
    filteredSales.forEach((sale) => {
      totalPages += getPageValue(sale);
      totalSales += Number(sale.price);
    });
    return { totalPages, totalSales };
  }, [filteredSales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Magazine Sales Details</SheetTitle>
          <SheetDescription>
            View and manage all magazine ad sales
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by Issue:</span>
              <Select value={filterIssueDate} onValueChange={setFilterIssueDate}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Issues</SelectItem>
                  {issueDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/50">
            <div>
              <span className="text-sm text-muted-foreground">Total Pages: </span>
              <span className="font-semibold">{formatPageCount(totalPages)}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Sales: </span>
              <span className="font-semibold text-emerald-500">{formatCurrency(totalSales)}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Entries: </span>
              <span className="font-semibold">{filteredSales.length}</span>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[14%]">Buyer</TableHead>
                  <TableHead className="w-[14%]">Company</TableHead>
                  <TableHead className="w-[10%] whitespace-nowrap">Issue Date</TableHead>
                  <TableHead className="w-[12%]">Ad Sold</TableHead>
                  <TableHead className="w-[10%]">Page Size</TableHead>
                  <TableHead className="w-[6%]">Page #</TableHead>
                  <TableHead className="w-[10%] text-right">Price</TableHead>
                  <TableHead className="w-[8%]">Contact</TableHead>
                  <TableHead className="w-[10%] whitespace-nowrap">Entered</TableHead>
                  <TableHead className="w-[6%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.buyer_name}</TableCell>
                      <TableCell>{sale.company_name || "-"}</TableCell>
                      <TableCell>
                        {new Date(sale.magazine_issue_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>{sale.ad_sold}</TableCell>
                      <TableCell>{sale.page_size}</TableCell>
                      <TableCell>{sale.page_number}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(sale.price))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sale.buyer_phone && (
                            <a href={`tel:${sale.buyer_phone}`} className="text-muted-foreground hover:text-foreground">
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {sale.buyer_email && (
                            <a href={`mailto:${sale.buyer_email}`} className="text-muted-foreground hover:text-foreground">
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(sale.created_at), "MM/dd/yy")}
                      </TableCell>
                      <TableCell>
                        {(isAdmin || sale.entered_by === userId) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(sale)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
