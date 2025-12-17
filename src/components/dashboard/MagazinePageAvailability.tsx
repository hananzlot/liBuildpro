import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  sections_sold?: number[] | null;
}

interface MagazinePageAvailabilityProps {
  sales: MagazineSale[];
}

// Convert legacy page_size to sections (for backward compatibility)
const legacySizeToSections = (pageSize: string): number[] => {
  switch (pageSize) {
    case "Full":
    case "Cover":
    case "Back Page":
      return [1, 2, 3, 4, 5, 6, 7, 8];
    case "3/4":
      return [1, 2, 3, 4, 5, 6];
    case "1/2":
      return [1, 2, 3, 4];
    case "1/4":
      return [1, 2];
    default:
      return [];
  }
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

  // Calculate section occupancy for selected issue (includes special pages)
  const sectionOccupancy = useMemo(() => {
    if (!selectedIssue) return {};

    const occupancy: Record<string, { sections: Set<number>; buyers: Map<number, string> }> = {};
    const issueSales = sales.filter((s) => s.magazine_issue_date === selectedIssue);

    issueSales.forEach((sale) => {
      if (sale.page_number === "Random") return;

      // Handle special pages (Cover, Back Page) and numbered pages
      const pageKey = sale.page_number;
      
      // Use sections_sold if available, otherwise convert from legacy page_size
      const sections = sale.sections_sold?.length 
        ? sale.sections_sold 
        : legacySizeToSections(sale.page_size);

      if (!occupancy[pageKey]) {
        occupancy[pageKey] = { sections: new Set(), buyers: new Map() };
      }

      sections.forEach((sec) => {
        occupancy[pageKey].sections.add(sec);
        occupancy[pageKey].buyers.set(sec, sale.buyer_name);
      });
    });

    return occupancy;
  }, [sales, selectedIssue]);

  // Count random page sales
  const randomPagesSold = useMemo(() => {
    if (!selectedIssue) return { count: 0, totalSections: 0 };

    const randomSales = sales.filter(
      (s) => s.magazine_issue_date === selectedIssue && s.page_number === "Random"
    );

    const totalSections = randomSales.reduce((sum, s) => {
      const sections = s.sections_sold?.length || legacySizeToSections(s.page_size).length;
      return sum + sections;
    }, 0);

    return { count: randomSales.length, totalSections };
  }, [sales, selectedIssue]);

  // Special pages
  const specialPages = ["Cover", "Inside Front Cover", "Inside Back Cover", "Back Page"] as const;

  // Stats (including special pages)
  const stats = useMemo(() => {
    const totalPages = currentPageCount + specialPages.length; // +4 for special pages
    let fullySold = 0;
    let partiallySold = 0;

    // Count special pages
    specialPages.forEach((page) => {
      const pageData = sectionOccupancy[page];
      if (pageData) {
        if (pageData.sections.size >= 8) fullySold++;
        else if (pageData.sections.size > 0) partiallySold++;
      }
    });

    // Count numbered pages
    for (let i = 1; i <= currentPageCount; i++) {
      const pageData = sectionOccupancy[String(i)];
      if (pageData) {
        if (pageData.sections.size >= 8) fullySold++;
        else if (pageData.sections.size > 0) partiallySold++;
      }
    }

    const available = totalPages - fullySold - partiallySold;
    return { totalPages, fullySold, partiallySold, available };
  }, [sectionOccupancy, currentPageCount]);

  const handleSavePageCount = () => {
    const count = parseInt(tempPageCount, 10);
    if (!isNaN(count) && count > 0 && count <= 200) {
      setPageCountByIssue((prev) => ({ ...prev, [selectedIssue]: count }));
    }
    setEditingPageCount(false);
  };

  const getSectionColor = (isSold: boolean) => {
    return isSold
      ? "bg-red-500 border-red-600"
      : "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700";
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
            <div className="w-4 h-4 rounded bg-red-500 border border-red-600" />
            <span className="text-muted-foreground">Sold</span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            {stats.available} Fully Available
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {stats.partiallySold} Partially Sold
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            {stats.fullySold} Fully Sold
          </Badge>
          {randomPagesSold.count > 0 && (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
              {randomPagesSold.count} Random ({randomPagesSold.totalSections} sections)
            </Badge>
          )}
        </div>

        {/* Page Grid - Each page is a 2x4 grid of sections */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2">
          {/* Cover Page */}
          {(() => {
            const pageData = sectionOccupancy["Cover"];
            const soldSections = pageData?.sections || new Set<number>();
            const buyerMap = pageData?.buyers || new Map<number, string>();
            return (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1 font-medium">Cover</span>
                <div className="grid grid-cols-2 gap-0.5 p-1 rounded border-2 border-primary/50 bg-card">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
                    const isSold = soldSections.has(section);
                    const buyer = buyerMap.get(section);
                    return (
                      <div
                        key={section}
                        title={isSold ? `Section ${section}: ${buyer}` : `Section ${section}: Available`}
                        className={cn("w-3 h-3 rounded-sm border cursor-default", getSectionColor(isSold))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Inside Front Cover */}
          {(() => {
            const pageData = sectionOccupancy["Inside Front Cover"];
            const soldSections = pageData?.sections || new Set<number>();
            const buyerMap = pageData?.buyers || new Map<number, string>();
            return (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1 font-medium">IFC</span>
                <div className="grid grid-cols-2 gap-0.5 p-1 rounded border-2 border-amber-500/50 bg-card">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
                    const isSold = soldSections.has(section);
                    const buyer = buyerMap.get(section);
                    return (
                      <div
                        key={section}
                        title={isSold ? `Section ${section}: ${buyer}` : `Section ${section}: Available`}
                        className={cn("w-3 h-3 rounded-sm border cursor-default", getSectionColor(isSold))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Numbered Pages */}
          {Array.from({ length: currentPageCount }, (_, i) => i + 1).map((pageNum) => {
            const pageData = sectionOccupancy[String(pageNum)];
            const soldSections = pageData?.sections || new Set<number>();
            const buyerMap = pageData?.buyers || new Map<number, string>();

            return (
              <div key={pageNum} className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">Pg {pageNum}</span>
                <div className="grid grid-cols-2 gap-0.5 p-1 rounded border border-border bg-card">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
                    const isSold = soldSections.has(section);
                    const buyer = buyerMap.get(section);
                    return (
                      <div
                        key={section}
                        title={isSold ? `Section ${section}: ${buyer}` : `Section ${section}: Available`}
                        className={cn("w-3 h-3 rounded-sm border cursor-default", getSectionColor(isSold))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Inside Back Cover */}
          {(() => {
            const pageData = sectionOccupancy["Inside Back Cover"];
            const soldSections = pageData?.sections || new Set<number>();
            const buyerMap = pageData?.buyers || new Map<number, string>();
            return (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1 font-medium">IBC</span>
                <div className="grid grid-cols-2 gap-0.5 p-1 rounded border-2 border-amber-500/50 bg-card">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
                    const isSold = soldSections.has(section);
                    const buyer = buyerMap.get(section);
                    return (
                      <div
                        key={section}
                        title={isSold ? `Section ${section}: ${buyer}` : `Section ${section}: Available`}
                        className={cn("w-3 h-3 rounded-sm border cursor-default", getSectionColor(isSold))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Back Page */}
          {(() => {
            const pageData = sectionOccupancy["Back Page"];
            const soldSections = pageData?.sections || new Set<number>();
            const buyerMap = pageData?.buyers || new Map<number, string>();
            return (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1 font-medium">Back</span>
                <div className="grid grid-cols-2 gap-0.5 p-1 rounded border-2 border-primary/50 bg-card">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
                    const isSold = soldSections.has(section);
                    const buyer = buyerMap.get(section);
                    return (
                      <div
                        key={section}
                        title={isSold ? `Section ${section}: ${buyer}` : `Section ${section}: Available`}
                        className={cn("w-3 h-3 rounded-sm border cursor-default", getSectionColor(isSold))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
