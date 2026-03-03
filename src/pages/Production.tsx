import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { parseISO, isWithinInterval, startOfDay, endOfDay, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnifiedMode } from "@/hooks/useUnifiedMode";
import { logAudit } from "@/hooks/useAuditLog";
import { formatCurrency, cn } from "@/lib/utils";
import { fetchAllPages } from "@/lib/supabasePagination";
import { 
  Search, 
  Plus, 
  Filter,
  FlaskConical,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Upload,
  Archive,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Mail,
  ChevronRight,
  Merge,
  Columns3,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BadgePill } from "@/components/ui/badge-pill";
import { DataListCard, DataListCardHeader, DataListCardBody } from "@/components/ui/data-list-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ProjectDetailSheet } from "@/components/production/ProjectDetailSheet";
import { NewProjectDialog } from "@/components/production/NewProjectDialog";
import { AnalyticsSection } from "@/components/production/AnalyticsSection";
import { MissingProjectsSection } from "@/components/production/MissingProjectsSection";
import { SubcontractorsManagement } from "@/components/production/SubcontractorsManagement";
import { SalespeopleManagement } from "@/components/admin/SalespeopleManagement";
import { ScopeSubmissionsManagement } from "@/components/production/ScopeSubmissionsManagement";
import { WarningsDialog } from "@/components/production/WarningsDialog";
import { ProjectImportDialog } from "@/components/production/ProjectImportDialog";
import { AdminKPIFilters, PROJECT_STATUSES } from "@/components/production/AdminKPIFilters";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { CashFlowChart } from "@/components/production/CashFlowChart";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FinancialSearchResultsSheet } from "@/components/production/FinancialSearchResultsSheet";
import { PendingDepositsSheet } from "@/components/production/PendingDepositsSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MergeProjectsDialog } from "@/components/production/MergeProjectsDialog";
import { useProductionFilters, type ColumnKey } from "@/stores/useProductionFilters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";


interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  project_type: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  cell_phone: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  project_manager: string | null;
  estimated_cost: number | null;
  total_pl: number | null;
  created_at: string;
  updated_at: string | null;
  opportunity_id: string | null;
  location_id: string;
  legacy_project_number: string | null;
  deleted_at: string | null;
  agreement_signed_date: string | null;
  install_start_date: string | null;
  completion_date: string | null;
  company_id: string | null;
}

interface ProjectFinancials {
  projectId: string;
  totalBillsReceived: number;
  totalBillsPaid: number;
  totalBillPayments: number;
  totalInvoiced: number;
  invoicesCollected: number;
  invoiceBalanceDue: number;
  contractsTotal: number;
  contractTypeTotal: number;
  upsellsTotal: number;
  phasesTotal: number;
  hasPhaseMismatch: boolean;
  hasContractMismatch: boolean;
  hasMissingContract: boolean;
  hasMissingPhases: boolean;
  estimatedCost: number | null;
  estimatedProjectCost: number | null;
  effectiveEstimatedCost: number;
  displayCost: number; // For completed projects: actual bills; for others: max(bills, estimated)
  isCompleted: boolean;
  exceededExpectedCosts: boolean;
  isEstimatedCost: boolean;
  projectBalanceDue: number;
  profitToDate: number;
  totalCommission: number;
  expectedFinalProfit: number;
  totalCash: number;
  earliestSignedDate: string | null;
}

type SortColumn = 'project_number' | 'address' | 'status' | 'salesperson' | 'project_manager' | 'sold_amount' | 'est_proj_cost' | 'bills_received' | 'bills_paid' | 'inv_collected' | 'inv_balance' | 'proj_balance' | 'commission' | 'expected_profit' | 'total_cash';
type SortDirection = 'asc' | 'desc';

const statusToIntent = (status: string | null | undefined) => {
  switch (status) {
    case "Proposal": return "info" as const;
    case "New Job": return "primary" as const;
    case "In-Progress": return "warning" as const;
    case "On-Hold": return "danger" as const;
    case "Completed": return "success" as const;
    case "Cancelled": return "danger" as const;
    default: return "muted" as const;
  }
};

// Helper component for project sold cards
function ProjectSoldCard({ 
  project, 
  soldAmount,
  signedDate,
  onOpen 
}: { 
  project: Project & { lead_source?: string | null; project_scope_dispatch?: string | null; install_start_date?: string | null }; 
  soldAmount: number;
  signedDate?: string | null;
  onOpen: () => void;
}) {
  return (
    <div
      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium">#{project.project_number} - {project.project_name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {project.project_address || 'No address'}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span>
              <strong>Source:</strong> {project.lead_source || 'Unknown'}
            </span>
            <span>
              <strong>Status:</strong> {project.project_status || 'New Job'}
            </span>
            {signedDate && (
              <span>
                <strong>Signed:</strong> {format(parseISO(signedDate), 'MMM d, yyyy')}
              </span>
            )}
            {project.install_start_date && (
              <span>
                <strong>Start:</strong> {format(parseISO(project.install_start_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {project.project_scope_dispatch && (
            <p className="text-xs text-muted-foreground mt-1 truncate" title={project.project_scope_dispatch}>
              <strong>Scope:</strong> {project.project_scope_dispatch}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary">
            {formatCurrency(soldAmount)}
          </p>
          <BadgePill intent={statusToIntent(project.project_status)}>
            {project.project_status || 'New Job'}
          </BadgePill>
        </div>
      </div>
    </div>
  );
}

export default function Production() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openTab } = useAppTabs();
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const { isAdmin, isSimulating, companyId } = useAuth();
  const { isUnified, companyIds, queryKeySuffix, getCompanyName } = useUnifiedMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'projects';
  const currentTab = searchParams.get('tab');
  const returnToProjectId = searchParams.get('returnToProject');
  const returnToParam = searchParams.get('returnTo');
  const returnToOppId = searchParams.get('oppId');
  const openBillDialog = searchParams.get('openBill') === 'true';
  const autoOpenFinanceDialog = searchParams.get('autoOpen') as 'invoice' | 'payment' | 'bill' | 'change-order' | null;
  
  // Redirect non-admin users away from analytics view if they don't have a specific tab
  // Admin can access full analytics, production users can only access AR/AP tabs directly
  useEffect(() => {
    if (!isAdmin && activeView === 'analytics') {
      // Production users can only access receivables (AR), cashflow (AP), or payables tabs
      const allowedTabs = ['receivables', 'cashflow', 'payables'];
      if (!currentTab || !allowedTabs.includes(currentTab)) {
        // Redirect to projects view
        setSearchParams({ view: 'projects' });
      }
    }
  }, [isAdmin, activeView, currentTab, setSearchParams]);
  
  // Persistent filters from Zustand store
  const {
    searchQuery,
    selectedStatuses,
    sortColumn,
    sortDirection,
    showAlternatingColors,
    showArchived,
    hiddenColumns,
    setSearchQuery,
    setSelectedStatuses,
    setSort,
    setShowAlternatingColors,
    setShowArchived,
    toggleColumn,
  } = useProductionFilters();
  
  const isColumnVisible = (col: ColumnKey) => !hiddenColumns.includes(col);
  
  // selectedProject and detailSheetOpen are now derived from URL
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deleteTestProjectOpen, setDeleteTestProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectHasRecords, setProjectHasRecords] = useState<boolean | null>(null);
  const [checkingRecords, setCheckingRecords] = useState(false);
  const [warningSheetOpen, setWarningSheetOpen] = useState(false);
  const [warningSheetType, setWarningSheetType] = useState<'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | 'missingCompletionDate' | 'overdueChecklists' | null>(null);
  const [pendingBillDialogOpen, setPendingBillDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [projectInitialTab, setProjectInitialTab] = useState<string | undefined>(undefined);
  const [projectInitialFinanceSubTab, setProjectInitialFinanceSubTab] = useState<'bills' | 'history' | undefined>(undefined);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);
  const [returnToAfterProjectClose, setReturnToAfterProjectClose] = useState<'payables' | 'outstandingAR' | null>(null);
  const [reopenPayablesSheet, setReopenPayablesSheet] = useState(false);
  const [reopenARSheet, setReopenARSheet] = useState(false);
  const [profitSheetOpen, setProfitSheetOpen] = useState(false);
  const [profitSheetType, setProfitSheetType] = useState<'expected' | 'realized' | null>(null);
  const [kpiDateRange, setKpiDateRange] = useState<DateRange | undefined>(undefined);
  const [cashFlowSheetOpen, setCashFlowSheetOpen] = useState(false);
  const [totalSoldSheetOpen, setTotalSoldSheetOpen] = useState(false);
  const [totalSoldGroupBy, setTotalSoldGroupBy] = useState<'none' | 'month' | 'salesperson'>('month');
  const [totalSoldFilterSalesperson, setTotalSoldFilterSalesperson] = useState<string | null>(null);
  const [financialSearchSheetOpen, setFinancialSearchSheetOpen] = useState(false);
  const [financialSearchSection, setFinancialSearchSection] = useState<string>('');
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [statusChangeProject, setStatusChangeProject] = useState<Project | null>(null);
  const [statusChangeNewStatus, setStatusChangeNewStatus] = useState<string>("");
  const [pendingDepositsSheetOpen, setPendingDepositsSheetOpen] = useState(false);
  const [mergeProjectsDialogOpen, setMergeProjectsDialogOpen] = useState(false);
  const [emailConfirmProjectId, setEmailConfirmProjectId] = useState<string | null>(null);
  // Helper to apply company filter - uses .in() for unified mode, .eq() otherwise
  const applyCompanyFilter = useCallback((query: any) => {
    if (isUnified && companyIds.length > 1) {
      return query.in("company_id", companyIds);
    }
    return query.eq("company_id", companyId);
  }, [isUnified, companyIds, companyId]);

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects", queryKeySuffix],
    queryFn: async () => {
      return fetchAllPages(async (from, to) => {
        let query = supabase
          .from("projects")
          .select("*, lead_cost_percent, commission_split_pct, primary_commission_pct, secondary_commission_pct, tertiary_commission_pct, quaternary_commission_pct, deleted_at, estimated_project_cost, sold_dispatch_value, legacy_project_number, agreement_signed_date, lead_source")
          .is("deleted_at", null)
          .order("project_number", { ascending: false })
          .range(from, to);
        
        query = applyCompanyFilter(query);
        const { data, error } = await query;
        
        if (error) throw error;
        return data as (Project & { 
          lead_cost_percent: number | null; 
          commission_split_pct: number | null;
          primary_commission_pct: number | null;
          secondary_commission_pct: number | null;
          tertiary_commission_pct: number | null;
          quaternary_commission_pct: number | null;
          deleted_at: string | null;
          estimated_project_cost: number | null;
          sold_dispatch_value: number | null;
          agreement_signed_date: string | null;
          lead_source: string | null;
          project_scope_dispatch: string | null;
          customer_email: string | null;
        })[];
      });
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  // Fetch archived projects (for admins)
  const { data: archivedProjects = [], refetch: refetchArchived } = useQuery({
    queryKey: ["archived-projects", queryKeySuffix],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, lead_cost_percent, commission_split_pct, primary_commission_pct, secondary_commission_pct, tertiary_commission_pct, quaternary_commission_pct, deleted_at, estimated_project_cost, sold_dispatch_value, legacy_project_number")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      
      if (error) throw error;
      return data as (Project & { 
        lead_cost_percent: number | null; 
        commission_split_pct: number | null;
        primary_commission_pct: number | null;
        secondary_commission_pct: number | null;
        tertiary_commission_pct: number | null;
        quaternary_commission_pct: number | null;
        deleted_at: string | null;
        estimated_project_cost: number | null;
        sold_dispatch_value: number | null;
      })[];
    },
    enabled: isAdmin && showArchived && (!!companyId || (isUnified && companyIds.length > 0)),
  });

  // Fetch all financial data for projects
  const { data: allAgreements = [] } = useQuery({
    queryKey: ["all-project-agreements", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_agreements").select("id, project_id, total_price, agreement_type, agreement_number, description_of_work, agreement_signed_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allPhases = [] } = useQuery({
    queryKey: ["all-project-phases", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_payment_phases").select("id, project_id, agreement_id, amount, phase_name, due_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["all-project-invoices", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_invoices").select("id, project_id, amount, payments_received, open_balance, invoice_number, invoice_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["all-project-payments", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_payments").select("id, project_id, payment_amount, payment_status, projected_received_date, is_voided, bank_name, check_number, deposit_verified");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["all-project-bills", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_bills").select("id, project_id, bill_amount, amount_paid, is_voided, installer_company, bill_ref, category");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allBillPayments = [] } = useQuery({
    queryKey: ["all-bill-payments", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("bill_payments").select("id, bill_id, payment_amount, payment_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  const { data: allCommissionPayments = [] } = useQuery({
    queryKey: ["all-commission-payments", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("commission_payments").select("id, project_id, payment_amount, payment_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  // Fetch all checklist items to check for overdue
  const { data: allChecklists = [] } = useQuery({
    queryKey: ["all-project-checklists", queryKeySuffix],
    queryFn: async () => {
      let query = supabase.from("project_checklists").select("id, project_id, item, completed, due_date");
      query = applyCompanyFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId || (isUnified && companyIds.length > 0),
  });

  // Calculate financials for each project
  const projectFinancials: Record<string, ProjectFinancials> = {};
  
  projects.forEach(project => {
    const projectAgreements = allAgreements.filter(a => a.project_id === project.id);
    const projectPhases = allPhases.filter(p => p.project_id === project.id);
    const projectInvoices = allInvoices.filter(i => i.project_id === project.id);
    const projectPayments = allPayments.filter(p => p.project_id === project.id);
    const projectBills = allBills.filter(b => b.project_id === project.id);

    const totalBillsReceived = projectBills.reduce((sum, b) => sum + (b.bill_amount || 0), 0);
    
    // Calculate actual bill payments from bill_payments table (source of truth)
    const projectBillIds = projectBills.map(b => b.id);
    const totalBillPayments = allBillPayments
      .filter(bp => projectBillIds.includes(bp.bill_id))
      .reduce((sum, bp) => sum + (bp.payment_amount || 0), 0);

    // Use bill_payments total for "Bills Paid" to avoid stale/incorrect rollups
    const totalBillsPaid = totalBillPayments;
    
    const totalInvoiced = projectInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const invoicesCollected = projectPayments
      .filter(p => p.payment_status === "Received")
      .reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    const invoiceBalanceDue = projectInvoices.reduce((sum, i) => sum + (i.open_balance || 0), 0);
    const contractsTotal = projectAgreements.reduce((sum, a) => sum + (a.total_price || 0), 0);
    
    // Calculate phases total per agreement and check for mismatch
    let hasPhaseMismatch = false;
    let hasMissingPhases = false;
    
    // Check if any agreement is missing phases
    projectAgreements.forEach(agreement => {
      const agreementPhases = projectPhases.filter(p => p.agreement_id === agreement.id);
      if (agreementPhases.length === 0) {
        // Agreement exists but no phases entered
        hasMissingPhases = true;
      } else {
        const phasesTotal = agreementPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (phasesTotal !== (agreement.total_price || 0)) {
          hasPhaseMismatch = true;
        }
      }
    });

    // Flag if there are no contracts at all (missing contract)
    const hasMissingContract = projectAgreements.length === 0;

    // Check if "Contract" type agreements total matches sold_dispatch_value (ignore change orders)
    const contractTypeTotal = projectAgreements
      .filter(a => a.agreement_type === 'Contract')
      .reduce((sum, a) => sum + (a.total_price || 0), 0);
    const soldDispatchValue = project.sold_dispatch_value ?? 0;
    const hasContractMismatch = soldDispatchValue > 0 && 
      contractTypeTotal > 0 &&
      contractTypeTotal !== soldDispatchValue;

    // Calculate upsells (change orders) = total contracts - original contract type
    const upsellsTotal = contractsTotal - contractTypeTotal;

    const phasesTotal = projectPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const projectBalanceDue = contractsTotal - invoicesCollected;
    const profitToDate = invoicesCollected - totalBillsPaid;
    
    // Get earliest signed date from agreements
    const signedDates = projectAgreements
      .map(a => a.agreement_signed_date)
      .filter((d): d is string => d !== null && d !== undefined)
      .sort();
    const earliestSignedDate = signedDates.length > 0 ? signedDates[0] : null;
    
    // Get estimated project cost - if null, default to 50% of estimated_cost (from dispatch)
    const estimatedProjectCostRaw = project.estimated_project_cost;
    const effectiveEstimatedCost = estimatedProjectCostRaw !== null 
      ? estimatedProjectCostRaw 
      : (project.estimated_cost ? project.estimated_cost * 0.5 : 0);
    
    // Check if actual costs (bills) exceed estimated project costs
    const exceededExpectedCosts = effectiveEstimatedCost > 0 && totalBillsReceived > effectiveEstimatedCost;

    // For completed projects, use only real bills - no estimates
    // For other projects: if bills exceed estimate, use actual bills (exceededExpectedCosts); otherwise use max of actual bills or estimated
    const isCompleted = project.project_status === 'Completed';
    const useActualCosts = isCompleted || exceededExpectedCosts;
    const costForProfit = useActualCosts ? totalBillsReceived : Math.max(totalBillsReceived, effectiveEstimatedCost);

    // Commission per project: (Total Sold - Lead Fee - Max(Bills, Est)) * Commission Split%
    const leadCostPercent = project.lead_cost_percent ?? 18;
    const commissionSplitPct = project.commission_split_pct ?? 50;
    const leadCostAmount = contractsTotal * (leadCostPercent / 100);
    const commissionBase = contractsTotal - leadCostAmount - costForProfit;
    const totalCommission = commissionBase > 0 ? commissionBase * (commissionSplitPct / 100) : 0;
    
    // Company expected profit (matches P&L Net Income): Revenue - COGS - Commission + Lead Fee Income
    const expectedFinalProfit = contractsTotal - costForProfit - totalCommission + leadCostAmount;
    
    // Total Cash = Payments received - Bill payments made
    const totalCash = invoicesCollected - totalBillPayments;

    projectFinancials[project.id] = {
      projectId: project.id,
      totalBillsReceived,
      totalBillsPaid,
      totalBillPayments,
      totalInvoiced,
      invoicesCollected,
      invoiceBalanceDue,
      contractsTotal,
      contractTypeTotal,
      upsellsTotal,
      phasesTotal,
      hasPhaseMismatch,
      hasContractMismatch,
      hasMissingContract,
      hasMissingPhases,
      estimatedCost: project.estimated_cost,
      estimatedProjectCost: project.estimated_project_cost,
      effectiveEstimatedCost,
      displayCost: costForProfit, // For completed: actual bills; for others: max(bills, estimated)
      isCompleted,
      exceededExpectedCosts,
      isEstimatedCost: !useActualCosts && effectiveEstimatedCost > 0 && effectiveEstimatedCost > totalBillsReceived,
      projectBalanceDue,
      profitToDate,
      totalCommission,
      expectedFinalProfit,
      totalCash,
      earliestSignedDate,
    };
  });

  // Derive selected project from URL param
  const selectedProject = useMemo(() => {
    if (!urlProjectId || !projects.length) return null;
    return projects.find(p => p.id === urlProjectId) || null;
  }, [urlProjectId, projects]);

  // Modal open state derived from URL
  const detailSheetOpen = !!urlProjectId;

  // Handle legacy openProject URL parameter (redirect to new URL pattern)
  useEffect(() => {
    const openProjectId = searchParams.get('openProject');
    const initialTab = searchParams.get('tab');
    
    if (openProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === openProjectId);
      if (project) {
        setProjectInitialTab(initialTab || undefined);
        // Navigate to new URL pattern instead of setting local state
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openProject');
        newParams.delete('tab');
        navigate(`/production/${openProjectId}${newParams.toString() ? `?${newParams.toString()}` : ''}`, { replace: true });
      }
    }
  }, [projects, searchParams, navigate]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column, 'asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Track which financial sections match the search
  const matchedFinancialSections = useMemo(() => {
    const searchNumber = parseFloat(searchQuery.replace(/[,$]/g, ''));
    const isNumberSearch = !isNaN(searchNumber) && searchNumber > 0;
    
    if (!isNumberSearch || searchQuery.trim() === '') {
      return new Set<string>();
    }
    
    const matched = new Set<string>();
    const cleanQuery = searchQuery.replace(/[,$]/g, '');
    
    projects.forEach(project => {
      const financials = projectFinancials[project.id];
      if (!financials) return;
      
      if (financials.totalInvoiced === searchNumber || financials.totalInvoiced.toString().includes(cleanQuery)) {
        matched.add('Invoiced');
      }
      if (financials.invoicesCollected === searchNumber || financials.invoicesCollected.toString().includes(cleanQuery)) {
        matched.add('Payments Received');
      }
      if (financials.phasesTotal === searchNumber || financials.phasesTotal.toString().includes(cleanQuery)) {
        matched.add('Phases');
      }
      if (financials.contractsTotal === searchNumber || financials.contractsTotal.toString().includes(cleanQuery)) {
        matched.add('Contracts');
      }
      if (financials.totalBillsReceived === searchNumber || financials.totalBillsReceived.toString().includes(cleanQuery)) {
        matched.add('Bills Received');
      }
      if (financials.totalBillsPaid === searchNumber || financials.totalBillsPaid.toString().includes(cleanQuery)) {
        matched.add('Bills Paid');
      }
      if (financials.projectBalanceDue === searchNumber) {
        matched.add('Project Balance');
      }
      if (financials.invoiceBalanceDue === searchNumber) {
        matched.add('Invoice Balance');
      }
    });
    
    return matched;
  }, [searchQuery, projects, projectFinancials]);

  // Get matching financial records for the selected section
  const getMatchingFinancialRecords = useCallback((sectionType: string) => {
    const searchNumber = parseFloat(searchQuery.replace(/[,$]/g, ''));
    const cleanQuery = searchQuery.replace(/[,$]/g, '');
    const isNumberSearch = !isNaN(searchNumber) && searchNumber > 0;
    
    if (!isNumberSearch) return [];
    
    const records: { projectId: string; projectNumber: number; projectName: string; amount: number; description?: string; date?: string; reference?: string }[] = [];
    const projectMap = new Map(projects.map(p => [p.id, p]));
    
    switch (sectionType) {
      case 'Invoiced':
        allInvoices.forEach(inv => {
          const project = projectMap.get(inv.project_id);
          if (!project) return;
          const amount = inv.amount || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: `Invoice #${inv.invoice_number || 'N/A'}`,
              date: inv.invoice_date || undefined,
            });
          }
        });
        break;
      case 'Payments Received':
        allPayments.filter(p => !p.is_voided && p.payment_status === 'Received').forEach(payment => {
          const project = projectMap.get(payment.project_id);
          if (!project) return;
          const amount = payment.payment_amount || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: payment.bank_name || 'Payment',
              date: payment.projected_received_date || undefined,
              reference: payment.check_number || undefined,
            });
          }
        });
        break;
      case 'Phases':
        allPhases.forEach(phase => {
          const project = projectMap.get(phase.project_id!);
          if (!project) return;
          const amount = phase.amount || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: phase.phase_name,
              date: phase.due_date || undefined,
            });
          }
        });
        break;
      case 'Contracts':
        allAgreements.forEach(agreement => {
          const project = projectMap.get(agreement.project_id!);
          if (!project) return;
          const amount = agreement.total_price || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: agreement.agreement_type || agreement.description_of_work || 'Contract',
              reference: agreement.agreement_number || undefined,
            });
          }
        });
        break;
      case 'Bills Received':
        allBills.filter(b => !b.is_voided).forEach(bill => {
          const project = projectMap.get(bill.project_id!);
          if (!project) return;
          const amount = bill.bill_amount || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: bill.installer_company || bill.category || 'Bill',
              reference: bill.bill_ref || undefined,
            });
          }
        });
        break;
      case 'Bills Paid':
        allBills.filter(b => !b.is_voided).forEach(bill => {
          const project = projectMap.get(bill.project_id!);
          if (!project) return;
          const amount = bill.amount_paid || 0;
          if (amount === searchNumber || amount.toString().includes(cleanQuery)) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount,
              description: bill.installer_company || bill.category || 'Bill',
              reference: bill.bill_ref || undefined,
            });
          }
        });
        break;
      case 'Project Balance':
        projects.forEach(project => {
          const financials = projectFinancials[project.id];
          if (!financials) return;
          if (financials.projectBalanceDue === searchNumber) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount: financials.projectBalanceDue,
              description: 'Project Balance Due',
            });
          }
        });
        break;
      case 'Invoice Balance':
        projects.forEach(project => {
          const financials = projectFinancials[project.id];
          if (!financials) return;
          if (financials.invoiceBalanceDue === searchNumber) {
            records.push({
              projectId: project.id,
              projectNumber: project.project_number,
              projectName: project.project_name,
              amount: financials.invoiceBalanceDue,
              description: 'Invoice Balance Due',
            });
          }
        });
        break;
    }
    
    return records;
  }, [searchQuery, projects, projectFinancials, allInvoices, allPayments, allPhases, allAgreements, allBills]);

  // Handle navigating to a project from financial search results
  const handleNavigateToProjectFromSearch = useCallback((projectId: string, tab: string, subTab?: string) => {
    setProjectInitialTab(tab);
    if (subTab === 'bills') {
      setProjectInitialFinanceSubTab('bills');
    } else {
      setProjectInitialFinanceSubTab(undefined);
    }
    // Navigate to project URL
    navigate(`/production/${projectId}`);
  }, [navigate]);

  const sortedAndFilteredProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      const financials = projectFinancials[project.id];
      const query = searchQuery.toLowerCase().trim();
      
      // Check if search query is a number (for amount matching)
      const searchNumber = parseFloat(searchQuery.replace(/[,$]/g, ''));
      const isNumberSearch = !isNaN(searchNumber) && searchNumber > 0;
      
      const matchesSearch =
        searchQuery === "" ||
        // Text-based searches
        project.project_name?.toLowerCase().includes(query) ||
        project.project_address?.toLowerCase().includes(query) ||
        project.customer_first_name?.toLowerCase().includes(query) ||
        project.customer_last_name?.toLowerCase().includes(query) ||
        project.primary_salesperson?.toLowerCase().includes(query) ||
        project.project_manager?.toLowerCase().includes(query) ||
        project.project_number?.toString().includes(searchQuery) ||
        // Amount-based searches (when searching for a number)
        (isNumberSearch && financials && (
          financials.totalInvoiced === searchNumber ||
          financials.invoicesCollected === searchNumber ||
          financials.phasesTotal === searchNumber ||
          financials.contractsTotal === searchNumber ||
          financials.totalBillsReceived === searchNumber ||
          financials.totalBillsPaid === searchNumber ||
          financials.projectBalanceDue === searchNumber ||
          financials.invoiceBalanceDue === searchNumber ||
          // Also check if amount contains the search (partial match for larger amounts)
          financials.totalInvoiced.toString().includes(searchQuery.replace(/[,$]/g, '')) ||
          financials.invoicesCollected.toString().includes(searchQuery.replace(/[,$]/g, '')) ||
          financials.phasesTotal.toString().includes(searchQuery.replace(/[,$]/g, '')) ||
          financials.contractsTotal.toString().includes(searchQuery.replace(/[,$]/g, '')) ||
          financials.totalBillsReceived.toString().includes(searchQuery.replace(/[,$]/g, '')) ||
          financials.totalBillsPaid.toString().includes(searchQuery.replace(/[,$]/g, ''))
        ));

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(project.project_status || '');

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const financialsA = projectFinancials[a.id];
      const financialsB = projectFinancials[b.id];
      let comparison = 0;

      switch (sortColumn) {
        case 'project_number':
          comparison = a.project_number - b.project_number;
          break;
        case 'address':
          comparison = (a.project_address || a.project_name || '').localeCompare(b.project_address || b.project_name || '');
          break;
        case 'status':
          comparison = (a.project_status || '').localeCompare(b.project_status || '');
          break;
        case 'salesperson':
          comparison = (a.primary_salesperson || '').localeCompare(b.primary_salesperson || '');
          break;
        case 'project_manager':
          comparison = (a.project_manager || '').localeCompare(b.project_manager || '');
          break;
        case 'sold_amount':
          comparison = (financialsA?.contractsTotal || 0) - (financialsB?.contractsTotal || 0);
          break;
        case 'est_proj_cost':
          comparison = (financialsA?.displayCost || 0) - (financialsB?.displayCost || 0);
          break;
        case 'bills_received':
          comparison = (financialsA?.totalBillsReceived || 0) - (financialsB?.totalBillsReceived || 0);
          break;
        case 'bills_paid':
          comparison = (financialsA?.totalBillsPaid || 0) - (financialsB?.totalBillsPaid || 0);
          break;
        case 'inv_collected':
          comparison = (financialsA?.invoicesCollected || 0) - (financialsB?.invoicesCollected || 0);
          break;
        case 'inv_balance':
          comparison = (financialsA?.invoiceBalanceDue || 0) - (financialsB?.invoiceBalanceDue || 0);
          break;
        case 'proj_balance':
          comparison = (financialsA?.projectBalanceDue || 0) - (financialsB?.projectBalanceDue || 0);
          break;
        case 'commission':
          comparison = (financialsA?.totalCommission || 0) - (financialsB?.totalCommission || 0);
          break;
        case 'expected_profit':
          comparison = (financialsA?.expectedFinalProfit || 0) - (financialsB?.expectedFinalProfit || 0);
          break;
        case 'total_cash':
          comparison = (financialsA?.totalCash || 0) - (financialsB?.totalCash || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projects, searchQuery, selectedStatuses, sortColumn, sortDirection, projectFinancials]);

  // Create test project mutation
  const createTestProjectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .insert({
          project_name: "TEST PROJECT - Delete Me",
          project_status: "New Job",
          project_type: "Other",
          location_id: "pVeFrqvtYWNIPRIi0Fmr",
          customer_first_name: "Test",
          customer_last_name: "Customer",
          project_address: "123 Test Street, Test City, CA 90210",
          company_id: companyId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test project created");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => toast.error(`Failed to create test project: ${error.message}`),
  });

  // Check if project has any related records
  const checkProjectHasRecords = async (projectId: string): Promise<boolean> => {
    // Check each table that stores important financial/document data
    const { count: agreementsCount } = await supabase
      .from('project_agreements')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (agreementsCount && agreementsCount > 0) return true;

    const { count: billsCount } = await supabase
      .from('project_bills')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (billsCount && billsCount > 0) return true;

    const { count: paymentsCount } = await supabase
      .from('project_payments')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (paymentsCount && paymentsCount > 0) return true;

    const { count: invoicesCount } = await supabase
      .from('project_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (invoicesCount && invoicesCount > 0) return true;

    const { count: phasesCount } = await supabase
      .from('project_payment_phases')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (phasesCount && phasesCount > 0) return true;

    const { count: documentsCount } = await supabase
      .from('project_documents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (documentsCount && documentsCount > 0) return true;

    const { count: commissionsCount } = await supabase
      .from('project_commissions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (commissionsCount && commissionsCount > 0) return true;

    const { count: notesCount } = await supabase
      .from('project_notes')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (notesCount && notesCount > 0) return true;

    const { count: commPaymentsCount } = await supabase
      .from('commission_payments')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (commPaymentsCount && commPaymentsCount > 0) return true;

    return false;
  };

  // Admin: hard-delete project AND all related records (so the project delete never gets blocked)
  const deleteProjectCascade = async (projectId: string) => {
    // 1. Delete all files from storage first (before database records are removed)
    try {
      // List and delete all files in the project's folder
      const { data: files } = await supabase.storage
        .from('project-attachments')
        .list(projectId);
      
      if (files && files.length > 0) {
        const filePaths = files.map(file => `${projectId}/${file.name}`);
        await supabase.storage.from('project-attachments').remove(filePaths);
      }
      
      // Also check for proposal-docs subfolder
      const { data: proposalFiles } = await supabase.storage
        .from('project-attachments')
        .list(`proposal-docs/${projectId}`);
      
      if (proposalFiles && proposalFiles.length > 0) {
        const proposalPaths = proposalFiles.map(file => `proposal-docs/${projectId}/${file.name}`);
        await supabase.storage.from('project-attachments').remove(proposalPaths);
      }
    } catch (storageError) {
      console.error('Error cleaning up storage files:', storageError);
      // Continue with deletion even if storage cleanup fails
    }

    // Disconnect estimates (set project_id to null instead of deleting)
    {
      const { error } = await supabase
        .from('estimates')
        .update({ project_id: null })
        .eq('project_id', projectId);
      if (error) throw error;
    }

    // bill_payments depend on project_bills
    const { data: bills, error: billsSelError } = await supabase
      .from('project_bills')
      .select('id')
      .eq('project_id', projectId);
    if (billsSelError) throw billsSelError;

    const billIds = (bills ?? []).map((b) => b.id);
    if (billIds.length > 0) {
      const { error } = await supabase.from('bill_payments').delete().in('bill_id', billIds);
      if (error) throw error;
    }

    // project_note_comments depend on project_notes
    const { data: notes, error: notesSelError } = await supabase
      .from('project_notes')
      .select('id')
      .eq('project_id', projectId);
    if (notesSelError) throw notesSelError;

    const noteIds = (notes ?? []).map((n) => n.id);
    if (noteIds.length > 0) {
      const { error } = await supabase.from('project_note_comments').delete().in('note_id', noteIds);
      if (error) throw error;
    }

    // Financial chain
    {
      const { error } = await supabase.from('project_payments').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_invoices').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_payment_phases').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_agreements').delete().eq('project_id', projectId);
      if (error) throw error;
    }

    // Bills (after bill_payments)
    {
      const { error } = await supabase.from('project_bills').delete().eq('project_id', projectId);
      if (error) throw error;
    }

    // Portal-related records
    {
      const { error } = await supabase.from('portal_chat_messages').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('portal_chat_messages_archived').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('portal_view_logs').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('client_comments').delete().eq('project_id', projectId);
      if (error) throw error;
    }

    // Delete estimate_signatures that reference client_portal_tokens for this project
    {
      const { data: tokens, error: tokensSelError } = await supabase
        .from('client_portal_tokens')
        .select('id')
        .eq('project_id', projectId);
      if (tokensSelError) throw tokensSelError;

      const tokenIds = (tokens ?? []).map((t) => t.id);
      if (tokenIds.length > 0) {
        const { error } = await supabase.from('estimate_signatures').delete().in('portal_token_id', tokenIds);
        if (error) throw error;
      }
    }

    {
      const { error } = await supabase.from('client_portal_tokens').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_notification_log').delete().eq('project_id', projectId);
      if (error) throw error;
    }

    // Other related records
    {
      const { error } = await supabase.from('project_documents').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_commissions').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('commission_payments').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_notes').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_checklists').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_messages').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    // project_cases table was dropped (unused feature)
    {
      const { error } = await supabase.from('project_feedback').delete().eq('project_id', projectId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('project_finance').delete().eq('project_id', projectId);
      if (error) throw error;
    }
  };

  // Delete project mutation - soft delete for projects with records, hard delete for empty projects (admin only)
  const deleteProjectMutation = useMutation({
    mutationFn: async ({ project, permanentDelete, isTestProject }: { project: Project; permanentDelete: boolean; isTestProject?: boolean }) => {
      if (permanentDelete) {
        await logAudit({
          tableName: 'projects',
          recordId: project.id,
          action: 'DELETE',
          oldValues: {
            project_number: project.project_number,
            project_name: project.project_name,
            project_status: project.project_status,
            project_address: project.project_address,
            primary_salesperson: project.primary_salesperson,
          },
          description: `Permanently deleted project #${project.project_number} - ${project.project_name} (and all related records)`,
        });

        await deleteProjectCascade(project.id);

        const { error } = await supabase.from("projects").delete().eq("id", project.id);
        if (error) throw error;
      } else {
        // Soft delete (archive) for projects with records
        await logAudit({
          tableName: 'projects',
          recordId: project.id,
          action: 'UPDATE',
          oldValues: { deleted_at: null },
          newValues: { deleted_at: new Date().toISOString() },
          description: `Archived project #${project.project_number} - ${project.project_name}`,
        });

        const { error } = await supabase
          .from("projects")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", project.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { permanentDelete }) => {
      toast.success(permanentDelete ? "Project permanently deleted" : "Project archived");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTestProjectOpen(false);
      setProjectToDelete(null);
      setProjectHasRecords(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Restore archived project mutation
  const restoreProjectMutation = useMutation({
    mutationFn: async (project: Project) => {
      await logAudit({
        tableName: 'projects',
        recordId: project.id,
        action: 'UPDATE',
        oldValues: { deleted_at: project.deleted_at },
        newValues: { deleted_at: null },
        description: `Restored archived project #${project.project_number} - ${project.project_name}`,
      });

      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: null })
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project restored successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
    },
    onError: (error) => toast.error(`Failed to restore: ${error.message}`),
  });

  // Send portal update email mutation
  const sendPortalEmailMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('send-portal-update-email', {
        body: { projectId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send email');
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Email sent to customer!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update project status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectId, oldStatus, newStatus }: { projectId: string; oldStatus: string | null; newStatus: string }) => {
      await logAudit({
        tableName: 'projects',
        recordId: projectId,
        action: 'UPDATE',
        oldValues: { project_status: oldStatus },
        newValues: { project_status: newStatus },
        description: `Changed project status from "${oldStatus || 'New Job'}" to "${newStatus}"`,
      });

      const { error } = await supabase
        .from("projects")
        .update({ project_status: newStatus })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setStatusChangeDialogOpen(false);
      setStatusChangeProject(null);
      setStatusChangeNewStatus("");
    },
    onError: (error) => toast.error(`Failed to update status: ${error.message}`),
  });

  // Helper to check if project is a test project
  const isTestProject = (project: Project): boolean => {
    const name = project.project_name?.toLowerCase() || "";
    return name.includes("test") || name.includes("test project");
  };

  const handleDeleteTestProject = async (project: Project) => {
    setProjectToDelete(project);
    setProjectHasRecords(null);
    setCheckingRecords(true);
    setDeleteTestProjectOpen(true);
    
    // For test projects, skip the records check - we'll delete everything
    if (isTestProject(project)) {
      setProjectHasRecords(false); // Treat as "no records" to allow permanent delete
      setCheckingRecords(false);
      return;
    }
    
    try {
      const hasRecords = await checkProjectHasRecords(project.id);
      setProjectHasRecords(hasRecords);
    } catch (error) {
      console.error('Error checking project records:', error);
      setProjectHasRecords(true); // Assume has records on error for safety
    } finally {
      setCheckingRecords(false);
    }
  };


  const toTitleCase = (str: string | null | undefined): string => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getCustomerName = (project: Project): string | null => {
    const firstName = project.customer_first_name?.trim();
    const lastName = project.customer_last_name?.trim();
    if (!firstName && !lastName) return null;
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    return toTitleCase(fullName);
  };

  const handleOpenProject = (project: Project, initialTab?: string, returnTo?: 'payables' | 'outstandingAR', financeSubTab?: 'bills' | 'history', highlightInvoiceId?: string, highlightBillId?: string) => {
    setProjectInitialTab(initialTab);
    setProjectInitialFinanceSubTab(financeSubTab);
    setReturnToAfterProjectClose(returnTo || null);
    setHighlightedInvoiceId(highlightInvoiceId || null);
    setHighlightedBillId(highlightBillId || null);
    
    // Build the URL with optional query params
    let url = `/project/${project.id}`;
    const params = new URLSearchParams();
    if (initialTab) params.set('tab', initialTab);
    if (financeSubTab) params.set('financeTab', financeSubTab);
    if (highlightInvoiceId) params.set('highlightInvoice', highlightInvoiceId);
    if (highlightBillId) params.set('highlightBill', highlightBillId);
    if (params.toString()) url += `?${params.toString()}`;
    
    // Open in a new tab using the full-page route
    const customerName = [project.customer_first_name, project.customer_last_name].filter(Boolean).join(' ').trim();
    const title = customerName 
      ? `Project ${project.project_number} (${customerName})`
      : `Project ${project.project_number}`;
    openTab(url, title);
  };

  // Helper to get the best available date for a project (for filtering)
  const getProjectFilterDate = useCallback((project: typeof projects[0]): string | null => {
    // Priority: earliestSignedDate from agreements > install_start_date > created_at
    const financials = projectFinancials[project.id];
    return financials?.earliestSignedDate || project.install_start_date || project.created_at;
  }, [projectFinancials]);

  // Helper to check if a date falls within the KPI filter range
  const isWithinKpiRange = useCallback((dateStr: string | null): boolean => {
    if (!dateStr) return false; // No date means not in range
    if (!kpiDateRange?.from || !kpiDateRange?.to) return true; // No filter set
    try {
      const date = parseISO(dateStr);
      return isWithinInterval(date, { 
        start: startOfDay(kpiDateRange.from), 
        end: endOfDay(kpiDateRange.to) 
      });
    } catch {
      return false;
    }
  }, [kpiDateRange]);

  // Calculate KPIs based on status filter AND date range
  const filteredByStatus = useMemo(() => {
    let filtered = projects;
    
    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => selectedStatuses.includes(p.project_status || ''));
    }
    
    // Apply date range filter (using best available date: agreement_signed_date > install_start_date > created_at)
    if (kpiDateRange?.from && kpiDateRange?.to) {
      filtered = filtered.filter(p => {
        const dateToUse = getProjectFilterDate(p);
        return isWithinKpiRange(dateToUse);
      });
    }
    
    return filtered;
  }, [projects, selectedStatuses, kpiDateRange, isWithinKpiRange, getProjectFilterDate]);

  const totalProjects = filteredByStatus.length;
  const inProgressProjects = filteredByStatus.filter(p => p.project_status === "In-Progress").length;
  const completedProjects = filteredByStatus.filter(p => p.project_status === "Completed").length;
  const totalEstimatedCost = filteredByStatus.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  // Calculate filtered financials for KPIs
  const filteredFinancialsTotal = useMemo(() => {
    return filteredByStatus.reduce((sum, p) => sum + (projectFinancials[p.id]?.contractsTotal || 0), 0);
  }, [filteredByStatus, projectFinancials]);

  // Calculate profit KPIs (admin only) - uses filteredByStatus which already respects date filter
  const profitKPIs = useMemo(() => {
    let expectedProfit = 0;
    let realizedProfit = 0;
    const expectedProfitProjects: string[] = [];
    const realizedProfitProjects: string[] = [];

    filteredByStatus.forEach((p) => {
      const financials = projectFinancials[p.id];
      if (!financials || financials.contractsTotal === 0) return;
      
      const profit = financials.expectedFinalProfit || 0;
      
      if (p.project_status === 'Completed') {
        realizedProfit += profit;
        realizedProfitProjects.push(p.id);
      } else {
        expectedProfit += profit;
        expectedProfitProjects.push(p.id);
      }
    });

    return { expectedProfit, realizedProfit, expectedProfitProjects, realizedProfitProjects };
  }, [filteredByStatus, projectFinancials]);

  // Calculate cash flow KPI (admin only) - respects date filter
  const cashFlowKPI = useMemo(() => {
    // Get invoice payments with dates (only received payments)
    const invoicePaymentsData = allPayments
      .filter(p => p.payment_status === 'Received' && !p.is_voided)
      .map(p => ({
        date: p.projected_received_date,
        amount: p.payment_amount || 0,
      }));

    // Get bill payments with dates
    const billPaymentsData = allBillPayments.map(p => ({
      date: p.payment_date,
      amount: p.payment_amount || 0,
    }));

    // Get commission payments with dates
    const commissionPaymentsData = allCommissionPayments.map(p => ({
      date: p.payment_date,
      amount: p.payment_amount || 0,
    }));

    // Calculate totals within date range
    let invoicesReceived = 0;
    let billsPaid = 0;
    let commissionsPaid = 0;

    invoicePaymentsData.forEach(p => {
      if (isWithinKpiRange(p.date)) {
        invoicesReceived += p.amount;
      }
    });

    billPaymentsData.forEach(p => {
      if (isWithinKpiRange(p.date)) {
        billsPaid += p.amount;
      }
    });

    commissionPaymentsData.forEach(p => {
      if (isWithinKpiRange(p.date)) {
        commissionsPaid += p.amount;
      }
    });

    const netCashFlow = invoicesReceived - billsPaid - commissionsPaid;

    return {
      invoicesReceived,
      billsPaid,
      commissionsPaid,
      netCashFlow,
      invoicePaymentsData,
      billPaymentsData,
      commissionPaymentsData,
    };
  }, [allPayments, allBillPayments, allCommissionPayments, isWithinKpiRange]);

  // Statuses to exclude from financial/bookkeeping warnings
  const EXCLUDED_WARNING_STATUSES = ['Proposal', 'Pre-Estimate', 'Estimate'];

  // Calculate warning counts
  const warningCounts = useMemo(() => {
    const counts = {
      missingContract: 0,
      missingPhases: 0,
      phaseMismatch: 0,
      contractMismatch: 0,
    };
    
    // Only count warnings for non-excluded status and non-archived projects
    const activeProjectIds = new Set(
      projects.filter(p => !EXCLUDED_WARNING_STATUSES.includes(p.project_status || '') && !p.deleted_at).map(p => p.id)
    );
    
    Object.entries(projectFinancials).forEach(([projectId, f]) => {
      if (!activeProjectIds.has(projectId)) return;
      if (f.hasMissingContract) counts.missingContract++;
      if (f.hasMissingPhases) counts.missingPhases++;
      if (f.hasPhaseMismatch) counts.phaseMismatch++;
      if (f.hasContractMismatch) counts.contractMismatch++;
    });
    
    return counts;
  }, [projectFinancials, projects]);

  // Calculate bookkeeping warning counts
  const bookkeepingWarningCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const counts = {
      missingSalesperson: 0,
      missingCompletionDate: 0,
      overdueChecklists: 0,
      pendingDeposits: 0,
    };
    
    // Exclude early-stage statuses and archived projects from bookkeeping warnings
    const activeProjects = projects.filter(p => !EXCLUDED_WARNING_STATUSES.includes(p.project_status || '') && !p.deleted_at);
    
    activeProjects.forEach((p) => {
      if (!p.primary_salesperson || p.primary_salesperson.trim() === '') {
        counts.missingSalesperson++;
      }
      // Completed projects missing completion_date
      if (p.project_status === 'Completed' && !p.completion_date) {
        counts.missingCompletionDate++;
      }
    });
    
    // Count projects with overdue checklists
    const projectsWithOverdue = new Set<string>();
    allChecklists.forEach((item) => {
      if (item.due_date && !item.completed) {
        const dueDate = new Date(item.due_date);
        if (dueDate < today) {
          projectsWithOverdue.add(item.project_id);
        }
      }
    });
    counts.overdueChecklists = projectsWithOverdue.size;
    
    // Count payments received but not yet deposit-verified
    counts.pendingDeposits = allPayments.filter(p => 
      p.payment_status === 'Received' && 
      !p.is_voided && 
      (p.deposit_verified === null || p.deposit_verified === false)
    ).length;
    
    return counts;
  }, [projects, allChecklists, allPayments]);

  const totalWarnings = warningCounts.missingContract + warningCounts.missingPhases + warningCounts.phaseMismatch + warningCounts.contractMismatch;
  const totalBookkeepingWarnings = bookkeepingWarningCounts.missingSalesperson + bookkeepingWarningCounts.missingCompletionDate + bookkeepingWarningCounts.overdueChecklists + bookkeepingWarningCounts.pendingDeposits;

  // Get projects with specific warning type
  const getWarningProjects = useCallback((type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | 'missingCompletionDate' | 'overdueChecklists') => {
    if (type === 'overdueChecklists') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const projectsWithOverdue = new Set<string>();
      allChecklists.forEach((item) => {
        if (item.due_date && !item.completed) {
          const dueDate = new Date(item.due_date);
          if (dueDate < today) {
            projectsWithOverdue.add(item.project_id);
          }
        }
      });
      return projects.filter(p => !EXCLUDED_WARNING_STATUSES.includes(p.project_status || '') && !p.deleted_at && projectsWithOverdue.has(p.id));
    }
    
    // Exclude early-stage statuses and archived projects from all warnings
    return projects.filter(p => {
      if (EXCLUDED_WARNING_STATUSES.includes(p.project_status || '') || p.deleted_at) return false;
      const f = projectFinancials[p.id];
      switch (type) {
        case 'missingContract': return f?.hasMissingContract;
        case 'missingPhases': return f?.hasMissingPhases;
        case 'phaseMismatch': return f?.hasPhaseMismatch;
        case 'contractMismatch': return f?.hasContractMismatch;
        case 'missingSalesperson': return !p.primary_salesperson || p.primary_salesperson.trim() === '';
        case 'missingCompletionDate': return p.project_status === 'Completed' && !p.completion_date;
      }
    });
  }, [projects, projectFinancials, allChecklists]);

  const handleOpenWarningSheet = (type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | 'missingCompletionDate' | 'overdueChecklists') => {
    setWarningSheetType(type);
    setWarningSheetOpen(true);
  };

  const warningSheetTitle: Record<string, string> = {
    missingContract: 'Missing Contract',
    missingPhases: 'Missing Progress Payments',
    phaseMismatch: 'Progress Payment Amount Mismatch',
    contractMismatch: 'Contract Mismatch Dispatch Reported $ Sold',
    missingSalesperson: 'Missing Salesperson',
    missingCompletionDate: 'Missing Completion Date',
  };

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'audit':
        navigate('/audit-log');
        break;
    }
  };

  return (
    <AppLayout 
      showNotifications={false}
      onAdminAction={(isAdmin || isSimulating) ? handleAdminAction : undefined}
    >
      <TooltipProvider>
        <div className="py-2 px-4 lg:px-6 space-y-3">
          {activeView === 'projects' && (
            <div className="space-y-4">
              {/* Page Header: Title + KPI stats + Actions */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">Operations</h2>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground">{totalProjects}</span> Projects</span>
                    <span className="text-border">•</span>
                    <span><span className="font-medium text-foreground">{inProgressProjects}</span> In Progress</span>
                    <span className="text-border">•</span>
                    <span>Sold <span className="font-medium text-foreground">{formatCurrency(filteredFinancialsTotal)}</span></span>
                    {isAdmin && (
                      <>
                        <span className="text-border">•</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dotted border-muted-foreground/40">Profit <span className={`font-medium ${(profitKPIs.expectedProfit + profitKPIs.realizedProfit) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {formatCurrency(profitKPIs.expectedProfit + profitKPIs.realizedProfit)}
                            </span></span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1 p-3">
                            <p className="font-semibold mb-1">Profit Formula</p>
                            <p>Revenue − COGS − Commission + Lead Fee</p>
                            <p className="text-muted-foreground mt-1">COGS = Max(Bills Received, Estimated Cost)</p>
                            <p className="text-muted-foreground">For completed projects, COGS = actual bills only</p>
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <WarningsDialog
                    warningCounts={warningCounts}
                    bookkeepingWarningCounts={bookkeepingWarningCounts}
                    totalWarnings={totalWarnings}
                    totalBookkeepingWarnings={totalBookkeepingWarnings}
                    onOpenWarningSheet={handleOpenWarningSheet}
                    onOpenPendingDeposits={() => setPendingDepositsSheetOpen(true)}
                  />
                  <Button size="sm" onClick={() => openTab('/project/new', 'Project-New')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => createTestProjectMutation.mutate()}
                          disabled={createTestProjectMutation.isPending}
                        >
                          <FlaskConical className="h-4 w-4 mr-2" />
                          Add Test Project
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => setMergeProjectsDialogOpen(true)}>
                          <Merge className="h-4 w-4 mr-2" />
                          Merge Projects
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Expandable KPI Details */}
              <Collapsible defaultOpen={false}>
                <div className="flex items-center">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 h-7 group">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      <span>KPI Details</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="pt-3 space-y-3">
                  <AdminKPIFilters
                    dateRange={kpiDateRange}
                    onDateRangeChange={setKpiDateRange}
                  />
                  <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-0">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <CardDescription className="text-xs">Total Projects</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 px-4">
                        <p className="text-2xl font-bold">{totalProjects}</p>
                      </CardContent>
                    </Card>
                    <Card className="p-0">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <CardDescription className="text-xs">In Progress</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 px-4">
                        <p className="text-2xl font-bold text-amber-500">{inProgressProjects}</p>
                      </CardContent>
                    </Card>
                    <Card className="p-0">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <CardDescription className="text-xs">Completed</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 px-4">
                        <p className="text-2xl font-bold text-emerald-500">{completedProjects}</p>
                      </CardContent>
                    </Card>
                    <Card 
                      className="p-0 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setTotalSoldSheetOpen(true)}
                    >
                      <CardHeader className="pb-1 pt-3 px-4">
                        <CardDescription className="text-xs">Total Sold</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 px-4">
                        <p className="text-2xl font-bold">{formatCurrency(filteredFinancialsTotal)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Click to view details
                        </p>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Admin-only KPI Section */}
                  {isAdmin && (
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Card 
                        className="p-0 cursor-pointer hover:border-primary/50 transition-colors border-emerald-500/30 bg-emerald-500/5"
                        onClick={() => {
                          setProfitSheetType('expected');
                          setProfitSheetOpen(true);
                        }}
                      >
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardDescription className="text-xs flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Expected Profit (In-Progress)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                          <p className={`text-2xl font-bold ${profitKPIs.expectedProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {formatCurrency(profitKPIs.expectedProfit)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {profitKPIs.expectedProfitProjects.length} project{profitKPIs.expectedProfitProjects.length !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>
                      <Card 
                        className="p-0 cursor-pointer hover:border-primary/50 transition-colors border-blue-500/30 bg-blue-500/5"
                        onClick={() => {
                          setProfitSheetType('realized');
                          setProfitSheetOpen(true);
                        }}
                      >
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardDescription className="text-xs flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Realized Profit (Completed)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                          <p className={`text-2xl font-bold ${profitKPIs.realizedProfit >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                            {formatCurrency(profitKPIs.realizedProfit)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {profitKPIs.realizedProfitProjects.length} project{profitKPIs.realizedProfitProjects.length !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>
                      <Card 
                        className={`p-0 cursor-pointer hover:border-primary/50 transition-colors ${cashFlowKPI.netCashFlow >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                        onClick={() => setCashFlowSheetOpen(true)}
                      >
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardDescription className="text-xs flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Net Cash Flow
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                          <p className={`text-2xl font-bold ${cashFlowKPI.netCashFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {formatCurrency(cashFlowKPI.netCashFlow)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            In: {formatCurrency(cashFlowKPI.invoicesReceived)} • Out: {formatCurrency(cashFlowKPI.billsPaid + cashFlowKPI.commissionsPaid)}
                          </p>
                        </CardContent>
                      </Card>
                    </section>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Missing Projects from Won Opportunities - Admin Only */}
              {isAdmin && <MissingProjectsSection />}


              {/* Show matched financial sections when searching by amount */}
              {matchedFinancialSections.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground text-xs">Found in:</span>
                  {Array.from(matchedFinancialSections).map((section) => {
                    return (
                      <Badge 
                        key={section} 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => {
                          setFinancialSearchSection(section);
                          setFinancialSearchSheetOpen(true);
                        }}
                      >
                        {section}
                      </Badge>
                    );
                  })}
                </div>
              )}

          {/* Projects Filters */}
          <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {sortedAndFilteredProjects.length} project{sortedAndFilteredProjects.length !== 1 ? "s" : ""}
                </p>
                {isAdmin && (
                  <Button
                    variant={showArchived ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {showArchived ? "Hide Archived" : "Archived"}
                    {archivedProjects.length > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                        {archivedProjects.length}
                      </Badge>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48 h-8 text-xs"
                  />
                </div>
                <MultiSelectFilter
                  options={PROJECT_STATUSES.map(status => ({ value: status, label: status }))}
                  selected={selectedStatuses}
                  onChange={setSelectedStatuses}
                  placeholder="Status"
                  icon={<Filter className="h-3.5 w-3.5" />}
                  className="w-[140px]"
                />
                <Button
                  variant={showAlternatingColors ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => setShowAlternatingColors(!showAlternatingColors)}
                  title={showAlternatingColors ? "Disable alternating row colors" : "Enable alternating row colors"}
                >
                  Stripes
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1">
                      <Columns3 className="h-3.5 w-3.5" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48 p-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Toggle columns</p>
                    {([
                      { key: 'salesperson' as ColumnKey, label: 'Sales Rep' },
                      { key: 'source' as ColumnKey, label: 'Source' },
                      { key: 'sold_amount' as ColumnKey, label: 'Sold' },
                      { key: 'est_proj_cost' as ColumnKey, label: 'Cost' },
                      { key: 'bills_received' as ColumnKey, label: 'Bills Recv' },
                      { key: 'bills_paid' as ColumnKey, label: 'Bills Paid' },
                      { key: 'inv_collected' as ColumnKey, label: 'Inv Collect' },
                      { key: 'inv_balance' as ColumnKey, label: 'Inv Bal' },
                      { key: 'proj_balance' as ColumnKey, label: 'Proj Bal' },
                      { key: 'expected_profit' as ColumnKey, label: 'Profit' },
                      { key: 'total_cash' as ColumnKey, label: 'Cash' },
                    ]).map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-1 py-1 hover:bg-muted/50 rounded cursor-pointer text-xs">
                        <Checkbox
                          checked={isColumnVisible(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                          className="h-3.5 w-3.5"
                        />
                        {col.label}
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
          </div>

          {/* Projects Table */}
          <DataListCard>
              <DataListCardBody className="overflow-auto max-h-[calc(100vh-260px)]">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sortedAndFilteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects found</p>
                  <p className="text-sm">Projects will appear here when opportunities are marked as won</p>
                </div>
              ) : (
                <table className="w-full caption-bottom text-xs table-fixed">
                    <thead className="[&_tr]:border-b sticky top-0 z-20 bg-card">
                      <TableRow className="bg-card hover:bg-card [&_th]:align-bottom [&_th]:leading-tight [&_th]:py-2 [&_th]:text-left">
                        <TableHead className="w-7 min-w-7 max-w-7 p-0"></TableHead>
                        <TableHead className="w-[5%] cursor-pointer hover:bg-muted/50 text-xs p-0 pl-1" onClick={() => handleSort('project_number')}>
                          <div className="flex items-end gap-0.5"># <SortIcon column="project_number" /></div>
                        </TableHead>
                        {isUnified && (
                          <TableHead className="w-[7%] text-xs">
                            <div className="flex items-end">Co.</div>
                          </TableHead>
                        )}
                        <TableHead className={cn(isUnified ? "w-[12%]" : "w-[14%]", "cursor-pointer hover:bg-muted/50 text-xs")} onClick={() => handleSort('address')}>
                          <div className="flex items-end gap-0.5">Address <SortIcon column="address" /></div>
                        </TableHead>
                        <TableHead className="w-[9%] cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('status')}>
                          <div className="flex items-end gap-0.5">Status <SortIcon column="status" /></div>
                        </TableHead>
                        {isColumnVisible('salesperson') && (
                        <TableHead className="w-[8%] cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('salesperson')}>
                          <div className="flex items-end gap-0.5">Sales <SortIcon column="salesperson" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('source') && (
                        <TableHead className="w-[7%] text-xs">
                          <div className="flex items-end">Source</div>
                        </TableHead>
                        )}
                        {isColumnVisible('sold_amount') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('sold_amount')}>
                          <div className="flex items-end justify-end gap-0.5">Sold <SortIcon column="sold_amount" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('est_proj_cost') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('est_proj_cost')}>
                          <div className="flex items-end justify-end gap-0.5">Cost <SortIcon column="est_proj_cost" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('inv_collected') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('inv_collected')}>
                          <div className="flex items-end justify-end gap-0.5">Inv Collect <SortIcon column="inv_collected" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('inv_balance') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('inv_balance')}>
                          <div className="flex items-end justify-end gap-0.5">Inv Bal <SortIcon column="inv_balance" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('bills_received') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('bills_received')}>
                          <div className="flex items-end justify-end gap-0.5">Bills Recv <SortIcon column="bills_received" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('bills_paid') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('bills_paid')}>
                          <div className="flex items-end justify-end gap-0.5">Bills Paid <SortIcon column="bills_paid" /></div>
                        </TableHead>
                        )}
                        {isColumnVisible('proj_balance') && (
                        <TableHead className="w-[7%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('proj_balance')}>
                          <div className="flex items-end justify-end gap-0.5">Proj Bal <SortIcon column="proj_balance" /></div>
                        </TableHead>
                        )}
                        {isAdmin && isColumnVisible('expected_profit') && (
                          <TableHead className="w-[6%] text-right cursor-pointer hover:bg-muted/50 text-xs" onClick={() => handleSort('expected_profit')}>
                            <div className="flex items-end justify-end gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="underline decoration-dotted underline-offset-2 cursor-help">Profit</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  <p className="font-medium">Revenue − COGS − Commission + Lead Fee</p>
                                </TooltipContent>
                              </Tooltip>
                              <SortIcon column="expected_profit" />
                            </div>
                          </TableHead>
                        )}
                        {isColumnVisible('total_cash') && (
                        <TableHead className="w-[6%] text-right cursor-pointer hover:bg-muted/50 bg-primary/10 text-xs" onClick={() => handleSort('total_cash')}>
                          <div className="flex items-end justify-end gap-0.5 font-semibold">Cash <SortIcon column="total_cash" /></div>
                        </TableHead>
                        )}
                        
                      </TableRow>
                    </thead>
                    <TableBody>
                      {sortedAndFilteredProjects.map((project, index) => {
                        const financials = projectFinancials[project.id];
                        return (
                          <TableRow 
                            key={project.id} 
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              showAlternatingColors && index % 2 === 1 && "bg-muted/50"
                            )}
                            onClick={() => handleOpenProject(project)}
                          >
                            <TableCell className="w-7 min-w-7 max-w-7 p-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                  {project.customer_email && (
                                    <DropdownMenuItem
                                      onClick={() => setEmailConfirmProjectId(project.id)}
                                      disabled={sendPortalEmailMutation.isPending}
                                    >
                                      <Mail className="h-3.5 w-3.5 mr-2" />
                                      Send portal email
                                    </DropdownMenuItem>
                                  )}
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteTestProject(project)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                            <TableCell className="font-medium text-xs truncate p-0 pl-1">
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-0.5">
                                  <span className="truncate">{project.project_number}</span>
                                {financials?.hasMissingContract && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="h-4 px-0.5 text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                                        C
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>No contract/agreement entered</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {financials?.hasMissingPhases && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="h-4 px-0.5 text-[9px] bg-orange-500/10 text-orange-500 border-orange-500/20">
                                        P
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Progress payments not entered</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {financials?.hasPhaseMismatch && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Phases don't match contract</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {financials?.hasContractMismatch && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="h-4 px-0.5 text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                                        $
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Contract mismatch</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                </div>
                                {(isAdmin || isSimulating) && project.legacy_project_number && (
                                  <span className="text-[9px] text-muted-foreground font-normal truncate">
                                    {project.legacy_project_number}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            {isUnified && (
                              <TableCell className="text-xs truncate">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                  {getCompanyName(project.company_id)}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-xs" title={project.project_address || project.project_name}>
                              <div className="flex flex-col min-w-0 leading-tight">
                                <span className="text-[11px] font-medium truncate">
                                  {getCustomerName(project) || project.project_name || "—"}
                                </span>
                                {project.project_address && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {project.project_address}
                                  </span>
                                )}
                                {project.install_start_date && (
                                  <span className="text-[9px] text-muted-foreground tabular-nums">
                                    {format(parseISO(project.install_start_date), "M/d/yy")}
                                    {project.project_status === "Completed" && project.completion_date
                                      ? ` – ${format(parseISO(project.completion_date), "M/d/yy")}`
                                      : null}
                                    {" "}
                                    <span className="text-primary font-medium">
                                      {(() => {
                                        const startDate = parseISO(project.install_start_date!);
                                        const endDate = project.completion_date
                                          ? parseISO(project.completion_date)
                                          : new Date();
                                        const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                                        return `${diffDays}d`;
                                      })()}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-0">
                                <Select
                                  value={project.project_status || "New Job"}
                                  onValueChange={(newStatus) => {
                                    if (newStatus !== project.project_status) {
                                      setStatusChangeProject(project);
                                      setStatusChangeNewStatus(newStatus);
                                      setStatusChangeDialogOpen(true);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0 w-auto">
                                    <BadgePill intent={statusToIntent(project.project_status)}>
                                      {project.project_status || "New Job"}
                                    </BadgePill>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Proposal">Proposal</SelectItem>
                                    <SelectItem value="New Job">New Job</SelectItem>
                                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                                    <SelectItem value="On-Hold">On-Hold</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                                {financials?.earliestSignedDate && (
                                  <span className="text-[9px] text-muted-foreground truncate">
                                    Signed: {format(parseISO(financials.earliestSignedDate), "M/d/yy")}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            {isColumnVisible('salesperson') && (
                            <TableCell className="text-[10px] truncate" title={`${project.primary_salesperson || ''} / ${project.project_manager || ''}`}>
                              {(() => {
                                const salesperson = project.primary_salesperson?.trim();
                                const pm = project.project_manager?.trim();
                                if (!salesperson && !pm) return "-";
                                if (!salesperson) return pm;
                                if (!pm) return salesperson;
                                if (salesperson.toLowerCase() === pm.toLowerCase()) return salesperson;
                                return `${salesperson}`;
                              })()}
                            </TableCell>
                            )}
                            {isColumnVisible('source') && (
                            <TableCell className="text-[10px] truncate" title={project.lead_source || "-"}>
                              {project.lead_source || "-"}
                            </TableCell>
                            )}
                            {isColumnVisible('sold_amount') && (
                            <TableCell className="text-right text-[10px] font-medium truncate">
                              {formatCurrency(financials?.contractsTotal)}
                            </TableCell>
                            )}
                            {isColumnVisible('est_proj_cost') && (
                            <TableCell className="text-right text-[10px] truncate">
                              {financials?.contractsTotal > 0 ? (
                                <span className={`inline-flex items-center gap-1 ${(financials?.isCompleted || financials?.exceededExpectedCosts) ? 'text-primary' : ''}`}>
                                  {financials?.isEstimatedCost && (
                                    <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground leading-none">Est.</span>
                                  )}
                                  {formatCurrency(financials?.displayCost)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            )}
                            {isColumnVisible('inv_collected') && (
                            <TableCell className="text-right text-[10px] text-emerald-600 truncate">
                              {formatCurrency(financials?.invoicesCollected)}
                            </TableCell>
                            )}
                            {isColumnVisible('inv_balance') && (
                            <TableCell className="text-right text-[10px] text-amber-600 truncate">
                              {formatCurrency(financials?.invoiceBalanceDue)}
                            </TableCell>
                            )}
                            {isColumnVisible('bills_received') && (
                            <TableCell className="text-right text-[10px] truncate">
                              {formatCurrency(financials?.totalBillsReceived)}
                            </TableCell>
                            )}
                            {isColumnVisible('bills_paid') && (
                            <TableCell className="text-right text-[10px] truncate">
                              {formatCurrency(financials?.totalBillsPaid)}
                            </TableCell>
                            )}
                            {isColumnVisible('proj_balance') && (
                            <TableCell className="text-right text-[10px] text-amber-600 truncate">
                              {formatCurrency(financials?.projectBalanceDue)}
                            </TableCell>
                            )}
                            {isAdmin && isColumnVisible('expected_profit') && (
                              <TableCell className={`text-right text-[10px] font-medium truncate ${financials?.contractsTotal > 0 ? ((financials?.expectedFinalProfit || 0) >= 0 ? 'text-emerald-600' : 'text-destructive') : ''}`}>
                                {financials?.contractsTotal > 0 ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    {financials?.isEstimatedCost && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-[8px] font-normal text-muted-foreground bg-muted px-1 py-0.5 rounded cursor-help leading-none">Est.</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p>Estimated — using projected costs</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {formatCurrency(financials?.expectedFinalProfit)}
                                  </span>
                                ) : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            )}
                            {isColumnVisible('total_cash') && (
                            <TableCell className={`text-right text-[10px] font-bold ${(() => {
                              const cash = financials?.totalCash || 0;
                              const billsPaid = financials?.totalBillPayments || 0;
                              const collected = financials?.invoicesCollected || 0;
                              if (cash === 0) return '';
                              const ratio = collected > 0 ? billsPaid / collected : 0;
                              if (ratio < 0.70) return 'bg-emerald-500/20 text-emerald-700';
                              if (ratio <= 0.85) return 'bg-orange-400/20 text-orange-700';
                              return 'bg-red-500/20 text-red-700';
                            })()}`}>
                              {formatCurrency(financials?.totalCash)}
                            </TableCell>
                            )}
                            
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </table>
              )}
            </DataListCardBody>
          </DataListCard>

          {/* Archived Projects Section */}
          {isAdmin && showArchived && (
            <Card className="border-muted bg-muted/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-muted-foreground">Archived Projects</CardTitle>
                </div>
                <CardDescription>
                  {archivedProjects.length} archived project{archivedProjects.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {archivedProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Archive className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No archived projects</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-7 min-w-7 max-w-7 p-0"></TableHead>
                          <TableHead className="w-16 p-0 pl-1">#</TableHead>
                          <TableHead>Project Name</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Archived</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archivedProjects.map((project) => (
                          <TableRow key={project.id} className="opacity-70 hover:opacity-100">
                            <TableCell className="w-7 min-w-7 max-w-7 p-0">
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => restoreProjectMutation.mutate(project)}
                                  disabled={restoreProjectMutation.isPending}
                                >
                                  {restoreProjectMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteTestProject(project)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium p-0 pl-1">
                            </TableCell>
                            <TableCell>{project.project_name}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {project.project_address || "-"}
                            </TableCell>
                            <TableCell>
                              <BadgePill intent={statusToIntent(project.project_status)}>
                                {project.project_status || "Unknown"}
                              </BadgePill>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {project.deleted_at 
                                ? new Date(project.deleted_at).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
            </div>
          )}

          {activeView === 'analytics' && (
            <AnalyticsSection 
              onProjectClick={(projectId, initialTab, returnTo, financeSubTab, highlightInvoiceId, highlightBillId) => {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                  handleOpenProject(project, initialTab, returnTo, financeSubTab, highlightInvoiceId, highlightBillId);
                }
              }}
              reopenPayablesSheet={reopenPayablesSheet}
              onPayablesSheetOpened={() => setReopenPayablesSheet(false)}
              reopenARSheet={reopenARSheet}
              onARSheetOpened={() => setReopenARSheet(false)}
              initialTab={searchParams.get('tab') || undefined}
              openPayablesOnLoad={searchParams.get('section') === 'payables'}
              initialKPI={searchParams.get('kpi') || undefined}
            />
          )}

          {activeView === 'subcontractors' && (
            <SubcontractorsManagement 
              autoOpenAdd={!!returnToProjectId}
              onSubcontractorAdded={() => {
                if (returnToProjectId) {
                  // Find the project and open it with bill dialog
                  const project = projects.find(p => p.id === returnToProjectId);
                  if (project) {
                    setPendingBillDialogOpen(true);
                  }
                  // Navigate back to the project detail (this also clears the subcontractors view)
                  navigate(`/production/${returnToProjectId}`, { replace: true });
                }
              }}
            />
          )}

          {activeView === 'salespeople' && (
            <SalespeopleManagement />
          )}

          {activeView === 'scope-submissions' && (
            <ScopeSubmissionsManagement />
          )}
        </div>

        {/* Project Detail Sheet */}
        <ProjectDetailSheet
          project={selectedProject}
          open={detailSheetOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Handle return-to behavior - navigate back to the source sheet
              if (returnToParam && returnToParam !== 'opportunity') {
                // returnToParam is an encoded pathname — navigate back to it exactly
                navigate(decodeURIComponent(returnToParam), { replace: true });
              } else if (returnToParam === 'opportunity' && returnToOppId) {
                navigate(`/opportunities/${returnToOppId}`, { replace: true });
              } else if (returnToAfterProjectClose === 'payables') {
                setReopenPayablesSheet(true);
                // Navigate back to analytics cashflow with payables section
                navigate('/production?view=analytics&tab=cashflow&section=payables', { replace: true });
              } else if (returnToAfterProjectClose === 'outstandingAR') {
                setReopenARSheet(true);
                // Navigate back to analytics cashflow with AR section
                navigate('/production?view=analytics&tab=cashflow&section=ar', { replace: true });
              } else {
                // Default: Navigate back to production list
                navigate('/production', { replace: true });
              }
              setProjectInitialTab(undefined);
              setProjectInitialFinanceSubTab(undefined);
              setReturnToAfterProjectClose(null);
              setHighlightedInvoiceId(null);
              setHighlightedBillId(null);
            }
          }}
          onUpdate={refetch}
          autoOpenBillDialog={pendingBillDialogOpen}
          onBillDialogOpened={() => setPendingBillDialogOpen(false)}
          initialTab={projectInitialTab || (autoOpenFinanceDialog ? 'finance' : undefined)}
          initialFinanceSubTab={projectInitialFinanceSubTab}
          autoOpenFinanceDialog={autoOpenFinanceDialog}
          highlightInvoiceId={highlightedInvoiceId}
          highlightBillId={highlightedBillId}
        />

        {/* New Project Dialog */}
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
        />

        {/* Import Projects Dialog */}
        <ProjectImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />

        {/* Merge Projects Dialog */}
        <MergeProjectsDialog
          open={mergeProjectsDialogOpen}
          onOpenChange={setMergeProjectsDialogOpen}
          projects={projects}
        />

        {/* Send Portal Email Confirmation */}
        <AlertDialog open={!!emailConfirmProjectId} onOpenChange={(open) => { if (!open) setEmailConfirmProjectId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Portal Email</AlertDialogTitle>
              <AlertDialogDescription>
                This will send a portal update email to the customer. Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (emailConfirmProjectId) {
                  sendPortalEmailMutation.mutate(emailConfirmProjectId);
                  setEmailConfirmProjectId(null);
                }
              }}>
                Send Email
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteTestProjectOpen} onOpenChange={(open) => {
          setDeleteTestProjectOpen(open);
          if (!open) {
            setProjectHasRecords(null);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {checkingRecords ? (
                  "Checking project..."
                ) : projectToDelete && isTestProject(projectToDelete) ? (
                  `Delete Test Project #${projectToDelete?.project_number}?`
                ) : projectHasRecords === false ? (
                  `Permanently Delete Project #${projectToDelete?.project_number}?`
                ) : (
                  `Delete Project #${projectToDelete?.project_number} (and all related records)?`
                )}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {checkingRecords ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking if project has any records...</span>
                    </div>
                  ) : projectToDelete && isTestProject(projectToDelete) ? (
                    <>
                      <p>This is a <strong>test project</strong>. All associated records (agreements, bills, payments, invoices, etc.) will be permanently deleted.</p>
                      <span className="block mt-2 font-medium text-destructive">This action cannot be undone.</span>
                    </>
                  ) : projectHasRecords === false ? (
                    <>
                      <p>This project has <strong>no financial records</strong> (agreements, bills, payments, invoices, etc.).</p>
                      <p className="mt-2">You can <strong>permanently delete</strong> it or archive it for records.</p>
                      <span className="block mt-2 font-medium text-destructive">Permanent deletion cannot be undone.</span>
                    </>
                  ) : (
                    <>
                      <p>This project has associated records (agreements, invoices, payments, bills, etc.).</p>
                      <p className="mt-2"><strong>Deleting will permanently remove the project and all related records.</strong></p>
                      <span className="block mt-2 font-medium text-destructive">This action cannot be undone.</span>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {!checkingRecords && projectToDelete && (
                <AlertDialogAction 
                  onClick={() => projectToDelete && deleteProjectMutation.mutate({ 
                    project: projectToDelete, 
                    permanentDelete: true,
                    isTestProject: isTestProject(projectToDelete)
                  })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteProjectMutation.isPending}
                >
                  {deleteProjectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Permanently"
                  )}
                </AlertDialogAction>
              )}
              {!checkingRecords && !(projectToDelete && isTestProject(projectToDelete)) && (
                <AlertDialogAction 
                  onClick={() => projectToDelete && deleteProjectMutation.mutate({ project: projectToDelete, permanentDelete: false })}
                  disabled={deleteProjectMutation.isPending}
                >
                  {deleteProjectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    "Archive Project"
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status Change Confirmation Dialog */}
        <AlertDialog open={statusChangeDialogOpen} onOpenChange={(open) => {
          setStatusChangeDialogOpen(open);
          if (!open) {
            setStatusChangeProject(null);
            setStatusChangeNewStatus("");
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change Project Status?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {statusChangeProject && (
                    <p>
                      Change status of <strong>#{statusChangeProject.project_number} - {statusChangeProject.project_name}</strong> from{" "}
                      <BadgePill intent={statusToIntent(statusChangeProject.project_status)}>
                        {statusChangeProject.project_status || "New Job"}
                      </BadgePill>{" "}
                      to{" "}
                      <BadgePill intent={statusToIntent(statusChangeNewStatus)}>
                        {statusChangeNewStatus}
                      </BadgePill>?
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => statusChangeProject && updateStatusMutation.mutate({ 
                  projectId: statusChangeProject.id, 
                  oldStatus: statusChangeProject.project_status,
                  newStatus: statusChangeNewStatus 
                })}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Warning Projects Sheet */}
        <Sheet open={warningSheetOpen} onOpenChange={setWarningSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {warningSheetType && warningSheetTitle[warningSheetType]}
              </SheetTitle>
              <SheetDescription>
                {warningSheetType && `${getWarningProjects(warningSheetType).length} project(s) with this issue`}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-140px)] mt-4">
              <div className="space-y-2 pr-4">
                {warningSheetType && getWarningProjects(warningSheetType).map((project) => {
                  const financials = projectFinancials[project.id];
                  return (
                    <div
                      key={project.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setWarningSheetOpen(false);
                        handleOpenProject(project);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">#{project.project_number} - {project.project_address || project.project_name}</p>
                          <p className="text-sm text-muted-foreground">{project.primary_salesperson || 'No salesperson'}</p>
                        </div>
                        <div className="text-right">
                          {financials && (
                            <>
                              <p className="text-sm font-medium">Contract: {formatCurrency(financials.contractsTotal)}</p>
                              <p className="text-xs text-muted-foreground">Est: {formatCurrency(financials.estimatedCost)}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {financials?.hasMissingContract && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                            No Contract
                          </Badge>
                        )}
                        {financials?.hasMissingPhases && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/20">
                            No Phases
                          </Badge>
                        )}
                        {financials?.hasPhaseMismatch && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                            Phase ≠ Contract
                          </Badge>
                        )}
                        {financials?.hasContractMismatch && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-500 border-red-500/20">
                            Contract ≠ Est
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Profit Projects Sheet (Admin only) */}
        <Sheet open={profitSheetOpen} onOpenChange={setProfitSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 ${profitSheetType === 'expected' ? 'text-emerald-500' : 'text-blue-500'}`} />
                {profitSheetType === 'expected' ? 'Expected Profit (In-Progress)' : 'Realized Profit (Completed)'}
              </SheetTitle>
              <SheetDescription>
                {profitSheetType === 'expected' 
                  ? `${profitKPIs.expectedProfitProjects.length} project(s) with expected profit of ${formatCurrency(profitKPIs.expectedProfit)}`
                  : `${profitKPIs.realizedProfitProjects.length} project(s) with realized profit of ${formatCurrency(profitKPIs.realizedProfit)}`
                }
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-140px)] mt-4">
              <div className="space-y-2 pr-4">
                {(profitSheetType === 'expected' ? profitKPIs.expectedProfitProjects : profitKPIs.realizedProfitProjects).map((projectId) => {
                  const project = projects.find(p => p.id === projectId);
                  if (!project) return null;
                  const financials = projectFinancials[project.id];
                  const profit = financials?.expectedFinalProfit || 0;
                  
                  return (
                    <div
                      key={project.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setProfitSheetOpen(false);
                        handleOpenProject(project);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">#{project.project_number} - {project.project_address || project.project_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.primary_salesperson || 'No salesperson'} • Sold: {formatCurrency(financials?.contractsTotal || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {formatCurrency(profit)}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {project.project_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Cash Flow Sheet (Admin only) */}
        <Sheet open={cashFlowSheetOpen} onOpenChange={setCashFlowSheetOpen}>
          <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cash Flow from Projects
              </SheetTitle>
              <SheetDescription>
                Invoice payments received minus bill payments and commission payments
                {kpiDateRange?.from && kpiDateRange?.to && (
                  <span className="block mt-1">
                    Filtered: {kpiDateRange.from.toLocaleDateString()} - {kpiDateRange.to.toLocaleDateString()}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <CashFlowChart
                invoicePayments={cashFlowKPI.invoicePaymentsData}
                billPayments={cashFlowKPI.billPaymentsData}
                commissionPayments={cashFlowKPI.commissionPaymentsData}
                dateRange={kpiDateRange}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Total Sold Projects Sheet */}
        <Sheet open={totalSoldSheetOpen} onOpenChange={setTotalSoldSheetOpen}>
          <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Total Sold Projects
              </SheetTitle>
              <SheetDescription>
                {filteredByStatus.length} project{filteredByStatus.length !== 1 ? 's' : ''} totaling {formatCurrency(filteredFinancialsTotal)}
                {kpiDateRange?.from && kpiDateRange?.to && (
                  <span className="block mt-1">
                    Filtered: {kpiDateRange.from.toLocaleDateString()} - {kpiDateRange.to.toLocaleDateString()}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>
            
            {/* Summary by Salesperson */}
            <div className="mt-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Summary by Salesperson (click to filter)</p>
                {totalSoldFilterSalesperson && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-2"
                    onClick={() => setTotalSoldFilterSalesperson(null)}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const salespersonStats: Record<string, { count: number; total: number }> = {};
                  filteredByStatus.forEach((project) => {
                    const sp = project.primary_salesperson || 'Unassigned';
                    const financials = projectFinancials[project.id];
                    if (!salespersonStats[sp]) {
                      salespersonStats[sp] = { count: 0, total: 0 };
                    }
                    salespersonStats[sp].count++;
                    salespersonStats[sp].total += financials?.contractsTotal || 0;
                  });
                  return Object.entries(salespersonStats)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, stats]) => (
                      <Badge 
                        key={name} 
                        variant={totalSoldFilterSalesperson === name ? "default" : "outline"} 
                        className={`text-xs py-1 px-2 cursor-pointer hover:bg-primary/20 transition-colors ${
                          totalSoldFilterSalesperson === name ? 'bg-primary text-primary-foreground' : ''
                        }`}
                        onClick={() => setTotalSoldFilterSalesperson(totalSoldFilterSalesperson === name ? null : name)}
                      >
                        {name}: {stats.count} ({formatCurrency(stats.total)})
                      </Badge>
                    ));
                })()}
              </div>
            </div>

            {/* Group By Controls */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Group by:</span>
              <Select value={totalSoldGroupBy} onValueChange={(v) => setTotalSoldGroupBy(v as 'none' | 'month' | 'salesperson')}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="month">Month/Year (Start Date)</SelectItem>
                  <SelectItem value="salesperson">Salesperson</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-2 pr-4">
                {(() => {
                  // Apply salesperson filter
                  const projectsToShow = totalSoldFilterSalesperson
                    ? filteredByStatus.filter(p => 
                        (p.primary_salesperson || 'Unassigned') === totalSoldFilterSalesperson
                      )
                    : filteredByStatus;

                  if (totalSoldGroupBy === 'none') {
                    return projectsToShow.map((project) => {
                      const financials = projectFinancials[project.id];
                      const soldAmount = financials?.contractsTotal || 0;
                      return (
                        <ProjectSoldCard 
                          key={project.id} 
                          project={project} 
                          soldAmount={soldAmount}
                          signedDate={financials?.earliestSignedDate}
                          onOpen={() => {
                            setTotalSoldSheetOpen(false);
                            handleOpenProject(project);
                          }}
                        />
                      );
                    });
                  }

                  // Group projects
                  const groups: Record<string, typeof projectsToShow> = {};
                  projectsToShow.forEach((project) => {
                    let groupKey: string;
                    if (totalSoldGroupBy === 'month') {
                      if (project.install_start_date) {
                        const date = parseISO(project.install_start_date);
                        groupKey = format(date, 'MMMM yyyy');
                      } else {
                        groupKey = 'No Start Date';
                      }
                    } else {
                      groupKey = project.primary_salesperson || 'Unassigned';
                    }
                    if (!groups[groupKey]) {
                      groups[groupKey] = [];
                    }
                    groups[groupKey].push(project);
                  });

                  // Sort groups
                  const sortedGroups = Object.entries(groups).sort((a, b) => {
                    if (totalSoldGroupBy === 'month') {
                      // Sort by date descending (most recent first)
                      if (a[0] === 'No Start Date') return 1;
                      if (b[0] === 'No Start Date') return -1;
                      const dateA = new Date(a[1][0]?.install_start_date || 0);
                      const dateB = new Date(b[1][0]?.install_start_date || 0);
                      return dateB.getTime() - dateA.getTime();
                    } else {
                      // Sort by total sold descending
                      const totalA = a[1].reduce((sum, p) => sum + (projectFinancials[p.id]?.contractsTotal || 0), 0);
                      const totalB = b[1].reduce((sum, p) => sum + (projectFinancials[p.id]?.contractsTotal || 0), 0);
                      return totalB - totalA;
                    }
                  });

                  return sortedGroups.map(([groupName, groupProjects]) => {
                    const groupTotal = groupProjects.reduce((sum, p) => sum + (projectFinancials[p.id]?.contractsTotal || 0), 0);
                    return (
                      <div key={groupName} className="mb-4">
                        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 mb-2">
                          <span className="font-medium text-sm">{groupName}</span>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">{groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}</span>
                            <span className="text-sm font-semibold ml-2">{formatCurrency(groupTotal)}</span>
                          </div>
                        </div>
                        <div className="space-y-2 pl-2">
                          {groupProjects.map((project) => {
                            const financials = projectFinancials[project.id];
                            const soldAmount = financials?.contractsTotal || 0;
                            return (
                              <ProjectSoldCard 
                                key={project.id} 
                                project={project} 
                                soldAmount={soldAmount}
                                signedDate={financials?.earliestSignedDate}
                                onOpen={() => {
                                  setTotalSoldSheetOpen(false);
                                  handleOpenProject(project);
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Financial Search Results Sheet */}
        <FinancialSearchResultsSheet
          open={financialSearchSheetOpen}
          onOpenChange={setFinancialSearchSheetOpen}
          sectionType={financialSearchSection}
          searchQuery={searchQuery}
          records={getMatchingFinancialRecords(financialSearchSection)}
          onNavigateToProject={handleNavigateToProjectFromSearch}
        />

        {/* Pending Deposits Sheet */}
        <PendingDepositsSheet
          open={pendingDepositsSheetOpen}
          onOpenChange={setPendingDepositsSheetOpen}
          onOpenProject={(projectId) => {
            const project = projects.find(p => p.id === projectId);
            if (project) {
              handleOpenProject(project);
            }
          }}
        />
      </TooltipProvider>
    </AppLayout>
  );
}
