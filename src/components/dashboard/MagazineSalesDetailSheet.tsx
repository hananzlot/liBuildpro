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
  "1/4": 0.25,
  "1/2": 0.5,
  "3/4": 0.75,
  "Full": 1,
  "Cover": 1,
  "Back Page": 1,
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
      totalPages += PAGE_SIZE_VALUES[sale.page_size] || 0;
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
              <span className="font-semibold">{totalPages.toFixed(2)}</span>
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
                  <TableHead>Buyer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Ad Sold</TableHead>
                  <TableHead>Page Size</TableHead>
                  <TableHead>Page #</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Entered</TableHead>
                  <TableHead></TableHead>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(sale.created_at), "MMM d, yyyy")}
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
