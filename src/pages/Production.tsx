import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/hooks/useAuditLog";
import { formatCurrency } from "@/lib/utils";
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
  Building2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SubcontractorWarningsCard } from "@/components/production/SubcontractorWarningsCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";


interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  project_type: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  cell_phone: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  project_manager: string | null;
  estimated_cost: number | null;
  total_pl: number | null;
  created_at: string;
  opportunity_id: string | null;
  location_id: string;
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
  exceededExpectedCosts: boolean;
  projectBalanceDue: number;
  profitToDate: number;
  totalCommission: number;
  expectedFinalProfit: number;
  totalCash: number;
}

type SortColumn = 'project_number' | 'address' | 'status' | 'salesperson' | 'project_manager' | 'sold_amount' | 'est_proj_cost' | 'bills_received' | 'bills_paid' | 'inv_collected' | 'inv_balance' | 'proj_balance' | 'commission' | 'expected_profit' | 'total_cash';
type SortDirection = 'asc' | 'desc';

const statusColors: Record<string, string> = {
  "New Job": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In-Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "On-Hold": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Completed": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Cancelled": "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function Production() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, isSimulating } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'projects';
  const returnToProjectId = searchParams.get('returnToProject');
  const openBillDialog = searchParams.get('openBill') === 'true';
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deleteTestProjectOpen, setDeleteTestProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectHasRecords, setProjectHasRecords] = useState<boolean | null>(null);
  const [checkingRecords, setCheckingRecords] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('project_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [warningSheetOpen, setWarningSheetOpen] = useState(false);
  const [warningSheetType, setWarningSheetType] = useState<'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | null>(null);
  const [pendingBillDialogOpen, setPendingBillDialogOpen] = useState(false);

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, lead_cost_percent, commission_split_pct, primary_commission_pct, secondary_commission_pct, tertiary_commission_pct, quaternary_commission_pct, deleted_at, estimated_project_cost, sold_dispatch_value")
        .is("deleted_at", null) // Only show non-deleted projects
        .order("project_number", { ascending: false });
      
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
  });

  // Fetch all financial data for projects
  const { data: allAgreements = [] } = useQuery({
    queryKey: ["all-project-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, project_id, total_price, agreement_type");
      if (error) throw error;
      return data;
    },
  });

  const { data: allPhases = [] } = useQuery({
    queryKey: ["all-project-phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payment_phases")
        .select("id, project_id, agreement_id, amount");
      if (error) throw error;
      return data;
    },
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["all-project-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_invoices")
        .select("id, project_id, amount, payments_received, open_balance");
      if (error) throw error;
      return data;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["all-project-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payments")
        .select("id, project_id, payment_amount, payment_status");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["all-project-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bills")
        .select("id, project_id, bill_amount, amount_paid");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBillPayments = [] } = useQuery({
    queryKey: ["all-bill-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_payments")
        .select("id, bill_id, payment_amount");
      if (error) throw error;
      return data;
    },
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
    const totalBillsPaid = projectBills.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
    
    // Calculate actual bill payments from bill_payments table
    const projectBillIds = projectBills.map(b => b.id);
    const totalBillPayments = allBillPayments
      .filter(bp => projectBillIds.includes(bp.bill_id))
      .reduce((sum, bp) => sum + (bp.payment_amount || 0), 0);
    
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

    // Commission per project: (Total Sold - Lead Fee - Max(Bills, Est)) * Commission Split%
    const leadCostPercent = project.lead_cost_percent ?? 18;
    const commissionSplitPct = project.commission_split_pct ?? 50;
    const leadCostAmount = contractsTotal * (leadCostPercent / 100);
    const commissionBase = contractsTotal - leadCostAmount - costForProfit;
    const totalCommission = commissionBase > 0 ? commissionBase * (commissionSplitPct / 100) : 0;
    
    // Company expected profit: Total Sold - Max(Bills, Est) - Commission
    const expectedFinalProfit = contractsTotal - costForProfit - totalCommission;
    
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
      exceededExpectedCosts,
      projectBalanceDue,
      profitToDate,
      totalCommission,
      expectedFinalProfit,
      totalCash,
    };
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedAndFilteredProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      const matchesSearch =
        searchQuery === "" ||
        project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.project_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.customer_first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.customer_last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.project_number?.toString().includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" || project.project_status === statusFilter;

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
          comparison = (financialsA?.effectiveEstimatedCost || 0) - (financialsB?.effectiveEstimatedCost || 0);
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
  }, [projects, searchQuery, statusFilter, sortColumn, sortDirection, projectFinancials]);

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

  // Delete project mutation - soft delete for projects with records, hard delete for empty projects (admin only)
  const deleteProjectMutation = useMutation({
    mutationFn: async ({ project, permanentDelete, isTestProject }: { project: Project; permanentDelete: boolean; isTestProject?: boolean }) => {
      if (permanentDelete) {
        // Hard delete for empty projects or test projects (admin only)
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
          description: `Permanently deleted ${isTestProject ? 'test ' : 'empty '}project #${project.project_number} - ${project.project_name}`,
        });

        // For test projects, delete ALL related records first
        if (isTestProject) {
          // Delete financial records
          await supabase.from("project_agreements").delete().eq("project_id", project.id);
          await supabase.from("project_bills").delete().eq("project_id", project.id);
          await supabase.from("project_payments").delete().eq("project_id", project.id);
          await supabase.from("project_invoices").delete().eq("project_id", project.id);
          await supabase.from("project_payment_phases").delete().eq("project_id", project.id);
          await supabase.from("project_documents").delete().eq("project_id", project.id);
          await supabase.from("project_commissions").delete().eq("project_id", project.id);
          await supabase.from("project_notes").delete().eq("project_id", project.id);
          await supabase.from("commission_payments").delete().eq("project_id", project.id);
        }

        // Delete lightweight records that might exist
        await supabase.from("project_checklists").delete().eq("project_id", project.id);
        await supabase.from("project_messages").delete().eq("project_id", project.id);
        await supabase.from("project_cases").delete().eq("project_id", project.id);
        await supabase.from("project_feedback").delete().eq("project_id", project.id);
        await supabase.from("project_finance").delete().eq("project_id", project.id);
        
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

  const handleOpenProject = (project: Project) => {
    setSelectedProject(project);
    setDetailSheetOpen(true);
  };

  // Calculate KPIs based on status filter
  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter(p => p.project_status === statusFilter);
  }, [projects, statusFilter]);

  const totalProjects = filteredByStatus.length;
  const inProgressProjects = filteredByStatus.filter(p => p.project_status === "In-Progress").length;
  const completedProjects = filteredByStatus.filter(p => p.project_status === "Completed").length;
  const totalEstimatedCost = filteredByStatus.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  // Calculate filtered financials for KPIs
  const filteredFinancialsTotal = useMemo(() => {
    return filteredByStatus.reduce((sum, p) => sum + (projectFinancials[p.id]?.contractsTotal || 0), 0);
  }, [filteredByStatus, projectFinancials]);

  // Calculate warning counts
  const warningCounts = useMemo(() => {
    const counts = {
      missingContract: 0,
      missingPhases: 0,
      phaseMismatch: 0,
      contractMismatch: 0,
    };
    
    Object.values(projectFinancials).forEach((f) => {
      if (f.hasMissingContract) counts.missingContract++;
      if (f.hasMissingPhases) counts.missingPhases++;
      if (f.hasPhaseMismatch) counts.phaseMismatch++;
      if (f.hasContractMismatch) counts.contractMismatch++;
    });
    
    return counts;
  }, [projectFinancials]);

  // Calculate bookkeeping warning counts
  const bookkeepingWarningCounts = useMemo(() => {
    const counts = {
      missingSalesperson: 0,
    };
    
    projects.forEach((p) => {
      if (!p.primary_salesperson || p.primary_salesperson.trim() === '') {
        counts.missingSalesperson++;
      }
    });
    
    return counts;
  }, [projects]);

  const totalWarnings = warningCounts.missingContract + warningCounts.missingPhases + warningCounts.phaseMismatch + warningCounts.contractMismatch;
  const totalBookkeepingWarnings = bookkeepingWarningCounts.missingSalesperson;

  // Get projects with specific warning type
  const getWarningProjects = useCallback((type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson') => {
    return projects.filter(p => {
      const f = projectFinancials[p.id];
      switch (type) {
        case 'missingContract': return f?.hasMissingContract;
        case 'missingPhases': return f?.hasMissingPhases;
        case 'phaseMismatch': return f?.hasPhaseMismatch;
        case 'contractMismatch': return f?.hasContractMismatch;
        case 'missingSalesperson': return !p.primary_salesperson || p.primary_salesperson.trim() === '';
      }
    });
  }, [projects, projectFinancials]);

  const handleOpenWarningSheet = (type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson') => {
    setWarningSheetType(type);
    setWarningSheetOpen(true);
  };

  const warningSheetTitle: Record<string, string> = {
    missingContract: 'Missing Contract',
    missingPhases: 'Missing Payment Phases',
    phaseMismatch: 'Phase Amount Mismatch',
    contractMismatch: 'Contract Mismatch Dispatch Reported $ Sold',
    missingSalesperson: 'Missing Salesperson',
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
        <div className="py-4 px-4 lg:px-6 space-y-4">
          {activeView === 'projects' && (
            <div className="space-y-4">
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
                <Card className="p-0">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription className="text-xs">Total Sold</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3 px-4">
                    <p className="text-2xl font-bold">{formatCurrency(filteredFinancialsTotal)}</p>
                  </CardContent>
                </Card>
              </section>

          {/* Warnings Section - Two Columns */}
          {(totalWarnings > 0 || totalBookkeepingWarnings > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Financial Warnings */}
              {totalWarnings > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <CardTitle className="text-sm">Financial Warnings</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {warningCounts.missingContract > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                          onClick={() => handleOpenWarningSheet('missingContract')}
                        >
                          <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-destructive text-destructive-foreground border-0">
                            C
                          </Badge>
                          No Contract: {warningCounts.missingContract}
                        </Button>
                      )}
                      {warningCounts.missingPhases > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
                          onClick={() => handleOpenWarningSheet('missingPhases')}
                        >
                          <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-orange-500 text-white border-0">
                            P
                          </Badge>
                          No Phases: {warningCounts.missingPhases}
                        </Button>
                      )}
                      {warningCounts.phaseMismatch > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                          onClick={() => handleOpenWarningSheet('phaseMismatch')}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1.5" />
                          Phase Mismatch: {warningCounts.phaseMismatch}
                        </Button>
                      )}
                      {warningCounts.contractMismatch > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20"
                          onClick={() => handleOpenWarningSheet('contractMismatch')}
                        >
                          <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-red-500 text-white border-0">
                            $
                          </Badge>
                          Contract Mismatch: {warningCounts.contractMismatch}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bookkeeping Warnings */}
              {totalBookkeepingWarnings > 0 && (
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-blue-500" />
                      <CardTitle className="text-sm">Bookkeeping Warnings</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {bookkeepingWarningCounts.missingSalesperson > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                          onClick={() => handleOpenWarningSheet('missingSalesperson')}
                        >
                          <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-blue-500 text-white border-0">
                            S
                          </Badge>
                          No Salesperson: {bookkeepingWarningCounts.missingSalesperson}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

              {/* Missing Projects from Won Opportunities - Admin Only */}
              {isAdmin && <MissingProjectsSection />}

              {/* Subcontractor Expiration Warnings */}
              <SubcontractorWarningsCard />

              {/* Filters & Search */}
          <section className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="New Job">New Job</SelectItem>
                  <SelectItem value="In-Progress">In-Progress</SelectItem>
                  <SelectItem value="On-Hold">On-Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Button 
                  variant="outline" 
                  onClick={() => createTestProjectMutation.mutate()}
                  disabled={createTestProjectMutation.isPending}
                >
                  {createTestProjectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4 mr-2" />
                  )}
                  Add Test Project
                </Button>
              )}
              <Button onClick={() => setNewProjectOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>
          </section>

          {/* Projects Table */}
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                {sortedAndFilteredProjects.length} project{sortedAndFilteredProjects.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('project_number')}>
                          <div className="flex items-center"># <SortIcon column="project_number" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('address')}>
                          <div className="flex items-center">Address <SortIcon column="address" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                          <div className="flex items-center">Status <SortIcon column="status" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('salesperson')}>
                          <div className="flex items-center">Sales/PM <SortIcon column="salesperson" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('sold_amount')}>
                          <div className="flex items-center justify-end">Sold Amt <SortIcon column="sold_amount" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('est_proj_cost')}>
                          <div className="flex items-center justify-end">Est Costs</div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('bills_received')}>
                          <div className="flex items-center justify-end">Bills Rcvd <SortIcon column="bills_received" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('bills_paid')}>
                          <div className="flex items-center justify-end">Bills Paid <SortIcon column="bills_paid" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('inv_collected')}>
                          <div className="flex items-center justify-end">Inv Collected <SortIcon column="inv_collected" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('inv_balance')}>
                          <div className="flex items-center justify-end">Inv Balance <SortIcon column="inv_balance" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('proj_balance')}>
                          <div className="flex items-center justify-end">Proj Balance <SortIcon column="proj_balance" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('expected_profit')}>
                          <div className="flex items-center justify-end">Exp Profit <SortIcon column="expected_profit" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50 bg-primary/10" onClick={() => handleSort('total_cash')}>
                          <div className="flex items-center justify-end font-semibold">Cash <SortIcon column="total_cash" /></div>
                        </TableHead>
                        {isAdmin && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAndFilteredProjects.map((project) => {
                        const financials = projectFinancials[project.id];
                        return (
                          <TableRow 
                            key={project.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleOpenProject(project)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {project.project_number}
                                {financials?.hasMissingContract && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="h-5 px-1 text-[10px] bg-destructive/10 text-destructive border-destructive/20">
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
                                      <Badge variant="outline" className="h-5 px-1 text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/20">
                                        P
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Payment phases not entered for agreement</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {financials?.hasPhaseMismatch && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Payment phases don't match contract total</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {financials?.hasContractMismatch && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="h-5 px-1 text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                        $
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Contracts total ({formatCurrency(financials.contractsTotal)}) doesn't match Est. Cost ({formatCurrency(financials.estimatedCost)})</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium max-w-[180px]" title={project.project_address || project.project_name}>
                              <div className="flex flex-col">
                                {getCustomerName(project) && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {getCustomerName(project)}
                                  </span>
                                )}
                                <span className="truncate">
                                  {project.project_address || project.project_name || "-"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={statusColors[project.project_status || "New Job"] || ""}
                              >
                                {project.project_status || "New Job"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {project.primary_salesperson || "-"} / {project.project_manager || "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              <div>
                                {formatCurrency(financials?.contractsTotal)}
                                {(financials?.upsellsTotal ?? 0) > 0 && (
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    (Upsells: {formatCurrency(financials?.upsellsTotal)})
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {financials?.contractsTotal > 0 ? (
                                <div className="flex items-center justify-end gap-1">
                                  {formatCurrency(financials?.effectiveEstimatedCost)}
                                  {financials?.exceededExpectedCosts && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="h-5 px-1 text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                                          !
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Bills ({formatCurrency(financials.totalBillsReceived)}) exceed estimated costs ({formatCurrency(financials.effectiveEstimatedCost)})</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatCurrency(financials?.totalBillsReceived)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatCurrency(financials?.totalBillsPaid)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-emerald-600">
                              {formatCurrency(financials?.invoicesCollected)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-600">
                              {formatCurrency(financials?.invoiceBalanceDue)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-600">
                              {formatCurrency(financials?.projectBalanceDue)}
                            </TableCell>
                            <TableCell className={`text-right text-xs font-medium ${financials?.contractsTotal > 0 ? ((financials?.expectedFinalProfit || 0) >= 0 ? 'text-emerald-600' : 'text-destructive') : ''}`}>
                              {financials?.contractsTotal > 0 ? formatCurrency(financials?.expectedFinalProfit) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className={`text-right text-xs font-bold ${(() => {
                              const cash = financials?.totalCash || 0;
                              const billsPaid = financials?.totalBillPayments || 0;
                              const collected = financials?.invoicesCollected || 0;
                              
                              // Blank background if cash is zero
                              if (cash === 0) return '';
                              
                              // Calculate ratio: bills paid / collected
                              const ratio = collected > 0 ? billsPaid / collected : 0;
                              
                              // Green if ratio < 70%
                              if (ratio < 0.70) return 'bg-emerald-500/20 text-emerald-700';
                              
                              // Orange if ratio between 70%-85%
                              if (ratio <= 0.85) return 'bg-orange-400/20 text-orange-700';
                              
                              // Red if ratio > 85%
                              return 'bg-red-500/20 text-red-700';
                            })()}`}>
                              {formatCurrency(financials?.totalCash)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTestProject(project);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          )}

          {activeView === 'analytics' && (
            <AnalyticsSection 
              onProjectClick={(projectId) => {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                  handleOpenProject(project);
                }
              }}
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
                    setSelectedProject(project);
                    setPendingBillDialogOpen(true);
                    setDetailSheetOpen(true);
                  }
                  // Clear the return params
                  setSearchParams({ view: 'projects' });
                }
              }}
            />
          )}
        </div>

        {/* Project Detail Sheet */}
        <ProjectDetailSheet
          project={selectedProject}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onUpdate={refetch}
          autoOpenBillDialog={pendingBillDialogOpen}
          onBillDialogOpened={() => setPendingBillDialogOpen(false)}
        />

        {/* New Project Dialog */}
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
        />

        {/* Delete Project Confirmation Dialog */}
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
                  `Archive Project #${projectToDelete?.project_number}?`
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
                      <p>This project has associated records and can only be archived.</p>
                      <p className="mt-2 text-sm">The project data will be preserved but hidden from view. This action is logged in the audit trail.</p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {!checkingRecords && (projectHasRecords === false || (projectToDelete && isTestProject(projectToDelete))) && (
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
      </TooltipProvider>
    </AppLayout>
  );
}
