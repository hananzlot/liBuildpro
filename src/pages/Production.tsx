import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/hooks/useAuditLog";
import { 
  ArrowLeft, 
  Building2, 
  Search, 
  Plus, 
  Filter,
  ChevronDown,
  User,
  Key,
  LogOut,
  FlaskConical,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  BarChart3,
  FolderKanban
} from "lucide-react";
import { Link } from "react-router-dom";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ProjectDetailSheet } from "@/components/production/ProjectDetailSheet";
import { NewProjectDialog } from "@/components/production/NewProjectDialog";
import { AnalyticsSection } from "@/components/production/AnalyticsSection";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  phasesTotal: number;
  hasPhaseMismatch: boolean;
  hasContractMismatch: boolean;
  hasMissingContract: boolean;
  hasMissingPhases: boolean;
  estimatedCost: number | null;
  projectBalanceDue: number;
  profitToDate: number;
  totalCommission: number;
  expectedFinalProfit: number;
  totalCash: number;
}

type SortColumn = 'project_number' | 'address' | 'status' | 'salesperson' | 'project_manager' | 'sold_amount' | 'bills_received' | 'bills_paid' | 'inv_collected' | 'inv_balance' | 'proj_balance' | 'commission' | 'expected_profit' | 'total_cash';
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
  const { user, profile, isAdmin, signOut, updatePassword } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [deleteTestProjectOpen, setDeleteTestProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('project_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [warningSheetOpen, setWarningSheetOpen] = useState(false);
  const [warningSheetType, setWarningSheetType] = useState<'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<string>("projects");

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, lead_cost_percent, commission_split_pct, primary_commission_pct, secondary_commission_pct, tertiary_commission_pct, quaternary_commission_pct, deleted_at")
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
      })[];
    },
  });

  // Fetch all financial data for projects
  const { data: allAgreements = [] } = useQuery({
    queryKey: ["all-project-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_agreements")
        .select("id, project_id, total_price");
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

    // Check if contracts total matches estimated cost (only when both exist and differ)
    const hasContractMismatch = project.estimated_cost !== null && 
      project.estimated_cost > 0 && 
      contractsTotal > 0 &&
      contractsTotal !== project.estimated_cost;

    const phasesTotal = projectPhases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const projectBalanceDue = contractsTotal - invoicesCollected;
    const profitToDate = invoicesCollected - totalBillsPaid;
    
    // Calculate commission based on formula: (Total Contracts - Lead Cost - Bills) * Split%
    const leadCostPercent = project.lead_cost_percent ?? 18;
    const commissionSplitPct = project.commission_split_pct ?? 50;
    const leadCostAmount = contractsTotal * (leadCostPercent / 100);
    const profit = contractsTotal - leadCostAmount - totalBillsReceived;
    const totalCommission = profit > 0 ? profit * (commissionSplitPct / 100) : 0;
    
    // Expected Final Profit = Total Contracts - Lead Cost - Bills - Commission
    const expectedFinalProfit = contractsTotal - leadCostAmount - totalBillsReceived - totalCommission;
    
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
      phasesTotal,
      hasPhaseMismatch,
      hasContractMismatch,
      hasMissingContract,
      hasMissingPhases,
      estimatedCost: project.estimated_cost,
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

  // Delete project mutation - soft delete for regular projects, hard delete only for "Test" projects
  const deleteProjectMutation = useMutation({
    mutationFn: async (project: Project) => {
      const isTestProject = project.project_name?.toLowerCase().includes("test");
      
      if (isTestProject) {
        // Hard delete for test projects
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
          description: `Permanently deleted test project #${project.project_number} - ${project.project_name}`,
        });

        // Delete related records in order (child tables first)
        await supabase.from("project_payment_phases").delete().eq("project_id", project.id);
        await supabase.from("project_checklists").delete().eq("project_id", project.id);
        await supabase.from("project_messages").delete().eq("project_id", project.id);
        await supabase.from("project_cases").delete().eq("project_id", project.id);
        await supabase.from("project_feedback").delete().eq("project_id", project.id);
        await supabase.from("project_documents").delete().eq("project_id", project.id);
        await supabase.from("project_commissions").delete().eq("project_id", project.id);
        await supabase.from("project_bills").delete().eq("project_id", project.id);
        await supabase.from("project_payments").delete().eq("project_id", project.id);
        await supabase.from("project_invoices").delete().eq("project_id", project.id);
        await supabase.from("project_finance").delete().eq("project_id", project.id);
        await supabase.from("project_agreements").delete().eq("project_id", project.id);
        
        const { error } = await supabase.from("projects").delete().eq("id", project.id);
        if (error) throw error;
      } else {
        // Soft delete for regular projects
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
    onSuccess: () => {
      const isTestProject = projectToDelete?.project_name?.toLowerCase().includes("test");
      toast.success(isTestProject ? "Test project permanently deleted" : "Project archived");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTestProjectOpen(false);
      setProjectToDelete(null);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  const handleDeleteTestProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteTestProjectOpen(true);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setChangePasswordOpen(false);
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsChangingPassword(false);
    }
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

  const totalWarnings = warningCounts.missingContract + warningCounts.missingPhases + warningCounts.phaseMismatch + warningCounts.contractMismatch;

  // Get projects with specific warning type
  const getWarningProjects = useCallback((type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch') => {
    return projects.filter(p => {
      const f = projectFinancials[p.id];
      if (!f) return false;
      switch (type) {
        case 'missingContract': return f.hasMissingContract;
        case 'missingPhases': return f.hasMissingPhases;
        case 'phaseMismatch': return f.hasPhaseMismatch;
        case 'contractMismatch': return f.hasContractMismatch;
      }
    });
  }, [projects, projectFinancials]);

  const handleOpenWarningSheet = (type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch') => {
    setWarningSheetType(type);
    setWarningSheetOpen(true);
  };

  const warningSheetTitle = {
    missingContract: 'Missing Contract',
    missingPhases: 'Missing Payment Phases',
    phaseMismatch: 'Phase Amount Mismatch',
    contractMismatch: 'Contract vs Estimate Mismatch',
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-6 w-6" />
                  Production
                </h1>
                <p className="text-sm text-muted-foreground">Project Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{profile?.full_name || user?.email}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/audit-log">
                          <History className="h-4 w-4 mr-2" />
                          View Audit Log
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-8 py-6 space-y-6">
          {/* Main Tabs */}
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-6 space-y-6">
              {/* KPI Cards */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Projects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{totalProjects}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>In Progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-amber-500">{inProgressProjects}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Completed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-emerald-500">{completedProjects}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Sold</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{formatCurrency(filteredFinancialsTotal)}</p>
                  </CardContent>
                </Card>
              </section>

          {/* Financial Warnings Summary */}
          {totalWarnings > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Financial Warnings</CardTitle>
                </div>
                <CardDescription>Projects requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {warningCounts.missingContract > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                      onClick={() => handleOpenWarningSheet('missingContract')}
                    >
                      <Badge variant="outline" className="mr-2 h-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0">
                        C
                      </Badge>
                      No Contract: {warningCounts.missingContract}
                    </Button>
                  )}
                  {warningCounts.missingPhases > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
                      onClick={() => handleOpenWarningSheet('missingPhases')}
                    >
                      <Badge variant="outline" className="mr-2 h-5 px-1.5 text-[10px] bg-orange-500 text-white border-0">
                        P
                      </Badge>
                      No Phases: {warningCounts.missingPhases}
                    </Button>
                  )}
                  {warningCounts.phaseMismatch > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                      onClick={() => handleOpenWarningSheet('phaseMismatch')}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                      Phase Mismatch: {warningCounts.phaseMismatch}
                    </Button>
                  )}
                  {warningCounts.contractMismatch > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20"
                      onClick={() => handleOpenWarningSheet('contractMismatch')}
                    >
                      <Badge variant="outline" className="mr-2 h-5 px-1.5 text-[10px] bg-red-500 text-white border-0">
                        $
                      </Badge>
                      Estimate Mismatch: {warningCounts.contractMismatch}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
                          <div className="flex items-center">Salesperson <SortIcon column="salesperson" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('project_manager')}>
                          <div className="flex items-center">Proj Mgr <SortIcon column="project_manager" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('sold_amount')}>
                          <div className="flex items-center justify-end">Sold Amt <SortIcon column="sold_amount" /></div>
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
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('commission')}>
                          <div className="flex items-center justify-end">Commission <SortIcon column="commission" /></div>
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
                            <TableCell className="text-xs">{project.primary_salesperson || "-"}</TableCell>
                            <TableCell className="text-xs">{project.project_manager || "-"}</TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              {formatCurrency(financials?.contractsTotal)}
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
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatCurrency(financials?.totalCommission)}
                            </TableCell>
                            <TableCell className={`text-right text-xs font-medium ${(financials?.expectedFinalProfit || 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {formatCurrency(financials?.expectedFinalProfit)}
                            </TableCell>
                            <TableCell className={`text-right text-xs font-bold bg-primary/5 ${(financials?.totalCash || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
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
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <AnalyticsSection 
                onProjectClick={(projectId) => {
                  const project = projects.find(p => p.id === projectId);
                  if (project) {
                    handleOpenProject(project);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </main>

        {/* Project Detail Sheet */}
        <ProjectDetailSheet
          project={selectedProject}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onUpdate={refetch}
        />

        {/* New Project Dialog */}
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
        />

        {/* Change Password Dialog */}
        <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>Enter your new password below.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                {isChangingPassword ? "Updating..." : "Update Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Project Confirmation Dialog */}
        <AlertDialog open={deleteTestProjectOpen} onOpenChange={setDeleteTestProjectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {projectToDelete?.project_name?.toLowerCase().includes("test") 
                  ? `Permanently Delete Test Project #${projectToDelete?.project_number}?`
                  : `Archive Project #${projectToDelete?.project_number}?`
                }
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {projectToDelete?.project_name?.toLowerCase().includes("test") ? (
                    <>
                      <p>This will <strong>permanently delete</strong> the test project "{projectToDelete?.project_name}" and ALL associated records including:</p>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        <li>Invoices, Payments, and Bills</li>
                        <li>Agreements and Commissions</li>
                        <li>Documents and Checklists</li>
                        <li>Messages and Feedback</li>
                      </ul>
                      <span className="block mt-2 font-medium text-destructive">This action cannot be undone.</span>
                    </>
                  ) : (
                    <>
                      <p>This will archive project "{projectToDelete?.project_name}" and remove it from the dashboard.</p>
                      <p className="mt-2 text-sm">The project data will be preserved but hidden from view. This action is logged in the audit trail.</p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => projectToDelete && deleteProjectMutation.mutate(projectToDelete)}
                className={projectToDelete?.project_name?.toLowerCase().includes("test") 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
                }
                disabled={deleteProjectMutation.isPending}
              >
                {deleteProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {projectToDelete?.project_name?.toLowerCase().includes("test") ? "Deleting..." : "Archiving..."}
                  </>
                ) : (
                  projectToDelete?.project_name?.toLowerCase().includes("test") ? "Delete Permanently" : "Archive Project"
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
      </div>
    </TooltipProvider>
  );
}
