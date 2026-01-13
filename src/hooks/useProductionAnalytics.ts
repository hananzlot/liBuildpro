import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

export interface AnalyticsFilters {
  dateRange: DateRange | undefined;
  selectedProjects: string[];
  selectedSalespeople: string[];
}

export interface ProjectWithFinancials {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  secondary_salesperson: string | null;
  tertiary_salesperson: string | null;
  quaternary_salesperson: string | null;
  project_manager: string | null;
  estimated_cost: number | null;
  estimated_project_cost: number | null;
  effectiveEstimatedCost: number;
  exceededExpectedCosts: boolean;
  lead_cost_percent: number | null;
  commission_split_pct: number | null;
  agreement_signed_date: string | null;
  created_at: string;
  // Calculated fields
  contractsTotal: number;
  totalBillsReceived: number;
  totalBillsPaid: number;
  invoicesTotal: number;
  invoicesCollected: number;
  invoiceBalanceDue: number;
  leadCostAmount: number;
  grossProfit: number;
  totalCommission: number;
  expectedNetProfit: number;
  cashPosition: number;
  // Flags
  hasMissingContract: boolean;
  cashStatus: 'positive' | 'low' | 'negative' | 'overdue';
}

export interface InvoiceWithAging {
  id: string;
  project_id: string | null;
  project_name: string;
  project_number: number;
  project_address: string | null;
  primary_salesperson: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  payments_received: number | null;
  open_balance: number | null;
  daysOutstanding: number;
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
  phase_description: string | null;
}

export interface BankTransaction {
  id: string;
  date: string | null;
  type: 'in' | 'out';
  project_id: string | null;
  project_name: string;
  project_address: string | null;
  description: string;
  amount: number;
  bank_or_method: string | null;
  vendor_name?: string | null;
  vendor_type?: string | null;
}

export interface SalespersonCommission {
  name: string;
  calculated: number;
  paid: number;
  balance: number;
  projectCount: number;
}

export interface PayableWithCashImpact {
  id: string;
  project_id: string;
  project_number: number;
  project_name: string;
  project_address: string | null;
  vendor: string | null;
  bill_ref: string | null;
  category: string | null;
  amount_due: number;
  scheduled_payment_date: string | null;
  scheduled_payment_amount: number | null;
  project_current_cash: number;
  cash_if_this_paid: number;
  total_project_payables: number;
  cash_if_all_project_payables_paid: number;
}

export interface CashFlowTimelinePoint {
  date: string;
  cashPosition: number;
  inflows: number;
  outflows: number;
  cumulativeInflows: number;
  cumulativeOutflows: number;
  details: Array<{
    type: 'inflow' | 'outflow';
    description: string;
    amount: number;
    project_number: number;
  }>;
}

export function useProductionAnalytics(filters: AnalyticsFilters) {
  // Fetch all projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["analytics-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("deleted_at", null)
        .order("project_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all financial data
  const { data: agreements = [] } = useQuery({
    queryKey: ["analytics-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, project_id, total_price, agreement_signed_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["analytics-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_invoices")
        .select(`
          id, project_id, invoice_number, invoice_date, amount, payments_received, open_balance,
          payment_phase:project_payment_phases(phase_name, description)
        `);
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["analytics-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payments")
        .select("id, project_id, payment_amount, payment_status, bank_name, projected_received_date, payment_schedule");
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["analytics-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("id, project_id, bill_amount, amount_paid, balance, installer_company, category, bill_ref, memo, scheduled_payment_date, scheduled_payment_amount, is_voided");
      if (error) throw error;
      return data;
    },
  });

  const { data: billPayments = [] } = useQuery({
    queryKey: ["analytics-bill-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_payments")
        .select("id, bill_id, payment_amount, payment_date, payment_method");
      if (error) throw error;
      return data;
    },
  });

  const { data: commissionPayments = [] } = useQuery({
    queryKey: ["analytics-commission-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_payments")
        .select("id, project_id, salesperson_name, payment_amount, payment_date, payment_method");
      if (error) throw error;
      return data;
    },
  });

  // Get unique salespeople
  const allSalespeople = useMemo(() => {
    const salesSet = new Set<string>();
    projects.forEach(p => {
      if (p.primary_salesperson) salesSet.add(p.primary_salesperson);
      if (p.secondary_salesperson) salesSet.add(p.secondary_salesperson);
      if (p.tertiary_salesperson) salesSet.add(p.tertiary_salesperson);
      if (p.quaternary_salesperson) salesSet.add(p.quaternary_salesperson);
    });
    return Array.from(salesSet).sort();
  }, [projects]);

  // Filter projects based on filters
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // Date filter - based on agreement_signed_date or created_at
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const projectDate = new Date(project.agreement_signed_date || project.created_at);
        if (projectDate < filters.dateRange.from || projectDate > filters.dateRange.to) {
          return false;
        }
      }

      // Project filter
      if (filters.selectedProjects.length > 0) {
        if (!filters.selectedProjects.includes(project.id)) {
          return false;
        }
      }

      // Salesperson filter
      if (filters.selectedSalespeople.length > 0) {
        const projectSalespeople = [
          project.primary_salesperson,
          project.secondary_salesperson,
          project.tertiary_salesperson,
          project.quaternary_salesperson,
        ].filter(Boolean);
        
        if (!projectSalespeople.some(sp => filters.selectedSalespeople.includes(sp!))) {
          return false;
        }
      }

      return true;
    });
  }, [projects, filters]);

  // Calculate financials for filtered projects
  const projectsWithFinancials: ProjectWithFinancials[] = useMemo(() => {
    return filteredProjects.map(project => {
      const projectAgreements = agreements.filter(a => a.project_id === project.id);
      const projectInvoices = invoices.filter(i => i.project_id === project.id);
      const projectPayments = payments.filter(p => p.project_id === project.id);
      const projectBills = bills.filter(b => b.project_id === project.id);

      const contractsTotal = projectAgreements.reduce((sum, a) => sum + (a.total_price || 0), 0);
      const totalBillsReceived = projectBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
      const totalBillsPaid = projectBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
      const invoicesTotal = projectInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
      const invoicesCollected = projectPayments
        .filter(p => p.payment_status === "Received")
        .reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      const invoiceBalanceDue = projectInvoices.reduce((sum, i) => sum + (i.open_balance || 0), 0);

      // Calculate bill payments from bill_payments table
      const projectBillIds = projectBills.map(b => b.id);
      const totalBillPayments = billPayments
        .filter(bp => projectBillIds.includes(bp.bill_id))
        .reduce((sum, bp) => sum + (bp.payment_amount || 0), 0);

      const leadCostPercent = project.lead_cost_percent ?? 18;
      const commissionSplitPct = project.commission_split_pct ?? 50;
      const leadCostAmount = contractsTotal * (leadCostPercent / 100);
      
      // Get estimated project cost - if null, default to 50% of estimated_cost (from dispatch)
      const estimatedProjectCostRaw = project.estimated_project_cost;
      const effectiveEstimatedCost = estimatedProjectCostRaw !== null 
        ? estimatedProjectCostRaw 
        : (project.estimated_cost ? project.estimated_cost * 0.5 : 0);
      
      // Check if actual costs (bills) exceed estimated project costs
      const exceededExpectedCosts = effectiveEstimatedCost > 0 && totalBillsReceived > effectiveEstimatedCost;
      
      // For completed projects, use only real bills - no estimates
      // For other projects, use max of actual bills or estimated project costs
      const isCompleted = project.project_status === 'Completed';
      const costForProfit = isCompleted ? totalBillsReceived : Math.max(totalBillsReceived, effectiveEstimatedCost);
      const grossProfit = contractsTotal - costForProfit;

      // Commission is calculated on: (Total Sold - Lead Fee - Max(Bills, Est)) * commission split
      const commissionBase = contractsTotal - leadCostAmount - costForProfit;
      const totalCommission = commissionBase > 0 ? commissionBase * (commissionSplitPct / 100) : 0;

      // Company Net Profit = Total Sold - Max(Bills, Est) - Commission
      const expectedNetProfit = grossProfit - totalCommission;
      const cashPosition = invoicesCollected - totalBillPayments;

      // Determine cash status
      let cashStatus: 'positive' | 'low' | 'negative' | 'overdue' = 'positive';
      if (cashPosition < 0) {
        cashStatus = 'negative';
      } else if (invoicesCollected < contractsTotal * 0.2 && contractsTotal > 0) {
        cashStatus = 'low';
      }
      // Check for overdue invoices (>30 days)
      const hasOverdue = projectInvoices.some(inv => {
        if (!inv.invoice_date || (inv.open_balance || 0) <= 0) return false;
        const daysDiff = Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 30;
      });
      if (hasOverdue) cashStatus = 'overdue';

      return {
        id: project.id,
        project_number: project.project_number,
        project_name: project.project_name,
        project_status: project.project_status,
        project_address: project.project_address,
        primary_salesperson: project.primary_salesperson,
        secondary_salesperson: project.secondary_salesperson,
        tertiary_salesperson: project.tertiary_salesperson,
        quaternary_salesperson: project.quaternary_salesperson,
        project_manager: project.project_manager,
        estimated_cost: project.estimated_cost,
        estimated_project_cost: project.estimated_project_cost,
        effectiveEstimatedCost,
        exceededExpectedCosts,
        lead_cost_percent: project.lead_cost_percent,
        commission_split_pct: project.commission_split_pct,
        agreement_signed_date: project.agreement_signed_date,
        created_at: project.created_at,
        contractsTotal,
        totalBillsReceived,
        totalBillsPaid,
        invoicesTotal,
        invoicesCollected,
        invoiceBalanceDue,
        leadCostAmount,
        grossProfit,
        totalCommission,
        expectedNetProfit,
        cashPosition,
        hasMissingContract: projectAgreements.length === 0,
        cashStatus,
      };
    });
  }, [filteredProjects, agreements, invoices, payments, bills, billPayments]);

  // Invoices with aging - filtered
  const invoicesWithAging: InvoiceWithAging[] = useMemo(() => {
    const filteredProjectIds = new Set(filteredProjects.map(p => p.id));
    
    return invoices
      .filter(inv => inv.project_id && filteredProjectIds.has(inv.project_id) && (inv.open_balance || 0) > 0)
      .map(inv => {
        const project = projects.find(p => p.id === inv.project_id);
        const daysOutstanding = inv.invoice_date 
          ? Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        let agingBucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
        if (daysOutstanding > 90) agingBucket = '90+';
        else if (daysOutstanding > 60) agingBucket = '61-90';
        else if (daysOutstanding > 30) agingBucket = '31-60';

        const paymentPhase = inv.payment_phase as { phase_name: string; description: string } | null;

        return {
          id: inv.id,
          project_id: inv.project_id,
          project_name: project?.project_name || 'Unknown',
          project_number: project?.project_number || 0,
          project_address: project?.project_address || null,
          primary_salesperson: project?.primary_salesperson || null,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          amount: inv.amount,
          payments_received: inv.payments_received,
          open_balance: inv.open_balance,
          daysOutstanding,
          agingBucket,
          phase_description: paymentPhase?.description || paymentPhase?.phase_name || null,
        };
      })
      .sort((a, b) => b.daysOutstanding - a.daysOutstanding);
  }, [invoices, filteredProjects, projects]);

  // Bank transactions - combined payments in and out
  const bankTransactions: BankTransaction[] = useMemo(() => {
    const filteredProjectIds = new Set(filteredProjects.map(p => p.id));
    const transactions: BankTransaction[] = [];

    // Incoming payments
    payments
      .filter(p => p.project_id && filteredProjectIds.has(p.project_id) && p.payment_status === "Received")
      .forEach(p => {
        const project = projects.find(proj => proj.id === p.project_id);
        transactions.push({
          id: `payment-${p.id}`,
          date: p.projected_received_date,
          type: 'in',
          project_id: p.project_id,
          project_name: project?.project_name || 'Unknown',
          project_address: project?.project_address || null,
          description: p.payment_schedule || 'Payment received',
          amount: p.payment_amount || 0,
          bank_or_method: p.bank_name,
        });
      });

    // Outgoing bill payments
    billPayments.forEach(bp => {
      const bill = bills.find(b => b.id === bp.bill_id);
      if (!bill?.project_id || !filteredProjectIds.has(bill.project_id)) return;
      
      const project = projects.find(p => p.id === bill.project_id);
      transactions.push({
        id: `billpayment-${bp.id}`,
        date: bp.payment_date,
        type: 'out',
        project_id: bill.project_id,
        project_name: project?.project_name || 'Unknown',
        project_address: project?.project_address || null,
        description: bill.category && bill.memo 
          ? `${bill.category} - ${bill.memo}` 
          : (bill.category || bill.memo || '-'),
        amount: bp.payment_amount || 0,
        bank_or_method: bp.payment_method,
        vendor_name: bill.installer_company || null,
        vendor_type: bill.category || null,
      });
    });

    return transactions.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [payments, billPayments, bills, filteredProjects, projects]);

  // Commission summary by salesperson
  const commissionSummary: SalespersonCommission[] = useMemo(() => {
    const filteredProjectIds = new Set(filteredProjects.map(p => p.id));
    const summary: Record<string, SalespersonCommission> = {};

    // Calculate commission for each salesperson from projects
    projectsWithFinancials.forEach(project => {
      const salespeople = [
        { name: project.primary_salesperson, pct: 100 }, // Simplified - should use actual commission pct
      ].filter(s => s.name);

      salespeople.forEach(sp => {
        if (!sp.name) return;
        if (!summary[sp.name]) {
          summary[sp.name] = { name: sp.name, calculated: 0, paid: 0, balance: 0, projectCount: 0 };
        }
        // For simplicity, attribute full commission to primary - in reality should split
        summary[sp.name].calculated += project.totalCommission;
        summary[sp.name].projectCount += 1;
      });
    });

    // Add paid amounts from commission_payments
    commissionPayments
      .filter(cp => cp.project_id && filteredProjectIds.has(cp.project_id))
      .forEach(cp => {
        if (!summary[cp.salesperson_name]) {
          summary[cp.salesperson_name] = { name: cp.salesperson_name, calculated: 0, paid: 0, balance: 0, projectCount: 0 };
        }
        summary[cp.salesperson_name].paid += cp.payment_amount || 0;
      });

    // Calculate balances
    Object.values(summary).forEach(sp => {
      sp.balance = sp.calculated - sp.paid;
    });

    return Object.values(summary).sort((a, b) => b.calculated - a.calculated);
  }, [projectsWithFinancials, commissionPayments, filteredProjects]);

  // Aggregate metrics
  const totals = useMemo(() => {
    const totalRevenue = projectsWithFinancials.reduce((sum, p) => sum + p.contractsTotal, 0);
    const totalCosts = projectsWithFinancials.reduce((sum, p) => sum + p.totalBillsReceived, 0);
    const totalLeadCost = projectsWithFinancials.reduce((sum, p) => sum + p.leadCostAmount, 0);
    const totalGrossProfit = projectsWithFinancials.reduce((sum, p) => sum + p.grossProfit, 0);
    const totalCommission = projectsWithFinancials.reduce((sum, p) => sum + p.totalCommission, 0);
    const totalNetProfit = projectsWithFinancials.reduce((sum, p) => sum + p.expectedNetProfit, 0);
    const profitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    const totalInvoiced = projectsWithFinancials.reduce((sum, p) => sum + p.invoicesTotal, 0);
    const totalCollected = projectsWithFinancials.reduce((sum, p) => sum + p.invoicesCollected, 0);
    const totalReceivables = projectsWithFinancials.reduce((sum, p) => sum + p.invoiceBalanceDue, 0);
    
    const totalBillsPaid = projectsWithFinancials.reduce((sum, p) => sum + p.totalBillsPaid, 0);
    const totalPayables = totalCosts - totalBillsPaid;
    
    const cashPosition = totalCollected - totalBillsPaid;

    const commissionPaid = commissionSummary.reduce((sum, s) => sum + s.paid, 0);
    const commissionBalance = totalCommission - commissionPaid;

    // Aging buckets
    const aging = {
      current: invoicesWithAging.filter(i => i.agingBucket === '0-30').reduce((s, i) => s + (i.open_balance || 0), 0),
      days31_60: invoicesWithAging.filter(i => i.agingBucket === '31-60').reduce((s, i) => s + (i.open_balance || 0), 0),
      days61_90: invoicesWithAging.filter(i => i.agingBucket === '61-90').reduce((s, i) => s + (i.open_balance || 0), 0),
      days90Plus: invoicesWithAging.filter(i => i.agingBucket === '90+').reduce((s, i) => s + (i.open_balance || 0), 0),
    };

    return {
      totalRevenue,
      totalCosts,
      totalLeadCost,
      totalGrossProfit,
      totalCommission,
      totalNetProfit,
      profitMargin,
      totalInvoiced,
      totalCollected,
      totalReceivables,
      totalBillsPaid,
      totalPayables,
      cashPosition,
      commissionPaid,
      commissionBalance,
      aging,
      projectCount: projectsWithFinancials.length,
    };
  }, [projectsWithFinancials, commissionSummary, invoicesWithAging]);

  // Payables with cash impact calculations
  const payablesWithCashImpact: PayableWithCashImpact[] = useMemo(() => {
    const activeBills = bills.filter(b => !b.is_voided && (b.balance || 0) > 0);
    
    return activeBills.map(bill => {
      const project = projectsWithFinancials.find(p => p.id === bill.project_id);
      const projectBills = activeBills.filter(b => b.project_id === bill.project_id);
      const totalProjectPayables = projectBills.reduce((sum, b) => sum + (b.balance || 0), 0);
      const projectCurrentCash = project?.cashPosition || 0;
      
      return {
        id: bill.id,
        project_id: bill.project_id || '',
        project_number: project?.project_number || 0,
        project_name: project?.project_name || 'Unknown',
        project_address: project?.project_address || null,
        vendor: bill.installer_company,
        bill_ref: bill.bill_ref,
        category: bill.category,
        amount_due: bill.balance || 0,
        scheduled_payment_date: bill.scheduled_payment_date,
        scheduled_payment_amount: bill.scheduled_payment_amount,
        project_current_cash: projectCurrentCash,
        cash_if_this_paid: projectCurrentCash - (bill.balance || 0),
        total_project_payables: totalProjectPayables,
        cash_if_all_project_payables_paid: projectCurrentCash - totalProjectPayables,
      };
    }).filter(p => p.project_id);
  }, [bills, projectsWithFinancials]);

  // Scheduled payments
  const scheduledPayments = useMemo(() => {
    return payablesWithCashImpact.filter(p => p.scheduled_payment_date);
  }, [payablesWithCashImpact]);

  // Cash flow timeline (90-day projection)
  const cashFlowTimeline: CashFlowTimelinePoint[] = useMemo(() => {
    const timeline: CashFlowTimelinePoint[] = [];
    const today = new Date();
    let runningCash = totals.cashPosition;

    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Find scheduled outflows for this date
      const outflows = scheduledPayments.filter(p => p.scheduled_payment_date === dateStr);
      const totalOutflow = outflows.reduce((sum, p) => sum + (p.scheduled_payment_amount || p.amount_due), 0);

      // Find expected inflows (pending payments with projected_received_date)
      const inflows = payments
        .filter(p => p.payment_status === 'Pending' && p.projected_received_date === dateStr)
        .map(p => {
          const project = projects.find(proj => proj.id === p.project_id);
          return { ...p, project };
        });
      const totalInflow = inflows.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

      runningCash = runningCash + totalInflow - totalOutflow;

      const details: CashFlowTimelinePoint['details'] = [];
      inflows.forEach(p => {
        details.push({
          type: 'inflow',
          description: p.payment_schedule || 'Payment',
          amount: p.payment_amount || 0,
          project_number: p.project?.project_number || 0,
        });
      });
      outflows.forEach(p => {
        details.push({
          type: 'outflow',
          description: `${p.vendor || 'Vendor'} - ${p.bill_ref || 'Bill'}`,
          amount: p.scheduled_payment_amount || p.amount_due,
          project_number: p.project_number,
        });
      });

      timeline.push({
        date: dateStr,
        cashPosition: runningCash,
        inflows: totalInflow,
        outflows: totalOutflow,
        cumulativeInflows: timeline.length > 0 ? (timeline[timeline.length - 1].cumulativeInflows + totalInflow) : totalInflow,
        cumulativeOutflows: timeline.length > 0 ? (timeline[timeline.length - 1].cumulativeOutflows + totalOutflow) : totalOutflow,
        details,
      });
    }

    return timeline;
  }, [totals.cashPosition, scheduledPayments, payments, projects]);

  return {
    isLoading: loadingProjects,
    projects: projectsWithFinancials,
    allProjects: projects,
    allSalespeople,
    invoicesWithAging,
    bankTransactions,
    commissionSummary,
    commissionPayments: commissionPayments.filter(cp => 
      cp.project_id && new Set(filteredProjects.map(p => p.id)).has(cp.project_id)
    ),
    totals,
    filters,
    payablesWithCashImpact,
    scheduledPayments,
    cashFlowTimeline,
  };
}
