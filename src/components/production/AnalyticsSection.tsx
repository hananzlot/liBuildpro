import { useState, useMemo, useCallback, useEffect, RefObject } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { useAnalyticsFilters } from "@/stores/useAnalyticsFilters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsFilters } from "./analytics/AnalyticsFilters";
import { ProfitabilityTab } from "./analytics/ProfitabilityTab";
import { CashFlowTab } from "./analytics/CashFlowTab";
import { AccountsReceivableTab } from "./analytics/AccountsReceivableTab";
import { BankActivitiesTab } from "./analytics/BankActivitiesTab";
import { CommissionReportTab } from "./analytics/CommissionReportTab";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Wallet, FileText, Building, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AnalyticsSectionProps {
  onProjectClick?: (projectId: string, initialTab?: string, returnTo?: 'payables' | 'outstandingAR', financeSubTab?: 'bills' | 'history', highlightInvoiceId?: string, highlightBillId?: string) => void;
  reopenPayablesSheet?: boolean;
  onPayablesSheetOpened?: () => void;
  reopenARSheet?: boolean;
  onARSheetOpened?: () => void;
  initialTab?: string;
  openPayablesOnLoad?: boolean;
  initialKPI?: string;
  visibleReports?: string[];
  filtersContainerRef?: RefObject<HTMLDivElement | null>;
}

export function AnalyticsSection({ onProjectClick, reopenPayablesSheet, onPayablesSheetOpened, reopenARSheet, onARSheetOpened, initialTab, openPayablesOnLoad, initialKPI, visibleReports, filtersContainerRef }: AnalyticsSectionProps) {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Get section from URL for AR/Payables routing
  const urlSection = searchParams.get('section');
  
  // Check if user can view profitability tab (admin only, not production-only users)
  // Also check visibleReports if provided
  const canViewProfitability = !visibleReports || visibleReports.includes('profitability');
  const canViewCashflow = !visibleReports || visibleReports.includes('cashflow');
  const canViewReceivables = !visibleReports || visibleReports.includes('receivables');
  const canViewBank = !visibleReports || visibleReports.includes('bank');
  const canViewCommission = !visibleReports || visibleReports.includes('commission');
  
  // Build ordered list of permitted tabs
  const permittedTabs = useMemo(() => {
    const all = [
      { key: "profitability", allowed: canViewProfitability },
      { key: "cashflow", allowed: canViewCashflow },
      { key: "receivables", allowed: canViewReceivables },
      { key: "bank", allowed: canViewBank },
      { key: "commission", allowed: canViewCommission },
    ];
    return all.filter(t => t.allowed).map(t => t.key);
  }, [canViewProfitability, canViewCashflow, canViewReceivables, canViewBank, canViewCommission]);

  // Determine initial tab - use prop if provided and permitted, otherwise first permitted tab
  const getDefaultTab = useCallback(() => {
    if (initialTab && permittedTabs.includes(initialTab)) {
      return initialTab;
    }
    return permittedTabs[0] || "profitability";
  }, [initialTab, permittedTabs]);
  
  // Persistent filter state from Zustand store
  const store = useAnalyticsFilters();
  
  // Derive DateRange from store (deserialize ISO strings)
  const dateRange: DateRange | undefined = useMemo(() => {
    if (store.dateRangeFrom && store.dateRangeTo) {
      return { from: new Date(store.dateRangeFrom), to: new Date(store.dateRangeTo) };
    }
    return undefined;
  }, [store.dateRangeFrom, store.dateRangeTo]);

  const setDateRange = useCallback((range: DateRange | undefined) => {
    store.setDateRange(
      range?.from ? range.from.toISOString() : null,
      range?.to ? range.to.toISOString() : null
    );
  }, [store.setDateRange]);

  const selectedProjects = store.selectedProjects;
  const setSelectedProjects = store.setSelectedProjects;
  const selectedSalespeople = store.selectedSalespeople;
  const setSelectedSalespeople = store.setSelectedSalespeople;

  // Active tab: prefer store value if hydrated and no explicit initialTab override
  const resolvedActiveTab = useMemo(() => {
    // If an explicit initialTab prop was given (e.g. from URL), use it
    if (initialTab && permittedTabs.includes(initialTab)) return initialTab;
    // If store has a persisted tab and it's permitted, use it
    if (store.hasHydrated && store.activeTab && permittedTabs.includes(store.activeTab)) return store.activeTab;
    return getDefaultTab();
  }, [initialTab, permittedTabs, store.hasHydrated, store.activeTab, getDefaultTab]);

  const [activeTab, setActiveTabLocal] = useState(resolvedActiveTab);
  
  // Keep local activeTab in sync with resolved value on mount/changes
  useEffect(() => {
    setActiveTabLocal(resolvedActiveTab);
  }, [resolvedActiveTab]);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabLocal(tab);
    store.setActiveTab(tab);
  }, [store.setActiveTab]);

  // Set default date range for bank tab if no persisted range exists
  useEffect(() => {
    if (store.hasHydrated && activeTab === "bank" && !store.dateRangeFrom) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      setDateRange({ from, to });
    }
  }, [store.hasHydrated, activeTab, store.dateRangeFrom, setDateRange]);

  // Sync tab changes to URL when on the /analytics route
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "bank" && !store.dateRangeFrom) {
      // Default bank to last 7 days only if no persisted range
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      setDateRange({ from, to });
    } else if (tab !== "bank") {
      // Other tabs default to all dates (no filter)
      setDateRange(undefined);
    }
    // Only update URL if we're on an analytics route
    if (window.location.pathname.startsWith('/analytics')) {
      navigate(`/analytics/${tab}`, { replace: true });
    }
  }, [navigate, setActiveTab, setDateRange, store.dateRangeFrom]);

  // Update active tab when initialTab prop changes (e.g., from URL navigation)
  useEffect(() => {
    if (initialTab && permittedTabs.includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab, permittedTabs, setActiveTab]);

  // Fetch analytics data with filters
  const {
    isLoading,
    projects,
    allProjects,
    allSalespeople,
    invoicesWithAging,
    bankTransactions,
    commissionSummary,
    commissionPayments,
    totals,
    payablesWithCashImpact,
    scheduledPayments,
    cashFlowTimeline,
  } = useProductionAnalytics({
    dateRange,
    selectedProjects,
    selectedSalespeople,
  });

  // Schedule payment handler
  const handleSchedulePayment = useCallback(async (billId: string, date: Date, amount: number) => {
    try {
      const { error } = await supabase
        .from("project_bills")
        .update({
          scheduled_payment_date: date.toISOString().split('T')[0],
          scheduled_payment_amount: amount,
        })
        .eq("id", billId);

      if (error) throw error;
      
      toast.success("Payment scheduled");
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
    } catch (error: any) {
      toast.error(`Failed to schedule payment: ${error.message}`);
    }
  }, [queryClient]);

  // Clear schedule handler
  const handleClearSchedule = useCallback(async (billId: string) => {
    try {
      const { error } = await supabase
        .from("project_bills")
        .update({
          scheduled_payment_date: null,
          scheduled_payment_amount: null,
        })
        .eq("id", billId);

      if (error) throw error;
      
      toast.success("Schedule cleared");
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
    } catch (error: any) {
      toast.error(`Failed to clear schedule: ${error.message}`);
    }
  }, [queryClient]);

  // Mark as paid handler - creates bill_payment record and updates bill
  const handleMarkAsPaid = useCallback(async (billId: string, data: {
    paymentDate: Date;
    amount: number;
    bankName: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
  }) => {
    try {
      // Get bill amount for accurate rollups
      const { data: bill, error: fetchError } = await supabase
        .from("project_bills")
        .select("bill_amount")
        .eq("id", billId)
        .single();

      if (fetchError) throw fetchError;

      // Create bill payment record with all details
      const { error: paymentError } = await supabase
        .from("bill_payments")
        .insert({
          bill_id: billId,
          payment_amount: data.amount,
          payment_date: data.paymentDate.toISOString().split("T")[0],
          bank_name: data.bankName,
          payment_method: data.paymentMethod,
          payment_reference: data.paymentReference,
        });

      if (paymentError) throw paymentError;

      // Recalculate rollups from bill_payments to prevent drift
      const { data: allPayments, error: paymentsError } = await supabase
        .from("bill_payments")
        .select("payment_amount")
        .eq("bill_id", billId);

      if (paymentsError) throw paymentsError;

      const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      const billAmount = bill?.bill_amount || 0;
      const newBalance = billAmount - totalPaid;

      const { error: updateError } = await supabase
        .from("project_bills")
        .update({
          amount_paid: totalPaid,
          balance: newBalance,
          scheduled_payment_date: null,
          scheduled_payment_amount: null,
        })
        .eq("id", billId);

      if (updateError) throw updateError;

      toast.success("Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["analytics-bills"] });
      queryClient.invalidateQueries({ queryKey: ["production-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-bill-payments"] });
      // Refresh Projects main table calculations
      queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      queryClient.invalidateQueries({ queryKey: ["all-bill-payments"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error: any) {
      toast.error(`Failed to record payment: ${error.message}`);
    }
  }, [queryClient]);

  // Prepare filter options
  const projectOptions = useMemo(() => {
    return allProjects.map(p => ({
      value: p.id,
      label: `#${p.project_number} - ${p.project_address || p.project_name}`,
    }));
  }, [allProjects]);

  const salespeopleOptions = useMemo(() => {
    return allSalespeople.map(sp => ({
      value: sp,
      label: sp,
    }));
  }, [allSalespeople]);

  // Export handler (simple CSV for now)
  const handleExport = useCallback(() => {
    let csvContent = "";
    
    if (activeTab === "profitability") {
      csvContent = "Project #,Project Name,Salesperson,Contract Total,Costs,Profit,Margin %,Status\n";
      projects.forEach(p => {
        const margin = p.contractsTotal > 0 ? (p.expectedNetProfit / p.contractsTotal) * 100 : 0;
        csvContent += `${p.project_number},"${p.project_name}","${p.primary_salesperson || ''}",${p.contractsTotal},${p.totalBillsReceived},${p.expectedNetProfit},${margin.toFixed(1)},${p.project_status || ''}\n`;
      });
    } else if (activeTab === "cashflow") {
      csvContent = "Project #,Project Name,Collected,Bills Paid,Cash Position,AR Balance,Status\n";
      projects.forEach(p => {
        csvContent += `${p.project_number},"${p.project_name}",${p.invoicesCollected},${p.totalBillsPaid},${p.cashPosition},${p.invoiceBalanceDue},"${p.cashStatus}"\n`;
      });
    } else if (activeTab === "receivables") {
      csvContent = "Project #,Invoice #,Invoice Date,Amount,Paid,Balance,Days Outstanding,Aging\n";
      invoicesWithAging.forEach(i => {
        csvContent += `${i.project_number},"${i.invoice_number || ''}","${i.invoice_date || ''}",${i.amount || 0},${i.payments_received || 0},${i.open_balance || 0},${i.daysOutstanding},"${i.agingBucket}"\n`;
      });
    } else if (activeTab === "bank") {
      csvContent = "Date,Type,Project,Description,Amount,Bank/Method\n";
      bankTransactions.forEach(t => {
        csvContent += `"${t.date || ''}","${t.type}","${t.project_name}","${t.description}",${t.amount},"${t.bank_or_method || ''}"\n`;
      });
    } else if (activeTab === "commission") {
      csvContent = "Salesperson,Calculated,Paid,Balance,Projects\n";
      commissionSummary.forEach(s => {
        csvContent += `"${s.name}",${s.calculated},${s.paid},${s.balance},${s.projectCount}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [activeTab, projects, invoicesWithAging, bankTransactions, commissionSummary]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const usePortal = !!filtersContainerRef?.current;
  const filtersElement = (
    <AnalyticsFilters
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      selectedProjects={selectedProjects}
      onProjectsChange={setSelectedProjects}
      selectedSalespeople={selectedSalespeople}
      onSalespeopleChange={setSelectedSalespeople}
      projectOptions={projectOptions}
      salespeopleOptions={salespeopleOptions}
      onExport={handleExport}
      compact={usePortal}
    />
  );

  return (
    <div className="space-y-6">
      {/* Filters - portal into header if container provided, otherwise inline */}
      {filtersContainerRef?.current
        ? createPortal(filtersElement, filtersContainerRef.current)
        : filtersElement
      }

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${[canViewProfitability, canViewCashflow, canViewReceivables, canViewBank, canViewCommission].filter(Boolean).length}, minmax(0, 1fr))` }}>
          {canViewProfitability && (
            <TabsTrigger value="profitability" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Profitability</span>
            </TabsTrigger>
          )}
          {canViewCashflow && (
            <TabsTrigger value="cashflow" className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Cash Flow</span>
            </TabsTrigger>
          )}
          {canViewReceivables && (
            <TabsTrigger value="receivables" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Receivables</span>
            </TabsTrigger>
          )}
          {canViewBank && (
            <TabsTrigger value="bank" className="flex items-center gap-1.5">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Bank Activity</span>
            </TabsTrigger>
          )}
          {canViewCommission && (
            <TabsTrigger value="commission" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Commission</span>
            </TabsTrigger>
          )}
        </TabsList>

        {canViewProfitability && (
          <TabsContent value="profitability" className="mt-6">
            <ProfitabilityTab
              projects={projects}
              totals={totals}
              onProjectClick={onProjectClick}
            />
          </TabsContent>
        )}

        {canViewCashflow && (
          <TabsContent value="cashflow" className="mt-6">
            <CashFlowTab
              projects={projects}
              totals={totals}
              invoicesWithAging={invoicesWithAging}
              bankTransactions={bankTransactions}
              payablesWithCashImpact={payablesWithCashImpact}
              cashFlowTimeline={cashFlowTimeline}
              scheduledPayments={scheduledPayments}
              onProjectClick={onProjectClick}
              onSchedulePayment={handleSchedulePayment}
              onClearSchedule={handleClearSchedule}
              onMarkAsPaid={handleMarkAsPaid}
              reopenPayablesSheet={reopenPayablesSheet}
              openPayablesOnLoad={openPayablesOnLoad || urlSection === 'payables'}
              onPayablesSheetOpened={onPayablesSheetOpened}
              onPayablesSheetClose={() => {
                navigate('/production', { replace: true });
              }}
              onPayablesSheetOpen={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('section', 'payables');
                setSearchParams(newParams, { replace: true });
              }}
              hidePayablesCloseButton={false}
              openARKPIOnLoad={initialKPI === 'outstandingAR' || urlSection === 'ar'}
              reopenARSheet={reopenARSheet}
              onARSheetOpened={onARSheetOpened}
              onARSheetClose={() => {
                navigate('/production', { replace: true });
              }}
              onARSheetOpen={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('section', 'ar');
                setSearchParams(newParams, { replace: true });
              }}
            />
          </TabsContent>
        )}

        {canViewReceivables && (
          <TabsContent value="receivables" className="mt-6">
            <AccountsReceivableTab
              invoices={invoicesWithAging}
              totals={totals}
              onProjectClick={(projectId, invoiceId) => {
                onProjectClick?.(projectId, 'finance', undefined, undefined, invoiceId);
              }}
            />
          </TabsContent>
        )}

        {canViewBank && (
          <TabsContent value="bank" className="mt-6">
            <BankActivitiesTab
              transactions={bankTransactions}
              projects={projects}
              totals={totals}
              onProjectClick={onProjectClick}
            />
          </TabsContent>
        )}

        {canViewCommission && (
          <TabsContent value="commission" className="mt-6">
            <CommissionReportTab
              commissionSummary={commissionSummary}
              commissionPayments={commissionPayments}
              totals={totals}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
