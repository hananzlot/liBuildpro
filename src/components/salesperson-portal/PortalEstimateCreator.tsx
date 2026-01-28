import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Calculator, ChevronDown, ChevronRight, Loader2, Save, Wand2, 
  FileText, CheckCircle, Clock, DollarSign, Eye, Pencil
} from "lucide-react";

interface PortalEstimateCreatorProps {
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
  const queryClient = useQueryClient();

  // Fetch opportunities assigned to this salesperson
  const { data: opportunities = [], isLoading: oppsLoading } = useQuery({
    queryKey: ["portal-opportunities", companyId, salespersonGhlUserId],
    queryFn: async () => {
      if (!salespersonGhlUserId) return [];
      
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, ghl_id, name, contact_id, scope_of_work, monetary_value, stage_name")
        .eq("company_id", companyId)
        .eq("assigned_to", salespersonGhlUserId)
        .not("stage_name", "ilike", "%lost%")
        .not("stage_name", "ilike", "%abandon%")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Opportunity[];
    },
    enabled: !!companyId && !!salespersonGhlUserId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch projects assigned to this salesperson
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["portal-projects", companyId, salespersonName, salespersonGhlUserId],
    queryFn: async () => {
      // Step 1: Get directly assigned projects
      const { data: directProjects, error: directError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, opportunity_id, opportunity_uuid")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .order("project_number", { ascending: false })
        .limit(50);

      if (directError) throw directError;

      // Step 2: Get projects via opportunity assignment (only if no salesperson assigned)
      let opportunityProjects: Project[] = [];
      
      if (salespersonGhlUserId) {
        const { data: opps } = await supabase
          .from("opportunities")
          .select("id, ghl_id")
          .eq("assigned_to", salespersonGhlUserId);

        if (opps && opps.length > 0) {
          const oppUuids = opps.map(o => o.id);
          const oppGhlIds = opps.map(o => o.ghl_id).filter(Boolean);
          
          const uuidFilters = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(',');
          const ghlIdFilters = oppGhlIds.length ? oppGhlIds.map(id => `opportunity_id.eq.${id}`).join(',') : '';
          const combinedFilter = ghlIdFilters ? `${uuidFilters},${ghlIdFilters}` : uuidFilters;

          const { data: linkedProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, opportunity_id, opportunity_uuid, primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson")
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
  const { data: myEstimates = [], isLoading: estimatesLoading } = useQuery({
    queryKey: ["portal-my-estimates", companyId, salespersonId],
    queryFn: async () => {
      // Fetch estimates
      const { data: estimates, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name, job_address, total, status, created_at")
        .eq("company_id", companyId)
        .eq("salesperson_id", salespersonId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Fetch pending/running generation jobs to show status
      const estimateIds = (estimates || []).map(e => e.id);
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
    enabled: !!companyId && !!salespersonId,
    staleTime: 30 * 1000, // Refresh more frequently to show generation updates
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });

  // When selection changes, pre-fill with existing scope if available
  const handleSelectionChange = (id: string) => {
    setSelectedId(id);
    setScopeSaved(false);
    
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
          .single();
        // Try to get address from custom fields
        const customFields = contact?.custom_fields as Record<string, string> | null;
        if (customFields?.address) jobAddress = customFields.address;
      }
    } else {
      const proj = projects.find(p => p.id === selectedId);
      jobAddress = proj?.project_address || "";
    }

    // Validate address has zip code (basic check for 5 digits)
    const zipRegex = /\b\d{5}(-\d{4})?\b/;
    if (!zipRegex.test(jobAddress)) {
      toast.error(
        "Missing or invalid zip code in the job address. Please update the opportunity/project address with a valid zip code before generating an estimate.",
        { duration: 6000 }
      );
      return;
    }

    setIsRequestingAI(true);
    try {
      // Get customer details from opportunity or project
      let customerName = "";
      let customerEmail = "";
      let customerPhone = "";
      let jobAddress = "";
      let opportunityUuid: string | null = null;
      let opportunityGhlId: string | null = null;
      let contactId: string | null = null;

      if (selectedType === "opportunity") {
        const opp = opportunities.find(o => o.id === selectedId);
        if (opp) {
          opportunityUuid = opp.id;
          opportunityGhlId = opp.ghl_id;
          contactId = opp.contact_id;
          
          // Fetch contact details
          if (contactId) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("contact_name, email, phone")
              .eq("ghl_id", contactId)
              .single();
            
            if (contact) {
              customerName = contact.contact_name || opp.name || "";
              customerEmail = contact.email || "";
              customerPhone = contact.phone || "";
            }
          }
          customerName = customerName || opp.name || "Customer";
        }
      } else {
        const proj = projects.find(p => p.id === selectedId);
        if (proj) {
          customerName = [proj.customer_first_name, proj.customer_last_name].filter(Boolean).join(" ") || proj.project_name || "Customer";
          jobAddress = proj.project_address || "";
          opportunityUuid = proj.opportunity_uuid;
          opportunityGhlId = proj.opportunity_id;
        }
      }

      // Create the estimate record first
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          company_id: companyId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          job_address: jobAddress,
          estimate_title: `Estimate for ${customerName}`,
          estimate_date: new Date().toISOString().split("T")[0],
          status: "draft",
          work_scope_description: workScope.trim(),
          salesperson_name: salespersonName,
          salesperson_id: salespersonId,
          created_by_source: "salesperson_portal",
          opportunity_uuid: opportunityUuid,
          opportunity_id: opportunityGhlId,
          contact_id: contactId,
          show_details_to_customer: false,
          show_scope_to_customer: true,
          show_line_items_to_customer: true,
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Queue the AI generation job
      const { error: queueError } = await supabase
        .from("estimate_generation_jobs")
        .insert({
          company_id: companyId,
          estimate_id: estimate.id,
          status: "pending",
          request_params: {
            job_address: jobAddress,
            customer_name: customerName,
            work_scope: workScope.trim(),
            created_from: "salesperson_portal",
          },
        });

      if (queueError) throw queueError;

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
    <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
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
              </div>
            )}

            {/* My Estimates Section */}
            {myEstimates.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    My Estimates
                  </Label>
                  
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-2">
                      {myEstimates.map(estimate => (
                        <div
                          key={estimate.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
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
                                <p className="text-xs text-muted-foreground truncate">
                                  {estimate.job_address}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                              {estimate.total != null && estimate.total > 0 ? (
                                <p className="font-semibold text-sm text-primary">
                                  ${estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              ) : estimate.is_generating ? (
                                <p className="text-xs text-muted-foreground italic">Processing...</p>
                              ) : (
                                <p className="text-xs text-amber-600">Pending</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(estimate.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {estimatesLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
