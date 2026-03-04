import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Calculator, ChevronDown, ChevronRight, Loader2, Wand2,
  FileText, CheckCircle, Clock, DollarSign, Eye, Pencil, AlertTriangle,
  ChevronUp, Plus, Trash2, FileEdit, Info
} from "lucide-react";
import { PortalEstimateDetailSheet } from "./PortalEstimateDetailSheet";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";

interface PortalEstimateCreatorProps {
  portalToken: string;
  salespersonId: string;
  salespersonName: string;
  salespersonGhlUserId: string | null;
  companyId: string;
}

interface Opportunity {
  id: string;
  ghl_id: string | null;
  name: string | null;
  contact_id: string | null;
  contact_uuid: string | null;
  scope_of_work: string | null;
  monetary_value: number | null;
  stage_name: string | null;
}

interface Project {
  id: string;
  project_number: number | null;
  project_name: string | null;
  project_address: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  cell_phone: string | null;
  opportunity_id: string | null;
  opportunity_uuid: string | null;
  contact_uuid: string | null;
  lead_source: string | null;
}

interface Estimate {
  id: string;
  estimate_number: number;
  estimate_title: string;
  customer_name: string;
  job_address: string | null;
  total: number | null;
  status: string;
  created_at: string;
  estimate_date: string | null;
  opportunity_uuid: string | null;
  is_generating?: boolean;
}

interface ProgressPayment {
  phaseName: string;
  amount: number;
}

export function PortalEstimateCreator({
  portalToken,
  salespersonId,
  salespersonName,
  salespersonGhlUserId,
  companyId,
}: PortalEstimateCreatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<"opportunity" | "project">("opportunity");
  const [selectedId, setSelectedId] = useState<string>("");
  const [workScope, setWorkScope] = useState("");
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [missingZipCode, setMissingZipCode] = useState(false);
  const [manualZipCode, setManualZipCode] = useState("");
  const [currentJobAddress, setCurrentJobAddress] = useState("");
  const [showDeclinedEstimates, setShowDeclinedEstimates] = useState(false);
  const [estimatesExpanded, setEstimatesExpanded] = useState(false);
  const [previewEstimateId, setPreviewEstimateId] = useState<string | null>(null);

  // Project detection & change order state
  const [detectedProjectId, setDetectedProjectId] = useState<string | null>(null);
  const [detectedProjectNumber, setDetectedProjectNumber] = useState<number | null>(null);
  const [isChangeOrder, setIsChangeOrder] = useState(false);

  // Manual estimate state
  const [showManualForm, setShowManualForm] = useState(false);
  const [estimateTotal, setEstimateTotal] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [progressPayments, setProgressPayments] = useState<ProgressPayment[]>([
    { phaseName: "Deposit", amount: 0 },
  ]);
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  const [showOldEstimates, setShowOldEstimates] = useState(false);

  const queryClient = useQueryClient();

  // Fetch opportunities assigned to this salesperson
  const { data: opportunities = [], isLoading: oppsLoading } = useQuery({
    queryKey: ["portal-opportunities", companyId, salespersonId, salespersonGhlUserId],
    queryFn: async () => {
      if (!salespersonId) return [];
      const orConditions: string[] = [
        `salesperson_id.eq.${salespersonId}`,
        `assigned_to.eq.${salespersonId}`,
      ];
      if (salespersonGhlUserId) {
        orConditions.push(`assigned_to.eq.${salespersonGhlUserId}`);
      }
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, ghl_id, name, contact_id, contact_uuid, scope_of_work, monetary_value, stage_name, status")
        .eq("company_id", companyId)
        .eq("status", "open")
        .or(orConditions.join(","))
        .not("stage_name", "ilike", "%lost%")
        .not("stage_name", "ilike", "%abandon%")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Opportunity[];
    },
    enabled: !!companyId && !!salespersonId,
    staleTime: 30 * 1000,
  });

  // Fetch projects assigned to this salesperson
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["portal-projects", companyId, salespersonName, salespersonId, salespersonGhlUserId],
    queryFn: async () => {
      const { data: directProjects, error: directError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, customer_email, cell_phone, opportunity_id, opportunity_uuid, contact_uuid, lead_source")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .order("project_number", { ascending: false })
        .limit(50);
      if (directError) throw directError;

      let opportunityProjects: Project[] = [];
      const oppFilters: string[] = [];
      if (salespersonId) {
        oppFilters.push(`salesperson_id.eq.${salespersonId}`);
        oppFilters.push(`assigned_to.eq.${salespersonId}`);
      }
      if (salespersonGhlUserId) {
        oppFilters.push(`assigned_to.eq.${salespersonGhlUserId}`);
      }
      if (oppFilters.length > 0) {
        const { data: opps } = await supabase
          .from("opportunities")
          .select("id, ghl_id")
          .eq("company_id", companyId)
          .or(oppFilters.join(","));
        if (opps && opps.length > 0) {
          const oppUuids = opps.map(o => o.id);
          const uuidFilters = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(',');
          const { data: linkedProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, opportunity_id, opportunity_uuid, contact_uuid, lead_source, primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .or(uuidFilters);
          opportunityProjects = (linkedProjects || [])
            .filter((p: any) => !p.primary_salesperson && !p.secondary_salesperson && !p.tertiary_salesperson && !p.quaternary_salesperson)
            .map(({ primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, ...rest }: any) => rest) as Project[];
        }
      }

      const projectMap = new Map<string, Project>();
      [...(directProjects || []), ...opportunityProjects].forEach(p => {
        if (!projectMap.has(p.id)) projectMap.set(p.id, p as Project);
      });
      return Array.from(projectMap.values());
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch estimates created by this salesperson
  const {
    data: myEstimates = [],
    isLoading: estimatesLoading,
    isFetching: estimatesFetching,
    error: estimatesError,
    refetch: refetchMyEstimates,
  } = useQuery({
    queryKey: ["portal-my-estimates", companyId, salespersonId, salespersonName],
    queryFn: async () => {
      if (!companyId) return [];
      if (!salespersonId && !salespersonName) return [];
      const orConditions: string[] = [];
      if (salespersonId) orConditions.push(`salesperson_id.eq.${salespersonId}`);
      if (salespersonName) orConditions.push(`salesperson_name.eq.${salespersonName}`);

      const { data: estimates, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, status, created_at, estimate_date, opportunity_uuid")
        .eq("company_id", companyId)
        .or(orConditions.join(","))
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!estimates || estimates.length === 0) return [] as Estimate[];

      const estimateIds = estimates.map((e) => e.id);
      const { data: jobs } = await supabase
        .from("estimate_generation_jobs")
        .select("estimate_id, status")
        .in("estimate_id", estimateIds)
        .in("status", ["pending", "running"]);

      const generatingIds = new Set((jobs || []).map(j => j.estimate_id));
      return (estimates || []).map(e => ({
        ...e,
        is_generating: generatingIds.has(e.id),
      })) as Estimate[];
    },
    enabled: !!companyId && !!(salespersonId || salespersonName),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  // Fetch lost opportunity UUIDs
  const { data: lostOpportunityIds = [] } = useQuery({
    queryKey: ["portal-lost-opportunities", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("opportunities")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "lost");
      return (data || []).map(o => o.id);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const declinedEstimatesCount = useMemo(() => myEstimates.filter(e => e.status === "declined").length, [myEstimates]);
  const nonLostEstimates = useMemo(() => {
    return myEstimates.filter(e => !e.opportunity_uuid || !lostOpportunityIds.includes(e.opportunity_uuid));
  }, [myEstimates, lostOpportunityIds]);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isOldDraft = useCallback((e: Estimate) => {
    if (e.status !== "draft") return false;
    const dateStr = e.estimate_date || e.created_at;
    return Date.now() - new Date(dateStr).getTime() > THIRTY_DAYS_MS;
  }, []);

  const oldEstimates = useMemo(() => nonLostEstimates.filter(e => isOldDraft(e) && e.status !== "declined"), [nonLostEstimates, isOldDraft]);
  const visibleEstimates = useMemo(() => {
    if (showDeclinedEstimates) return nonLostEstimates.filter(e => e.status === "declined");
    return nonLostEstimates.filter(e => e.status !== "declined" && !isOldDraft(e));
  }, [nonLostEstimates, showDeclinedEstimates, isOldDraft]);

  // Check for existing project when opportunity is selected
  const checkForExistingProject = useCallback(async (opportunityId: string) => {
    const { data: existingProjects } = await supabase
      .from("projects")
      .select("id, project_number, project_name")
      .eq("opportunity_uuid", opportunityId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("project_status", "in", '("Completed","Cancelled")')
      .limit(1);

    if (existingProjects && existingProjects.length > 0) {
      const proj = existingProjects[0];
      setDetectedProjectId(proj.id);
      setDetectedProjectNumber(proj.project_number);
      toast.info(`This customer already has Project #${proj.project_number} on file. Linking estimate to existing project.`);

      // Check for signed contract on this project
      await checkForSignedContract(proj.id);
    } else {
      setDetectedProjectId(null);
      setDetectedProjectNumber(null);
      setIsChangeOrder(false);
    }
  }, [companyId]);

  const checkForSignedContract = useCallback(async (projId: string) => {
    const { data: agreements } = await supabase
      .from("project_agreements")
      .select("id")
      .eq("project_id", projId)
      .eq("agreement_type", "Contract")
      .limit(1);

    if (agreements && agreements.length > 0) {
      setIsChangeOrder(true);
    } else {
      setIsChangeOrder(false);
    }
  }, []);

  // When selecting a project directly, check for signed contract
  useEffect(() => {
    if (selectedType === "project" && selectedId) {
      setDetectedProjectId(selectedId);
      const proj = projects.find(p => p.id === selectedId);
      setDetectedProjectNumber(proj?.project_number || null);
      checkForSignedContract(selectedId);
    }
  }, [selectedType, selectedId, projects, checkForSignedContract]);

  const handleSelectionChange = async (id: string) => {
    setSelectedId(id);
    setMissingZipCode(false);
    setManualZipCode("");
    setCurrentJobAddress("");
    setShowManualForm(false);
    setDetectedProjectId(null);
    setDetectedProjectNumber(null);
    setIsChangeOrder(false);

    if (selectedType === "opportunity") {
      const opp = opportunities.find(o => o.id === id);
      if (opp?.scope_of_work) {
        setWorkScope(opp.scope_of_work);
      } else {
        setWorkScope("");
      }
      // Check for existing project linked to this opportunity
      await checkForExistingProject(id);
    } else {
      setWorkScope("");
    }
  };


  // Resolve customer details from selection
  const resolveCustomerDetails = async () => {
    let customerName = "";
    let customerEmail = "";
    let customerPhone = "";
    let opportunityUuid: string | null = null;
    let contactUuid: string | null = null;
    let leadSource: string | null = null;
    let jobAddress = "";

    if (selectedType === "opportunity") {
      const opp = opportunities.find(o => o.id === selectedId);
      if (opp) {
        opportunityUuid = opp.id;
        contactUuid = opp.contact_uuid || null;

        // Fetch contact details by UUID
        if (opp.contact_uuid) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("id, contact_name, email, phone, source, custom_fields")
            .eq("id", opp.contact_uuid)
            .maybeSingle();
          if (contact) {
            customerName = contact.contact_name || opp.name || "";
            customerEmail = contact.email || "";
            customerPhone = contact.phone || "";
            leadSource = contact.source || null;
            contactUuid = contact.id;
            // Try to get address from custom fields
            const cf = contact.custom_fields as Record<string, string> | null;
            if (cf?.address) jobAddress = cf.address;
          }
        } else if (opp.contact_id) {
          // Fallback: lookup by ghl_id
          const { data: contact } = await supabase
            .from("contacts")
            .select("id, contact_name, email, phone, source, custom_fields")
            .eq("ghl_id", opp.contact_id)
            .maybeSingle();
          if (contact) {
            customerName = contact.contact_name || opp.name || "";
            customerEmail = contact.email || "";
            customerPhone = contact.phone || "";
            leadSource = contact.source || null;
            contactUuid = contact.id;
            const cf = contact.custom_fields as Record<string, string> | null;
            if (cf?.address) jobAddress = cf.address;
          }
        }
        customerName = customerName || opp.name || "Customer";
      }
    } else {
      const proj = projects.find(p => p.id === selectedId);
      if (proj) {
        customerName = [proj.customer_first_name, proj.customer_last_name].filter(Boolean).join(" ") || proj.project_name || "Customer";
        customerEmail = proj.customer_email || "";
        customerPhone = proj.cell_phone || "";
        opportunityUuid = proj.opportunity_uuid;
        contactUuid = proj.contact_uuid || null;
        leadSource = proj.lead_source || null;
        jobAddress = proj.project_address || "";
      }
    }

    // If there's a detected project, use its address if we don't have one
    if (!jobAddress && detectedProjectId) {
      const proj = projects.find(p => p.id === detectedProjectId);
      if (proj?.project_address) jobAddress = proj.project_address;
    }

    return { customerName, customerEmail, customerPhone, opportunityUuid, contactUuid, leadSource, jobAddress };
  };

  // Request AI estimate
  const handleRequestAIEstimate = async () => {
    if (!selectedId || !workScope.trim()) {
      toast.error("Please enter a work scope first");
      return;
    }

    setIsRequestingAI(true);
    try {
      const details = await resolveCustomerDetails();
      let jobAddress = details.jobAddress;

      if (manualZipCode.trim()) {
        jobAddress = jobAddress ? `${jobAddress} ${manualZipCode.trim()}` : manualZipCode.trim();
      }

      const zipRegex = /\b\d{5}(-\d{4})?\b/;
      if (!zipRegex.test(jobAddress)) {
        setCurrentJobAddress(jobAddress);
        setMissingZipCode(true);
        setIsRequestingAI(false);
        return;
      }
      setMissingZipCode(false);
      setManualZipCode("");

      if (!portalToken) {
        toast.error("This portal link is missing a token.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-portal-estimate", {
        body: {
          portalToken,
          companyId,
          salespersonId,
          salespersonName,
          customerName: details.customerName,
          customerEmail: details.customerEmail,
          customerPhone: details.customerPhone,
          jobAddress,
          workScope: workScope.trim(),
          opportunityUuid: details.opportunityUuid,
          contactUuid: details.contactUuid,
          projectId: detectedProjectId,
          leadSource: details.leadSource,
          isChangeOrder,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(isChangeOrder
        ? "AI change order generation queued!"
        : "AI estimate generation queued!"
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["portal-my-estimates"] });
    } catch (error) {
      console.error("Error requesting AI estimate:", error);
      toast.error("Failed to request AI estimate");
    } finally {
      setIsRequestingAI(false);
    }
  };

  // Create manual estimate
  const handleCreateManualEstimate = async () => {
    if (!selectedId || !workScope.trim()) {
      toast.error("Please enter a work scope first");
      return;
    }
    if (estimateTotal <= 0) {
      toast.error("Estimate total must be greater than zero");
      return;
    }

    const paymentsTotal = progressPayments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentsTotal - estimateTotal) > 0.01) {
      toast.error("Progress payments must add up to the estimate total");
      return;
    }

    setIsCreatingManual(true);
    try {
      const details = await resolveCustomerDetails();
      let jobAddress = details.jobAddress || "N/A";

      if (!portalToken) {
        toast.error("This portal link is missing a token.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-portal-estimate", {
        body: {
          portalToken,
          companyId,
          salespersonId,
          salespersonName,
          customerName: details.customerName,
          customerEmail: details.customerEmail,
          customerPhone: details.customerPhone,
          jobAddress,
          workScope: workScope.trim(),
          opportunityUuid: details.opportunityUuid,
          contactUuid: details.contactUuid,
          projectId: detectedProjectId,
          leadSource: details.leadSource,
          isManual: true,
          estimateTotal,
          estimatedCost,
          progressPayments: progressPayments.filter(p => p.phaseName.trim()),
          isChangeOrder,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(isChangeOrder ? "Change order created!" : "Estimate created!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["portal-my-estimates"] });
    } catch (error) {
      console.error("Error creating manual estimate:", error);
      toast.error("Failed to create estimate");
    } finally {
      setIsCreatingManual(false);
    }
  };

  const resetForm = () => {
    setSelectedId("");
    setWorkScope("");
    setShowManualForm(false);
    setEstimateTotal(0);
    setEstimatedCost(0);
    setProgressPayments([{ phaseName: "Deposit", amount: 0 }]);
    setDetectedProjectId(null);
    setDetectedProjectNumber(null);
    setIsChangeOrder(false);
  };

  const addProgressPayment = () => {
    if (progressPayments.length >= 10) return;
    setProgressPayments([...progressPayments, { phaseName: "", amount: 0 }]);
  };

  const removeProgressPayment = (idx: number) => {
    setProgressPayments(progressPayments.filter((_, i) => i !== idx));
  };

  const updateProgressPayment = (idx: number, field: keyof ProgressPayment, value: string | number) => {
    setProgressPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const paymentsTotal = progressPayments.reduce((s, p) => s + p.amount, 0);
  const paymentsDifference = estimateTotal - paymentsTotal;
  const paymentsBalanced = Math.abs(paymentsDifference) < 0.01;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
      case "sent": return <Badge className="bg-blue-100 text-blue-700 text-[10px]">Sent</Badge>;
      case "signed": return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Signed</Badge>;
      case "declined": return <Badge variant="destructive" className="text-[10px]">Declined</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const cardTitle = isChangeOrder ? "Create Change Order" : "Create Estimate";
  const aiButtonLabel = isChangeOrder ? "Prepare Change Order by AI" : "Prepare with AI";
  const manualButtonLabel = isChangeOrder ? "Prepare Change Order Manually" : "Prepare Manually";
  const submitLabel = isChangeOrder ? "Create Change Order" : "Create Estimate";

  return (
    <>
      <Card className="border border-border/50 shadow-md rounded-xl">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 pt-4 px-4 cursor-pointer bg-gradient-to-r from-primary/5 to-transparent hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {isChangeOrder ? <FileEdit className="h-5 w-5 text-primary" /> : <Calculator className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {cardTitle}
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5">
                        <Wand2 className="h-2.5 w-2.5 mr-0.5" />
                        AI
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Build estimates with AI or manually</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-3 pb-4 px-4 space-y-4">
              {/* Step 1: Select Opportunity or Project */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">1. Select Opportunity or Project</Label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedType === "opportunity" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSelectedType("opportunity"); resetForm(); }}
                    className="flex-1"
                  >
                    Opportunity
                  </Button>
                  <Button
                    variant={selectedType === "project" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSelectedType("project"); resetForm(); }}
                    className="flex-1"
                  >
                    Project
                  </Button>
                </div>

                <Select value={selectedId} onValueChange={handleSelectionChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Select ${selectedType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedType === "opportunity" ? (
                      oppsLoading ? (
                        <div className="p-2 text-center text-muted-foreground text-sm">Loading...</div>
                      ) : opportunities.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground text-sm">No opportunities assigned</div>
                      ) : (
                        opportunities.map(opp => (
                          <SelectItem key={opp.id} value={opp.id}>
                            <div className="flex flex-col">
                              <span>{opp.name || "Unnamed"}</span>
                              {opp.stage_name && <span className="text-xs text-muted-foreground">{opp.stage_name}</span>}
                            </div>
                          </SelectItem>
                        ))
                      )
                    ) : (
                      projectsLoading ? (
                        <div className="p-2 text-center text-muted-foreground text-sm">Loading...</div>
                      ) : projects.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground text-sm">No projects assigned</div>
                      ) : (
                        projects.map(proj => (
                          <SelectItem key={proj.id} value={proj.id}>
                            <div className="flex flex-col">
                              <span>#{proj.project_number} - {proj.project_name || "Unnamed"}</span>
                              {proj.project_address && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{proj.project_address}</span>}
                            </div>
                          </SelectItem>
                        ))
                      )
                    )}
                  </SelectContent>
                </Select>

                {/* Project detection alert */}
                {detectedProjectId && selectedType === "opportunity" && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-sm">
                      Project #{detectedProjectNumber} already exists for this customer.
                      {isChangeOrder && " A signed contract was found — this will be created as a Change Order."}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Change order alert for project selection */}
                {isChangeOrder && selectedType === "project" && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <FileEdit className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-sm">
                      A signed contract exists on this project. This will be created as a <strong>Change Order</strong>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Step 2: Work Scope */}
              {selectedId && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    2. Work Scope Description
                  </Label>
                  <Textarea
                    value={workScope}
                    onChange={(e) => setWorkScope(e.target.value)}
                    placeholder="Describe the work in detail: scope, materials, measurements, special requirements..."
                    rows={5}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Step 3: Choose AI or Manual */}
              {selectedId && workScope.trim().length >= 5 && !showManualForm && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">3. How would you like to prepare?</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleRequestAIEstimate}
                      disabled={isRequestingAI}
                      className="flex-1"
                    >
                      {isRequestingAI ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                      {aiButtonLabel}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualForm(true)}
                      className="flex-1"
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      {manualButtonLabel}
                    </Button>
                  </div>
                </div>
              )}

              {/* Missing Zip Code Warning */}
              {missingZipCode && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <div className="space-y-3">
                      <p className="font-medium">Missing zip code in job address</p>
                      {currentJobAddress && <p className="text-sm opacity-80">Current address: {currentJobAddress || "(empty)"}</p>}
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="Enter 5-digit zip code"
                          value={manualZipCode}
                          onChange={(e) => setManualZipCode(e.target.value.replace(/[^0-9-]/g, "").slice(0, 10))}
                          className="h-8 w-36 bg-background"
                          maxLength={10}
                        />
                        <Button size="sm" variant="secondary" onClick={handleRequestAIEstimate}
                          disabled={!manualZipCode.trim() || !/^\d{5}(-\d{4})?$/.test(manualZipCode.trim())}
                        >
                          <Wand2 className="h-3.5 w-3.5 mr-1" />
                          Retry
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setMissingZipCode(false); setManualZipCode(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Manual Estimate Form */}
              {showManualForm && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Manual Estimate Details</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>
                      Cancel
                    </Button>
                  </div>

                  {/* Estimate Total */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Estimate Total Price ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimateTotal || ""}
                      onChange={(e) => setEstimateTotal(parseFloat(e.target.value) || 0)}
                      placeholder="Enter total estimate amount"
                      className="h-9"
                    />
                  </div>

                  {/* Estimated Costs */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Estimated Costs ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedCost || ""}
                      onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                      placeholder="Your estimated cost for this job"
                      className="h-9"
                    />
                  </div>

                  <Separator />

                  {/* Progress Payments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Progress Payments</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addProgressPayment}
                        disabled={progressPayments.length >= 10}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>

                    {progressPayments.map((payment, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={payment.phaseName}
                          onChange={(e) => updateProgressPayment(idx, "phaseName", e.target.value)}
                          placeholder="Phase name"
                          className="h-8 text-sm flex-1"
                        />
                        <div className="relative w-32">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payment.amount || ""}
                            onChange={(e) => updateProgressPayment(idx, "amount", parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm pl-6"
                          />
                        </div>
                        {progressPayments.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeProgressPayment(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {/* Payments total & validation */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Payments Total:</span>
                      <span className={paymentsBalanced ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                        ${paymentsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {!paymentsBalanced && estimateTotal > 0 && (
                      <Alert className="border-amber-200 bg-amber-50 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <AlertDescription className="text-amber-800 text-xs ml-1">
                          {paymentsDifference > 0
                            ? `$${paymentsDifference.toFixed(2)} remaining to allocate`
                            : `$${Math.abs(paymentsDifference).toFixed(2)} over the estimate total`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCreateManualEstimate}
                    disabled={isCreatingManual || estimateTotal <= 0 || !paymentsBalanced}
                  >
                    {isCreatingManual ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
                    {submitLabel}
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        {/* My Estimates Section */}
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setEstimatesExpanded(!estimatesExpanded)}>
            <Label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <FileText className="h-4 w-4" />
              My Estimates ({visibleEstimates.length})
            </Label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm"
                onClick={(e) => { e.stopPropagation(); refetchMyEstimates(); }}
                disabled={estimatesFetching} className="h-7 px-2" title="Refresh"
              >
                {estimatesFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">Refresh</span>}
              </Button>
              {estimatesExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {estimatesExpanded && (
            <>
              {declinedEstimatesCount > 0 && (
                <div className="flex items-center gap-2 pb-1">
                  <Switch id="show-declined-estimates" checked={showDeclinedEstimates} onCheckedChange={setShowDeclinedEstimates} className="scale-90" />
                  <Label htmlFor="show-declined-estimates" className="text-xs text-muted-foreground cursor-pointer">Show declined ({declinedEstimatesCount})</Label>
                </div>
              )}

              {estimatesError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="ml-2">Couldn't load your estimates. Tap Refresh to try again.</AlertDescription>
                </Alert>
              ) : estimatesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : visibleEstimates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {showDeclinedEstimates ? "No declined estimates." : "No estimates found yet."}
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {visibleEstimates.map((estimate) => {
                    const canOpen = !estimate.is_generating;
                    return (
                      <button
                        type="button"
                        key={estimate.id}
                        className={`w-full text-left p-3 rounded-lg border bg-card transition-colors ${canOpen ? "hover:bg-muted/50 hover:border-primary/30" : "opacity-70"}`}
                        onClick={() => { if (canOpen) { setSelectedEstimateId(estimate.id); setDetailSheetOpen(true); } }}
                        disabled={!canOpen}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">#{estimate.estimate_number}</span>
                              {getStatusBadge(estimate.status)}
                              {estimate.is_generating && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  Generating
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground truncate mt-0.5">{estimate.customer_name}</p>
                            {estimate.job_address && <p className="text-xs text-muted-foreground truncate max-w-full">{estimate.job_address}</p>}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1 sm:gap-1 mt-1 sm:mt-0 shrink-0">
                            {estimate.total != null && estimate.total > 0 ? (
                              <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                                <p className="font-semibold text-sm text-primary whitespace-nowrap">
                                  ${estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                                  onClick={(e) => { e.stopPropagation(); setPreviewEstimateId(estimate.id); }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            ) : estimate.is_generating ? (
                              <p className="text-xs text-muted-foreground italic">Processing...</p>
                            ) : (
                              <p className="text-xs text-amber-600">Pending</p>
                            )}
                            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(estimate.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Old Estimates */}
              {oldEstimates.length > 0 && (
                <div className="border-t border-border/30 pt-2">
                  <button type="button" className="flex items-center gap-2 w-full text-left px-1 py-1" onClick={() => setShowOldEstimates(!showOldEstimates)}>
                    {showOldEstimates ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">Old Estimates ({oldEstimates.length})</span>
                  </button>
                  {showOldEstimates && (
                    <div className="space-y-2 mt-1 max-h-[300px] overflow-y-auto">
                      {oldEstimates.map((estimate) => {
                        const canOpen = !estimate.is_generating;
                        return (
                          <button
                            type="button"
                            key={estimate.id}
                            className={`w-full text-left p-3 rounded-lg border bg-card opacity-70 transition-colors ${canOpen ? "hover:bg-muted/50 hover:border-primary/30" : ""}`}
                            onClick={() => { if (canOpen) { setSelectedEstimateId(estimate.id); setDetailSheetOpen(true); } }}
                            disabled={!canOpen}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">#{estimate.estimate_number}</span>
                                  {getStatusBadge(estimate.status)}
                                </div>
                                <p className="text-sm text-foreground truncate">{estimate.customer_name}</p>
                              </div>
                              {estimate.total != null && estimate.total > 0 && (
                                <span className="font-semibold text-sm text-primary whitespace-nowrap">
                                  ${estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Estimate Detail Sheet */}
      <PortalEstimateDetailSheet
        estimateId={selectedEstimateId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        companyId={companyId}
      />

      {/* PDF Preview Dialog */}
      <EstimatePreviewDialog
        estimateId={previewEstimateId}
        open={!!previewEstimateId}
        onOpenChange={(open) => { if (!open) setPreviewEstimateId(null); }}
      />
    </>
  );
}
