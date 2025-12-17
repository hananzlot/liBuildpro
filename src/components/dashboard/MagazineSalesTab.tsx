import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClickableMetricCard } from "./ClickableMetricCard";
import { MagazineSalesEntryDialog } from "./MagazineSalesEntryDialog";
import { MagazineSalesDetailSheet } from "./MagazineSalesDetailSheet";
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
}

const PAGE_SIZE_VALUES: Record<string, number> = {
  "1/4": 0.25,
  "1/2": 0.5,
  "3/4": 0.75,
  "Full": 1,
  "Cover": 1,
  "Back Page": 1,
};

export const MagazineSalesTab = () => {
  const { user } = useAuth();
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
      const pageValue = PAGE_SIZE_VALUES[sale.page_size] || 0;
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
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ClickableMetricCard
          title="Pages Sold"
          value={totalPages.toFixed(2)}
          subtitle="Total pages across all issues"
          icon={BookOpen}
          onClick={() => setDetailSheetOpen(true)}
        />
        <ClickableMetricCard
          title="Total Sales"
          value={formatCurrency(totalSales)}
          subtitle="Revenue to date"
          icon={DollarSign}
          onClick={() => setDetailSheetOpen(true)}
        />
      </section>

      {/* Sales by Issue Summary */}
      {Object.keys(salesByIssue).length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Sales by Issue</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(salesByIssue)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([issueDate, data]) => (
                <div
                  key={issueDate}
                  className="rounded-xl bg-card p-4 border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => setDetailSheetOpen(true)}
                >
                  <p className="text-sm text-muted-foreground">
                    Issue: {new Date(issueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-semibold">{data.pages.toFixed(2)} pages</span>
                    <span className="text-lg font-semibold text-emerald-500">{formatCurrency(data.total)}</span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

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
      />
    </div>
  );
};
