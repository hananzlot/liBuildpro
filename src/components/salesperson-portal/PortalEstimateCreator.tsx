import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { 
  Calculator, ChevronDown, ChevronRight, Loader2, Save, Wand2, 
  FileText, CheckCircle, Clock, DollarSign, Eye, Pencil, AlertTriangle
} from "lucide-react";
import { PortalEstimateDetailSheet } from "./PortalEstimateDetailSheet";

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
  is_generating?: boolean;
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
  const [isSavingScope, setIsSavingScope] = useState(false);
  const [scopeSaved, setScopeSaved] = useState(false);
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [missingZipCode, setMissingZipCode] = useState(false);
  const [manualZipCode, setManualZipCode] = useState("");
  const [currentJobAddress, setCurrentJobAddress] = useState("");
  const queryClient = useQueryClient();

  // Fetch opportunities assigned to this salesperson (by internal ID or GHL user ID)
  const { data: opportunities = [], isLoading: oppsLoading } = useQuery({
    queryKey: ["portal-opportunities", companyId, salespersonId, salespersonGhlUserId],
    queryFn: async () => {
      if (!salespersonId) return [];
      
      // Build OR filter: match salesperson_id (UUID) OR assigned_to (UUID or GHL user ID)
      // Format: "salesperson_id.eq.UUID,assigned_to.eq.UUID,assigned_to.eq.GHL_ID"
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

      if (error) {
        console.error("[PortalEstimateCreator] Error fetching opportunities:", error);
        throw error;
      }
      
      console.log("[PortalEstimateCreator] Fetched opportunities:", data?.length, "for salesperson:", salespersonId);
      return (data || []) as Opportunity[];
    },
    enabled: !!companyId && !!salespersonId,
    staleTime: 30 * 1000, // Refresh more frequently to catch new assignments
  });

  // Fetch projects assigned to this salesperson
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["portal-projects", companyId, salespersonName, salespersonId, salespersonGhlUserId],
    queryFn: async () => {
      // Step 1: Get directly assigned projects
      const { data: directProjects, error: directError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, opportunity_id, opportunity_uuid, contact_uuid, lead_source")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .order("project_number", { ascending: false })
        .limit(50);

      if (directError) throw directError;

      // Step 2: Get projects via opportunity assignment (only if no salesperson assigned)
      let opportunityProjects: Project[] = [];
      
      // Fetch opportunities by salesperson_id OR assigned_to (UUID or GHL user ID)
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
          const oppGhlIds = opps.map(o => o.ghl_id).filter(Boolean);
          
          const uuidFilters = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(',');
          const ghlIdFilters = oppGhlIds.length ? oppGhlIds.map(id => `opportunity_id.eq.${id}`).join(',') : '';
          const combinedFilter = ghlIdFilters ? `${uuidFilters},${ghlIdFilters}` : uuidFilters;

          const { data: linkedProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, opportunity_id, opportunity_uuid, contact_uuid, lead_source, primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .or(combinedFilter);

          opportunityProjects = (linkedProjects || [])
            .filter((p: { primary_salesperson: string | null; secondary_salesperson: string | null; tertiary_salesperson: string | null; quaternary_salesperson: string | null }) => 
              !p.primary_salesperson && 
              !p.secondary_salesperson && 
              !p.tertiary_salesperson && 
              !p.quaternary_salesperson
            )
            .map(({ primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, ...rest }) => rest) as Project[];
        }
      }

      // Merge and deduplicate
      const projectMap = new Map<string, Project>();
      [...(directProjects || []), ...opportunityProjects].forEach(p => {
        if (!projectMap.has(p.id)) {
          projectMap.set(p.id, p as Project);
        }
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

      // Build OR filter to match by salesperson_id OR salesperson_name
      // This handles both old records (with only name) and new records (with UUID)
      const orConditions: string[] = [];
      if (salespersonId) {
        orConditions.push(`salesperson_id.eq.${salespersonId}`);
      }
      if (salespersonName) {
        orConditions.push(`salesperson_name.eq.${salespersonName}`);
      }

      // Fetch estimates
      const { data: estimates, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, status, created_at")
        .eq("company_id", companyId)
        .or(orConditions.join(","))
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // If there are no estimates, avoid running an empty `.in()` query (can error in PostgREST)
      if (!estimates || estimates.length === 0) {
        return [] as Estimate[];
      }
      
      // Fetch pending/running generation jobs to show status
      const estimateIds = estimates.map((e) => e.id);
      const { data: jobs, error: jobsError } = await supabase
        .from("estimate_generation_jobs")
        .select("estimate_id, status")
        .in("estimate_id", estimateIds)
        .in("status", ["pending", "running"]);

      if (jobsError) throw jobsError;
      
      const generatingIds = new Set((jobs || []).map(j => j.estimate_id));
      
      return (estimates || []).map(e => ({
        ...e,
        is_generating: generatingIds.has(e.id),
      })) as Estimate[];
    },
    enabled: !!companyId && !!(salespersonId || salespersonName),
    staleTime: 30 * 1000, // Refresh more frequently to show generation updates
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });

  // When selection changes, pre-fill with existing scope if available
  const handleSelectionChange = (id: string) => {
    setSelectedId(id);
    setScopeSaved(false);
    setMissingZipCode(false);
    setManualZipCode("");
    setCurrentJobAddress("");
    
    if (selectedType === "opportunity") {
      const opp = opportunities.find(o => o.id === id);
      if (opp?.scope_of_work) {
        setWorkScope(opp.scope_of_work);
      } else {
        setWorkScope("");
      }
    } else {
      setWorkScope("");
    }
  };

  // Save work scope to opportunity
  const handleSaveScope = async () => {
    if (!selectedId || !workScope.trim()) {
      toast.error("Please select an item and enter a work scope");
      return;
    }

    setIsSavingScope(true);
    try {
      if (selectedType === "opportunity") {
        // Save to opportunity via edge function
        const opp = opportunities.find(o => o.id === selectedId);
        if (opp?.ghl_id) {
          const { error } = await supabase.functions.invoke("update-opportunity-scope", {
            body: {
              opportunityGhlId: opp.ghl_id,
              scopeOfWork: workScope.trim(),
              editedBy: salespersonName,
              companyId,
            },
          });
          if (error) throw error;
        } else {
          // Direct update if no GHL ID
          const { error } = await supabase
            .from("opportunities")
            .update({ scope_of_work: workScope.trim(), updated_at: new Date().toISOString() })
            .eq("id", selectedId);
          if (error) throw error;
        }
      }
      
      setScopeSaved(true);
      toast.success("Work scope saved!");
      queryClient.invalidateQueries({ queryKey: ["portal-opportunities"] });
    } catch (error) {
      console.error("Error saving scope:", error);
      toast.error("Failed to save work scope");
    } finally {
      setIsSavingScope(false);
    }
  };

  // Request AI estimate generation
  const handleRequestAIEstimate = async () => {
    if (!selectedId || !workScope.trim()) {
      toast.error("Please save the work scope first");
      return;
    }

    // Get job address to validate
    let jobAddress = "";
    if (selectedType === "opportunity") {
      const opp = opportunities.find(o => o.id === selectedId);
      if (opp?.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("custom_fields")
          .eq("ghl_id", opp.contact_id)
          .maybeSingle();
        // Try to get address from custom fields
        const customFields = contact?.custom_fields as Record<string, string> | null;
        if (customFields?.address) jobAddress = customFields.address;
      }
    } else {
      const proj = projects.find(p => p.id === selectedId);
      jobAddress = proj?.project_address || "";
    }

    // If user provided a manual zip code, append it to the address
    if (manualZipCode.trim()) {
      jobAddress = jobAddress ? `${jobAddress} ${manualZipCode.trim()}` : manualZipCode.trim();
    }

    // Validate address has zip code (basic check for 5 digits)
    const zipRegex = /\b\d{5}(-\d{4})?\b/;
    if (!zipRegex.test(jobAddress)) {
      setCurrentJobAddress(jobAddress);
      setMissingZipCode(true);
      return;
    }

    // Clear zip code warning if validation passes
    setMissingZipCode(false);
    setManualZipCode("");

    // Store the validated job address with zip code
    const finalJobAddress = jobAddress;

    setIsRequestingAI(true);
    try {
      // Get customer details from opportunity or project
      let customerName = "";
      let customerEmail = "";
      let customerPhone = "";
      let opportunityUuid: string | null = null;
      let opportunityGhlId: string | null = null;
      let contactId: string | null = null;
      let contactUuid: string | null = null;
      let leadSource: string | null = null;

      if (selectedType === "opportunity") {
        const opp = opportunities.find(o => o.id === selectedId);
        if (opp) {
          opportunityUuid = opp.id;
          opportunityGhlId = opp.ghl_id;
          contactId = opp.contact_id;
          contactUuid = opp.contact_uuid || null;
          
          // Fetch contact details including source
          if (contactId || contactUuid) {
            const contactQuery = supabase
              .from("contacts")
              .select("id, contact_name, email, phone, source");
            
            if (contactUuid) {
              contactQuery.eq("id", contactUuid);
            } else if (contactId) {
              contactQuery.eq("ghl_id", contactId);
            }
            
            const { data: contact } = await contactQuery.maybeSingle();
            
            if (contact) {
              customerName = contact.contact_name || opp.name || "";
              customerEmail = contact.email || "";
              customerPhone = contact.phone || "";
              leadSource = contact.source || null;
              contactUuid = contact.id;
            }
          }
          customerName = customerName || opp.name || "Customer";
        }
      } else {
        const proj = projects.find(p => p.id === selectedId);
        if (proj) {
          customerName = [proj.customer_first_name, proj.customer_last_name].filter(Boolean).join(" ") || proj.project_name || "Customer";
          opportunityUuid = proj.opportunity_uuid;
          opportunityGhlId = proj.opportunity_id;
          contactUuid = proj.contact_uuid || null;
          leadSource = proj.lead_source || null;
        }
      }

      // Create the estimate record first
      if (!portalToken) {
        toast.error("This portal link is missing a token. Please reopen the portal link.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-portal-estimate", {
        body: {
          portalToken,
          companyId,
          salespersonId,
          salespersonName,
          customerName,
          customerEmail,
          customerPhone,
          jobAddress: finalJobAddress,
          workScope: workScope.trim(),
          opportunityUuid,
          opportunityGhlId,
          contactId,
          contactUuid,
          leadSource,
        },
      });

      if (error) throw error;

      // If function returns a partial error, surface it
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("AI estimate generation queued! You'll see the estimate in your list once complete.");
      
      // Reset form
      setSelectedId("");
      setWorkScope("");
      setScopeSaved(false);
      
      // Refresh estimates list
      queryClient.invalidateQueries({ queryKey: ["portal-my-estimates"] });
    } catch (error) {
      console.error("Error requesting AI estimate:", error);
      toast.error("Failed to request AI estimate");
    } finally {
      setIsRequestingAI(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-700 text-[10px]">Sent</Badge>;
      case "signed":
        return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Signed</Badge>;
      case "declined":
        return <Badge variant="destructive" className="text-[10px]">Declined</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const selectedItem = selectedType === "opportunity" 
    ? opportunities.find(o => o.id === selectedId)
    : projects.find(p => p.id === selectedId);

  return (
    <>
      <Card className="border border-border/50 shadow-md rounded-xl">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 pt-4 px-4 cursor-pointer bg-gradient-to-r from-primary/5 to-transparent hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    Create Estimate
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5">
                      <Wand2 className="h-2.5 w-2.5 mr-0.5" />
                      AI
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Build estimates with AI assistance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {myEstimates.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {myEstimates.length} estimates
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
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
                  onClick={() => {
                    setSelectedType("opportunity");
                    setSelectedId("");
                    setWorkScope("");
                    setScopeSaved(false);
                  }}
                  className="flex-1"
                >
                  Opportunity
                </Button>
                <Button
                  variant={selectedType === "project" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedType("project");
                    setSelectedId("");
                    setWorkScope("");
                    setScopeSaved(false);
                  }}
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
                            {opp.stage_name && (
                              <span className="text-xs text-muted-foreground">{opp.stage_name}</span>
                            )}
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
                            {proj.project_address && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{proj.project_address}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Enter Work Scope */}
            {selectedId && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  2. Work Scope Description
                  {scopeSaved && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                      Saved
                    </Badge>
                  )}
                </Label>
                
                <Textarea
                  value={workScope}
                  onChange={(e) => {
                    setWorkScope(e.target.value);
                    setScopeSaved(false);
                  }}
                  placeholder="Describe the work in detail: scope, materials, measurements, special requirements..."
                  rows={5}
                  className="resize-none"
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveScope}
                    disabled={isSavingScope || !workScope.trim()}
                    className="flex-1"
                  >
                    {isSavingScope ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1.5" />
                    )}
                    Save Scope
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={handleRequestAIEstimate}
                    disabled={isRequestingAI || !workScope.trim()}
                    className="flex-1"
                  >
                    {isRequestingAI ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-1.5" />
                    )}
                    Create AI Estimate
                  </Button>
                </div>

                {/* Missing Zip Code Warning */}
                {missingZipCode && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="ml-2">
                      <div className="space-y-3">
                        <p className="font-medium">
                          Missing zip code in job address
                        </p>
                        {currentJobAddress && (
                          <p className="text-sm opacity-80">
                            Current address: {currentJobAddress || "(empty)"}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="Enter 5-digit zip code"
                            value={manualZipCode}
                            onChange={(e) => setManualZipCode(e.target.value.replace(/[^0-9-]/g, "").slice(0, 10))}
                            className="h-8 w-36 bg-background"
                            maxLength={10}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleRequestAIEstimate}
                            disabled={!manualZipCode.trim() || !/^\d{5}(-\d{4})?$/.test(manualZipCode.trim())}
                          >
                            <Wand2 className="h-3.5 w-3.5 mr-1" />
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMissingZipCode(false);
                              setManualZipCode("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* My Estimates Section - Always visible outside collapsible */}
      <div className="border-t border-border/50 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            My Estimates ({myEstimates.length})
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetchMyEstimates()}
            disabled={estimatesFetching}
            className="h-7 px-2"
            title="Refresh"
          >
            {estimatesFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-xs">Refresh</span>
            )}
          </Button>
        </div>

        {estimatesError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              Couldn’t load your estimates. Tap Refresh to try again.
            </AlertDescription>
          </Alert>
        ) : estimatesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : myEstimates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No estimates found yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {myEstimates.map((estimate) => {
              const canOpen = !estimate.is_generating;
              return (
                <button
                  type="button"
                  key={estimate.id}
                  className={`w-full text-left p-3 rounded-lg border bg-card transition-colors ${
                    canOpen ? "hover:bg-muted/50 hover:border-primary/30" : "opacity-70"
                  }`}
                  onClick={() => {
                    if (canOpen) {
                      setSelectedEstimateId(estimate.id);
                      setDetailSheetOpen(true);
                    }
                  }}
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
                          <p className="text-sm text-foreground truncate mt-0.5">
                            {estimate.customer_name}
                          </p>
                          {estimate.job_address && (
                            <p className="text-xs text-muted-foreground truncate max-w-full">
                              {estimate.job_address}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1 sm:gap-1 mt-1 sm:mt-0 shrink-0">
                          {estimate.total != null && estimate.total > 0 ? (
                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                              <p className="font-semibold text-sm text-primary whitespace-nowrap">
                                ${estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                View
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
      </div>
    </Card>
      {/* Estimate Detail Sheet */}
      <PortalEstimateDetailSheet
        estimateId={selectedEstimateId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        companyId={companyId}
      />
    </>
  );
}
