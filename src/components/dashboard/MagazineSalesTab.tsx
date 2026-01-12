import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, DollarSign, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClickableMetricCard } from "./ClickableMetricCard";
import { MagazineSalesEntryDialog } from "./MagazineSalesEntryDialog";
import { MagazineSalesDetailSheet } from "./MagazineSalesDetailSheet";
import { MagazinePageAvailability } from "./MagazinePageAvailability";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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

export const MagazineSalesTab = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<MagazineSale | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["magazine-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazine_sales")
        .select("*")
        .order("magazine_issue_date", { ascending: false });
      if (error) throw error;
      return data as MagazineSale[];
    },
  });

  // Calculate KPIs by page size
  const kpiData = useMemo(() => {
    const buyersBySize = {
      full: { count: 0, revenue: 0 },
      half: { count: 0, revenue: 0 },
      third: { count: 0, revenue: 0 },
      quarter: { count: 0, revenue: 0 },
    };
    const salesByIssue: Record<string, { buyers: number; total: number }> = {};

    sales.forEach((sale) => {
      const price = Number(sale.price);
      
      // Categorize by page_size
      const size = sale.page_size.toLowerCase();
      if (size === "full" || size === "cover" || size === "back page") {
        buyersBySize.full.count++;
        buyersBySize.full.revenue += price;
      } else if (size === "1/2" || size === "half") {
        buyersBySize.half.count++;
        buyersBySize.half.revenue += price;
      } else if (size === "1/3" || size === "third") {
        buyersBySize.third.count++;
        buyersBySize.third.revenue += price;
      } else if (size === "1/4" || size === "quarter") {
        buyersBySize.quarter.count++;
        buyersBySize.quarter.revenue += price;
      }

      // Sales by issue
      if (!salesByIssue[sale.magazine_issue_date]) {
        salesByIssue[sale.magazine_issue_date] = { buyers: 0, total: 0 };
      }
      salesByIssue[sale.magazine_issue_date].buyers++;
      salesByIssue[sale.magazine_issue_date].total += price;
    });

    const totalBuyers = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.price), 0);

    return { buyersBySize, salesByIssue, totalBuyers, totalRevenue };
  }, [sales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleEntrySuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["magazine-sales"] });
    setEntryDialogOpen(false);
    setEditingSale(null);
  };

  const handleEdit = (sale: MagazineSale) => {
    setEditingSale(sale);
    setEntryDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section className="flex flex-wrap items-end gap-3">
        {/* Buyers by Page Size */}
        <div className="rounded-2xl bg-card p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Buyers by Page Size</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Full Page:</span>
              <span className="font-semibold">{kpiData.buyersBySize.full.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Half Page:</span>
              <span className="font-semibold">{kpiData.buyersBySize.half.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1/3 Page:</span>
              <span className="font-semibold">{kpiData.buyersBySize.third.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1/4 Page:</span>
              <span className="font-semibold">{kpiData.buyersBySize.quarter.count}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Total Buyers:</span>
            <span className="font-bold text-primary">{kpiData.totalBuyers}</span>
          </div>
        </div>

        {/* Revenue by Page Size */}
        <div className="rounded-2xl bg-card p-4 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetailSheetOpen(true)}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Revenue by Page Size</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Full Page:</span>
              <span className="font-semibold text-emerald-500">{formatCurrency(kpiData.buyersBySize.full.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Half Page:</span>
              <span className="font-semibold text-emerald-500">{formatCurrency(kpiData.buyersBySize.half.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1/3 Page:</span>
              <span className="font-semibold text-emerald-500">{formatCurrency(kpiData.buyersBySize.third.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1/4 Page:</span>
              <span className="font-semibold text-emerald-500">{formatCurrency(kpiData.buyersBySize.quarter.revenue)}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Total Revenue:</span>
            <span className="font-bold text-emerald-500">{formatCurrency(kpiData.totalRevenue)}</span>
          </div>
        </div>

        {/* Sales by Issue Card */}
        {Object.keys(kpiData.salesByIssue).length > 0 && (
          <div className="rounded-2xl bg-card p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Sales by Issue</p>
            <div className="space-y-1">
              {Object.entries(kpiData.salesByIssue)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, 4)
                .map(([issueDate, data]) => (
                  <div
                    key={issueDate}
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                    onClick={() => setDetailSheetOpen(true)}
                  >
                    <span className="text-muted-foreground">
                      {new Date(issueDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                    </span>
                    <span className="font-semibold text-emerald-500">{formatCurrency(data.total)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        <div className="flex-1" />
        <Button onClick={() => { setEditingSale(null); setEntryDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </section>

      {/* Page Availability Grid */}
      <MagazinePageAvailability sales={sales} onEditSale={handleEdit} />

      {/* Entry Dialog */}
      <MagazineSalesEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        onSuccess={handleEntrySuccess}
        existingSales={sales}
        editingSale={editingSale}
        userId={user?.id}
      />

      {/* Detail Sheet */}
      <MagazineSalesDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        sales={sales}
        onEdit={handleEdit}
        userId={user?.id}
        isAdmin={isAdmin}
      />
    </div>
  );
};
