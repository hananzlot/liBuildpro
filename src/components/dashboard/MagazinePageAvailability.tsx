import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface MagazinePageAvailabilityProps {
  sales: MagazineSale[];
}

const PAGE_SIZE_VALUES: Record<string, number> = {
  "1/4": 0.25,
  "1/2": 0.5,
  "3/4": 0.75,
  "Full": 1,
  "Cover": 1,
  "Back Page": 1,
};

export const MagazinePageAvailability = ({ sales }: MagazinePageAvailabilityProps) => {
  const [selectedIssue, setSelectedIssue] = useState<string>("");
  const [pageCountByIssue, setPageCountByIssue] = useState<Record<string, number>>({});
  const [editingPageCount, setEditingPageCount] = useState(false);
  const [tempPageCount, setTempPageCount] = useState("");

  // Get unique issue dates
  const issueDates = useMemo(() => {
    const dates = new Set(sales.map((s) => s.magazine_issue_date));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [sales]);

  // Auto-select first issue if none selected
  useMemo(() => {
    if (!selectedIssue && issueDates.length > 0) {
      setSelectedIssue(issueDates[0]);
    }
  }, [issueDates, selectedIssue]);

  const currentPageCount = pageCountByIssue[selectedIssue] || 48;

  // Calculate page occupancy for selected issue
  const pageOccupancy = useMemo(() => {
    if (!selectedIssue) return {};

    const occupancy: Record<number, { sold: number; buyers: string[] }> = {};
    const issueSales = sales.filter((s) => s.magazine_issue_date === selectedIssue);

    issueSales.forEach((sale) => {
      if (sale.page_number === "Random") return; // Skip random pages for grid

      const pageNum = parseInt(sale.page_number, 10);
      if (isNaN(pageNum)) return;

      const sizeValue = PAGE_SIZE_VALUES[sale.page_size] || 0;

      if (!occupancy[pageNum]) {
        occupancy[pageNum] = { sold: 0, buyers: [] };
      }
      occupancy[pageNum].sold = Math.min(1, occupancy[pageNum].sold + sizeValue);
      occupancy[pageNum].buyers.push(sale.buyer_name);
    });

    return occupancy;
  }, [sales, selectedIssue]);

  // Count random page sales
  const randomPagesSold = useMemo(() => {
    if (!selectedIssue) return { count: 0, totalValue: 0 };

    const randomSales = sales.filter(
      (s) => s.magazine_issue_date === selectedIssue && s.page_number === "Random"
    );

    const totalValue = randomSales.reduce((sum, s) => sum + (PAGE_SIZE_VALUES[s.page_size] || 0), 0);
    return { count: randomSales.length, totalValue };
  }, [sales, selectedIssue]);

  // Stats
  const stats = useMemo(() => {
    const totalPages = currentPageCount;
    let fullySold = 0;
    let partiallySold = 0;

    Object.values(pageOccupancy).forEach((page) => {
      if (page.sold >= 1) fullySold++;
      else if (page.sold > 0) partiallySold++;
    });

    const available = totalPages - fullySold - partiallySold;
    return { totalPages, fullySold, partiallySold, available };
  }, [pageOccupancy, currentPageCount]);

  const handleSavePageCount = () => {
    const count = parseInt(tempPageCount, 10);
    if (!isNaN(count) && count > 0 && count <= 200) {
      setPageCountByIssue((prev) => ({ ...prev, [selectedIssue]: count }));
    }
    setEditingPageCount(false);
  };

  const getPageStatus = (pageNum: number) => {
    const occupancy = pageOccupancy[pageNum];
    if (!occupancy) return "available";
    if (occupancy.sold >= 1) return "sold";
    if (occupancy.sold >= 0.75) return "three-quarter";
    if (occupancy.sold >= 0.5) return "half";
    if (occupancy.sold > 0) return "quarter";
    return "available";
  };

  const getPageColor = (status: string) => {
    switch (status) {
      case "sold":
        return "bg-red-500 text-white border-red-600";
      case "three-quarter":
        return "bg-orange-400 text-white border-orange-500";
      case "half":
        return "bg-amber-400 text-amber-900 border-amber-500";
      case "quarter":
        return "bg-yellow-300 text-yellow-900 border-yellow-400";
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    }
  };

  if (issueDates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No magazine issues found. Create a sale entry first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Page Availability</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedIssue} onValueChange={setSelectedIssue}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select issue" />
              </SelectTrigger>
              <SelectContent>
                {issueDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingPageCount ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={tempPageCount}
                  onChange={(e) => setTempPageCount(e.target.value)}
                  className="w-20 h-9"
                  min={1}
                  max={200}
                />
                <Button size="sm" variant="ghost" onClick={handleSavePageCount}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTempPageCount(String(currentPageCount));
                  setEditingPageCount(true);
                }}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                {currentPageCount} pages
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-yellow-300 border border-yellow-400" />
            <span className="text-muted-foreground">1/4 Sold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-amber-400 border border-amber-500" />
            <span className="text-muted-foreground">1/2 Sold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-orange-400 border border-orange-500" />
            <span className="text-muted-foreground">3/4 Sold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-500 border border-red-600" />
            <span className="text-muted-foreground">Sold</span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            {stats.available} Available
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {stats.partiallySold} Partial
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            {stats.fullySold} Sold
          </Badge>
          {randomPagesSold.count > 0 && (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
              {randomPagesSold.count} Random ({randomPagesSold.totalValue.toFixed(2)} pages)
            </Badge>
          )}
        </div>

        {/* Page Grid */}
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
          {Array.from({ length: currentPageCount }, (_, i) => i + 1).map((pageNum) => {
            const status = getPageStatus(pageNum);
            const occupancy = pageOccupancy[pageNum];
            const tooltip = occupancy
              ? `Page ${pageNum}: ${Math.round(occupancy.sold * 100)}% sold\n${occupancy.buyers.join(", ")}`
              : `Page ${pageNum}: Available`;

            return (
              <div
                key={pageNum}
                title={tooltip}
                className={cn(
                  "aspect-square flex items-center justify-center text-xs font-medium rounded border cursor-default transition-transform hover:scale-110",
                  getPageColor(status)
                )}
              >
                {pageNum}
              </div>
            );
          })}
        </div>

        {/* Random Pages Note */}
        {randomPagesSold.count > 0 && (
          <p className="text-xs text-muted-foreground">
            * {randomPagesSold.count} sale(s) assigned to "Random" pages (not shown in grid)
          </p>
        )}
      </CardContent>
    </Card>
  );
};
