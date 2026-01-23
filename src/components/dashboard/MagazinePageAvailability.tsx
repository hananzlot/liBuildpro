import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings2, Check, Edit2, User, DollarSign, FileText, Plus } from "lucide-react";
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
  onEditSale?: (sale: MagazineSale) => void;
  onNewEntry?: () => void;
}

export const MagazinePageAvailability = ({ sales, onEditSale, onNewEntry }: MagazinePageAvailabilityProps) => {
  const [selectedIssue, setSelectedIssue] = useState<string>("");
  const [pageCountByIssue, setPageCountByIssue] = useState<Record<string, number>>({});
  const [editingPageCount, setEditingPageCount] = useState(false);
  const [tempPageCount, setTempPageCount] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [adTypeFilter, setAdTypeFilter] = useState<string>("all");

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

  // Get sales for selected page
  const pageSales = useMemo(() => {
    if (!selectedIssue || !selectedPage) return [];
    return sales.filter(
      (s) => s.magazine_issue_date === selectedIssue && s.page_number === selectedPage
    );
  }, [sales, selectedIssue, selectedPage]);

  // Calculate section occupancy, ad types, and page sizes for selected issue
  const { sectionOccupancy, pageAdTypes, pagePageSizes } = useMemo(() => {
    if (!selectedIssue) return { sectionOccupancy: {}, pageAdTypes: {}, pagePageSizes: {} };

    const occupancy: Record<string, { sections: Set<number>; buyers: Map<number, string>; hasSales: boolean }> = {};
    const adTypes: Record<string, string> = {}; // pageNumber -> adType
    const pageSizes: Record<string, Set<string>> = {}; // pageNumber -> set of page sizes
    const issueSales = sales.filter((s) => s.magazine_issue_date === selectedIssue);

    issueSales.forEach((sale) => {
      if (sale.page_number === "Random") return;

      const pageKey = sale.page_number;
      const sections = sale.sections_sold?.length ? sale.sections_sold : [];

      if (!occupancy[pageKey]) {
        occupancy[pageKey] = { sections: new Set(), buyers: new Map(), hasSales: false };
      }
      if (!pageSizes[pageKey]) {
        pageSizes[pageKey] = new Set();
      }

      occupancy[pageKey].hasSales = true;
      sections.forEach((sec) => {
        occupancy[pageKey].sections.add(sec);
        occupancy[pageKey].buyers.set(sec, sale.buyer_name);
      });

      // Track page sizes sold on this page
      if (sale.page_size) {
        pageSizes[pageKey].add(sale.page_size);
      }

      // Track ad type for page (first one wins)
      if (!adTypes[pageKey] && sale.ad_sold) {
        adTypes[pageKey] = sale.ad_sold;
      }
    });

    return { sectionOccupancy: occupancy, pageAdTypes: adTypes, pagePageSizes: pageSizes };
  }, [sales, selectedIssue]);

  // Get unique ad types for filter
  const uniqueAdTypes = useMemo(() => {
    const adTypes = new Set<string>();
    Object.values(pageAdTypes).forEach((adType) => {
      if (adType) adTypes.add(adType);
    });
    return Array.from(adTypes).sort();
  }, [pageAdTypes]);

  // Group pages by ad type
  const pagesByAdType = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const unassigned: string[] = [];

    // All pages including special ones
    const allPages = [
      "Cover",
      "Inside Front Cover",
      ...Array.from({ length: currentPageCount }, (_, i) => String(i + 1)),
      "Inside Back Cover",
      "Back Page",
    ];

    allPages.forEach((page) => {
      const adType = pageAdTypes[page];
      if (adType) {
        if (!groups[adType]) {
          groups[adType] = [];
        }
        groups[adType].push(page);
      } else {
        unassigned.push(page);
      }
    });

    return { groups, unassigned };
  }, [pageAdTypes, currentPageCount]);

  // Filter pages based on selected ad type
  const filteredPagesByAdType = useMemo(() => {
    if (adTypeFilter === "all") {
      return pagesByAdType;
    }
    if (adTypeFilter === "available") {
      return { groups: {}, unassigned: pagesByAdType.unassigned };
    }
    // Filter to specific ad type
    const filteredGroups: Record<string, string[]> = {};
    if (pagesByAdType.groups[adTypeFilter]) {
      filteredGroups[adTypeFilter] = pagesByAdType.groups[adTypeFilter];
    }
    return { groups: filteredGroups, unassigned: [] };
  }, [pagesByAdType, adTypeFilter]);

  // Count random page sales
  const randomPagesSold = useMemo(() => {
    if (!selectedIssue) return { count: 0 };

    const randomSales = sales.filter(
      (s) => s.magazine_issue_date === selectedIssue && s.page_number === "Random"
    );

    return { count: randomSales.length };
  }, [sales, selectedIssue]);

  // Special pages
  const specialPages = ["Cover", "Inside Front Cover", "Inside Back Cover", "Back Page"] as const;

  // Stats (including special pages)
  const stats = useMemo(() => {
    const totalPages = currentPageCount + specialPages.length;
    let pagesWithSales = 0;
    let available = 0;

    // Count special pages
    specialPages.forEach((page) => {
      const pageData = sectionOccupancy[page];
      if (pageData?.hasSales) pagesWithSales++;
      else available++;
    });

    // Count numbered pages
    for (let i = 1; i <= currentPageCount; i++) {
      const pageData = sectionOccupancy[String(i)];
      if (pageData?.hasSales) pagesWithSales++;
      else available++;
    }

    return { totalPages, pagesWithSales, available };
  }, [sectionOccupancy, currentPageCount]);

  const handleSavePageCount = () => {
    const count = parseInt(tempPageCount, 10);
    if (!isNaN(count) && count > 0 && count <= 200) {
      setPageCountByIssue((prev) => ({ ...prev, [selectedIssue]: count }));
    }
    setEditingPageCount(false);
  };

  const handlePageClick = (pageNumber: string) => {
    setSelectedPage(pageNumber);
    setDetailSheetOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPageStyles = (pageKey: string) => {
    const pageData = sectionOccupancy[pageKey];
    const hasSales = pageData?.hasSales || false;
    const soldCount = pageData?.sections?.size || 0;
    
    if (soldCount >= 12) {
      // Fully sold (all 12 slots)
      return "border-red-500 bg-red-500/10";
    } else if (hasSales) {
      // Has some sales
      return "border-amber-500 bg-amber-500/10";
    }
    // Available
    return "border-emerald-500 bg-emerald-500/10";
  };

  const renderPageCell = (pageKey: string, label: string, borderClass: string = "border") => {
    const pageData = sectionOccupancy[pageKey];
    const soldCount = pageData?.sections?.size || 0;
    const hasSales = pageData?.hasSales || false;
    const sizes = pagePageSizes[pageKey];
    const pageSizeLabel = sizes ? Array.from(sizes).join(", ") : "";

    return (
      <div
        key={pageKey}
        className={cn(
          "flex flex-col items-center cursor-pointer hover:scale-105 transition-transform",
        )}
        onClick={() => handlePageClick(pageKey)}
      >
        <span className="text-xs text-muted-foreground mb-1 font-medium truncate max-w-full">{label}</span>
        <div
          className={cn(
            "w-12 h-14 rounded flex flex-col items-center justify-center text-xs font-medium",
            borderClass,
            getPageStyles(pageKey)
          )}
        >
          {hasSales ? (
            <>
              <span className="text-foreground">{soldCount}</span>
              <span className="text-[9px] text-muted-foreground">sold</span>
              {pageSizeLabel && (
                <span className="text-[8px] text-muted-foreground truncate max-w-[44px]">{pageSizeLabel}</span>
              )}
            </>
          ) : null}
        </div>
      </div>
    );
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
    <>
      <Card>
        <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Page Availability</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedIssue} onValueChange={setSelectedIssue}>
                <SelectTrigger className="w-[180px]">
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
              <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by Ad Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ad Types</SelectItem>
                  <SelectItem value="available">Available Only</SelectItem>
                  {uniqueAdTypes.map((adType) => (
                    <SelectItem key={adType} value={adType}>
                      {adType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingPageCount ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={tempPageCount}
                    onChange={(e) => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setTempPageCount(val); }}
                    className="w-20 h-9"
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
              {onNewEntry && (
                <Button onClick={onNewEntry} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Entry
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500/10" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded border-2 border-amber-500 bg-amber-500/10" />
              <span className="text-muted-foreground">Has Sales</span>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              {stats.available} Available
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              {stats.pagesWithSales} With Sales
            </Badge>
            {randomPagesSold.count > 0 && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                {randomPagesSold.count} Random
              </Badge>
            )}
          </div>

          {/* Pages grouped by Ad Type - condensed horizontal layout */}
          <div className="flex flex-wrap gap-4">
            {/* Pages with Ad Types */}
            {Object.entries(filteredPagesByAdType.groups).map(([adType, pages]) => (
              <div key={adType} className="flex-shrink-0 p-3 rounded-lg border border-border bg-muted/30">
                <h4 className="text-xs font-semibold text-foreground capitalize mb-2 whitespace-nowrap">
                  {adType}
                </h4>
                <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                  {pages.map((page) => {
                    const label = page === "Inside Front Cover" ? "IFC" 
                      : page === "Inside Back Cover" ? "IBC" 
                      : page === "Back Page" ? "Back"
                      : page === "Cover" ? "Cover"
                      : `${page}`;
                    return renderPageCell(page, label, "border-2");
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Unassigned Pages - separate section */}
          {filteredPagesByAdType.unassigned.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Available Pages
              </h4>
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-1.5">
                {filteredPagesByAdType.unassigned.map((page) => {
                  const label = page === "Inside Front Cover" ? "IFC" 
                    : page === "Inside Back Cover" ? "IBC" 
                    : page === "Back Page" ? "Back"
                    : page === "Cover" ? "Cover"
                    : `${page}`;
                  return renderPageCell(page, label, "border-2");
                })}
              </div>
            </div>
          )}

          {/* Random Pages Note */}
          {randomPagesSold.count > 0 && (
            <p className="text-xs text-muted-foreground">
              * {randomPagesSold.count} sale(s) assigned to "Random" pages (click to view in detail sheet)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Page Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedPage} - {selectedIssue && new Date(selectedIssue).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </SheetTitle>
            <SheetDescription>
              {pageSales.length === 0
                ? "No buyers on this page yet"
                : `${pageSales.length} buyer${pageSales.length > 1 ? "s" : ""} on this page`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {pageSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>This page has no sales yet.</p>
              </div>
            ) : (
              pageSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 rounded-lg border border-border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{sale.buyer_name}</span>
                    </div>
                    {onEditSale && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetailSheetOpen(false);
                          onEditSale(sale);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {sale.company_name && (
                    <p className="text-sm text-muted-foreground">{sale.company_name}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Page Size:</span>{" "}
                      <span className="font-medium">{sale.page_size}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ad Type:</span>{" "}
                      <span className="font-medium">{sale.ad_sold}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-emerald-500">{formatCurrency(sale.price)}</span>
                  </div>

                  {(sale.buyer_phone || sale.buyer_email) && (
                    <div className="pt-2 border-t border-border text-sm space-y-1">
                      {sale.buyer_phone && (
                        <p className="text-muted-foreground">📞 {sale.buyer_phone}</p>
                      )}
                      {sale.buyer_email && (
                        <p className="text-muted-foreground">✉️ {sale.buyer_email}</p>
                      )}
                    </div>
                  )}

                  {sale.sections_sold && sale.sections_sold.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        Slot: #{sale.sections_sold.join(", #")}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
