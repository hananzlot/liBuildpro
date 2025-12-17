import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, DollarSign, Plus } from "lucide-react";
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

  // Calculate KPIs
  const { totalPages, salesByIssue } = useMemo(() => {
    let totalPages = 0;
    const salesByIssue: Record<string, { pages: number; total: number }> = {};

    sales.forEach((sale) => {
      const pageValue = getPageValue(sale);
      totalPages += pageValue;

      if (!salesByIssue[sale.magazine_issue_date]) {
        salesByIssue[sale.magazine_issue_date] = { pages: 0, total: 0 };
      }
      salesByIssue[sale.magazine_issue_date].pages += pageValue;
      salesByIssue[sale.magazine_issue_date].total += Number(sale.price);
    });

    return { totalPages, salesByIssue };
  }, [sales]);

  const totalSales = useMemo(() => {
    return sales.reduce((sum, sale) => sum + Number(sale.price), 0);
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
      {/* Action Bar */}
      <div className="flex justify-end">
        <Button onClick={() => { setEditingSale(null); setEntryDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* KPI Cards */}
      <section className="flex flex-wrap gap-3">
        <div className="w-40">
          <ClickableMetricCard
            title="Pages Sold"
            value={formatPageCount(totalPages)}
            subtitle="All issues"
            icon={BookOpen}
            onClick={() => setDetailSheetOpen(true)}
          />
        </div>
        <div className="w-40">
          <ClickableMetricCard
            title="Total Sales"
            value={formatCurrency(totalSales)}
            subtitle="Revenue"
            icon={DollarSign}
            onClick={() => setDetailSheetOpen(true)}
          />
        </div>
      </section>

      {/* Sales by Issue Summary */}
      {Object.keys(salesByIssue).length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">Sales by Issue</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(salesByIssue)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([issueDate, data]) => (
                <div
                  key={issueDate}
                  className="rounded-lg bg-card px-3 py-2 border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => setDetailSheetOpen(true)}
                >
                  <p className="text-xs text-muted-foreground">
                    {new Date(issueDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-semibold">{formatPageCount(data.pages)} pg</span>
                    <span className="text-sm font-semibold text-emerald-500">{formatCurrency(data.total)}</span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Page Availability Grid */}
      <MagazinePageAvailability sales={sales} />

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
