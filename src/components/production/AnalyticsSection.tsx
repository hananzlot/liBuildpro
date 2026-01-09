import { useState, useMemo, useCallback } from "react";
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

interface AnalyticsSectionProps {
  onProjectClick?: (projectId: string) => void;
}

export function AnalyticsSection({ onProjectClick }: AnalyticsSectionProps) {
  const { isAdmin, isProduction } = useAuth();
  
  // Check if user can view profitability tab (admin only, not production-only users)
  const canViewProfitability = isAdmin || !isProduction;
  
  // Filter states - default to cashflow if profitability is not accessible
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(canViewProfitability ? "profitability" : "cashflow");

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
  } = useProductionAnalytics({
    dateRange,
    selectedProjects,
    selectedSalespeople,
  });

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
            onProjectClick={onProjectClick}
          />
        </TabsContent>

        <TabsContent value="receivables" className="mt-6">
          <AccountsReceivableTab
            invoices={invoicesWithAging}
            totals={totals}
            onProjectClick={onProjectClick}
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
