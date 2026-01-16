import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
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
  onProjectClick?: (projectId: string, initialTab?: string, returnTo?: 'payables' | 'outstandingAR', financeSubTab?: 'bills' | 'history', highlightInvoiceId?: string) => void;
  reopenPayablesSheet?: boolean;
  onPayablesSheetOpened?: () => void;
  reopenARSheet?: boolean;
  onARSheetOpened?: () => void;
  initialTab?: string;
  openPayablesOnLoad?: boolean;
  initialKPI?: string;
}

export function AnalyticsSection({ onProjectClick, reopenPayablesSheet, onPayablesSheetOpened, reopenARSheet, onARSheetOpened, initialTab, openPayablesOnLoad, initialKPI }: AnalyticsSectionProps) {
  const { isAdmin, isProduction } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Check if user can view profitability tab (admin only, not production-only users)
  const canViewProfitability = isAdmin || !isProduction;
  
  // Determine initial tab - use prop if provided, otherwise default based on role
  const getDefaultTab = useCallback(() => {
    if (initialTab && ['profitability', 'cashflow', 'receivables', 'bank', 'commission'].includes(initialTab)) {
      // If profitability requested but user can't view it, fall back to cashflow
      if (initialTab === 'profitability' && !canViewProfitability) {
        return 'cashflow';
      }
      return initialTab;
    }
    return canViewProfitability ? "profitability" : "cashflow";
  }, [initialTab, canViewProfitability]);
  
  // Filter states - default to cashflow if profitability is not accessible
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Update active tab when initialTab prop changes (e.g., from URL navigation)
  useEffect(() => {
    if (initialTab) {
      const newTab = getDefaultTab();
      setActiveTab(newTab);
    }
  }, [initialTab, getDefaultTab]);

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

  return (
    <div className="space-y-6">
      {/* Filters */}
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
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${canViewProfitability ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {canViewProfitability && (
            <TabsTrigger value="profitability" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Profitability</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="cashflow" className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Cash Flow</span>
          </TabsTrigger>
          <TabsTrigger value="receivables" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Receivables</span>
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Bank Activity</span>
          </TabsTrigger>
          <TabsTrigger value="commission" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Commission</span>
          </TabsTrigger>
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
            openPayablesOnLoad={openPayablesOnLoad}
            onPayablesSheetOpened={onPayablesSheetOpened}
            onPayablesSheetClose={() => {
              if (!isAdmin) {
                navigate('/production?view=projects', { replace: true });
              }
            }}
            hidePayablesCloseButton={false}
            openARKPIOnLoad={initialKPI === 'outstandingAR'}
            reopenARSheet={reopenARSheet}
            onARSheetOpened={onARSheetOpened}
            onARSheetClose={() => {
              if (!isAdmin) {
                navigate('/production?view=projects');
              }
            }}
          />
        </TabsContent>

        <TabsContent value="receivables" className="mt-6">
          <AccountsReceivableTab
            invoices={invoicesWithAging}
            totals={totals}
            onProjectClick={(projectId, invoiceId) => {
              // Open project with finance tab, invoices sub-tab, and highlight the invoice
              onProjectClick?.(projectId, 'finance', undefined, undefined, invoiceId);
            }}
          />
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
          <BankActivitiesTab
            transactions={bankTransactions}
            projects={projects}
            totals={totals}
            onProjectClick={onProjectClick}
          />
        </TabsContent>

        <TabsContent value="commission" className="mt-6">
          <CommissionReportTab
            commissionSummary={commissionSummary}
            commissionPayments={commissionPayments}
            totals={totals}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
