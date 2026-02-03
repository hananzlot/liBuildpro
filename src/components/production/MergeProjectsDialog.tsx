import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search,
  Merge,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  User,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  Building,
  Phone,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  project_number: number;
  project_name: string | null;
  project_status: string | null;
  project_address: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  cell_phone: string | null;
  primary_salesperson: string | null;
  project_manager: string | null;
  estimated_cost: number | null;
  opportunity_id?: string | null;
  opportunity_uuid?: string | null;
  contact_id?: string | null;
  contact_uuid?: string | null;
  agreement_signed_date?: string | null;
  created_at?: string;
}

interface MergeProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  preselectedProjects?: { projectA: Project; projectB: Project };
}

type MergeField = {
  key: keyof Project;
  label: string;
  icon: React.ElementType;
  format?: (value: any) => string;
};

const MERGE_FIELDS: MergeField[] = [
  { key: "project_name", label: "Project Name", icon: FileText },
  { key: "project_address", label: "Address", icon: MapPin },
  { key: "customer_first_name", label: "First Name", icon: User },
  { key: "customer_last_name", label: "Last Name", icon: User },
  { key: "customer_email", label: "Email", icon: Mail },
  { key: "cell_phone", label: "Phone", icon: Phone },
  { key: "primary_salesperson", label: "Salesperson", icon: User },
  { key: "project_manager", label: "Project Manager", icon: Building },
  { key: "project_status", label: "Status", icon: CheckCircle2 },
  { key: "estimated_cost", label: "Estimated Cost", icon: DollarSign, format: (v) => v ? `$${Number(v).toLocaleString()}` : "—" },
  { key: "agreement_signed_date", label: "Signed Date", icon: Calendar, format: (v) => v ? format(new Date(v), "MMM d, yyyy") : "—" },
];

export function MergeProjectsDialog({
  open,
  onOpenChange,
  projects,
  preselectedProjects,
}: MergeProjectsDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<"select" | "compare">("select");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [projectA, setProjectA] = useState<Project | null>(null);
  const [projectB, setProjectB] = useState<Project | null>(null);
  const [primary, setPrimary] = useState<"A" | "B">("A");
  const [fieldSelections, setFieldSelections] = useState<Record<string, "A" | "B">>({});
  const [copyFromSecondary, setCopyFromSecondary] = useState<Record<string, boolean>>({});

  // Set preselected projects when they're provided
  useEffect(() => {
    if (preselectedProjects && open) {
      setProjectA(preselectedProjects.projectA);
      setProjectB(preselectedProjects.projectB);
    }
  }, [preselectedProjects, open]);

  // Fetch related records counts
  const { data: relatedCounts } = useQuery({
    queryKey: ["merge-project-related", projectA?.id, projectB?.id, companyId],
    queryFn: async () => {
      if (!projectA && !projectB) return { countsA: {}, countsB: {} };

      const getCounts = async (projectId: string) => {
        const [agreementsRes, phasesRes, billsRes, documentsRes, estimatesRes] = await Promise.all([
          supabase.from("project_agreements").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("project_payment_phases").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("project_bills").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("project_documents").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("estimates").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        ]);

        return {
          agreements: agreementsRes.count || 0,
          phases: phasesRes.count || 0,
          bills: billsRes.count || 0,
          documents: documentsRes.count || 0,
          estimates: estimatesRes.count || 0,
        };
      };

      return {
        countsA: projectA ? await getCounts(projectA.id) : {},
        countsB: projectB ? await getCounts(projectB.id) : {},
      };
    },
    enabled: open && (!!projectA || !!projectB),
  });

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select");
      setSearchA("");
      setSearchB("");
      setProjectA(null);
      setProjectB(null);
      setPrimary("A");
      setFieldSelections({});
      setCopyFromSecondary({});
    }
    onOpenChange(isOpen);
  };

  // Filter projects for search
  const filterProjects = (search: string, exclude?: string) => {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return projects
      .filter((p) => p.id !== exclude)
      .filter((p) => {
        const name = p.project_name?.toLowerCase() || "";
        const address = p.project_address?.toLowerCase() || "";
        const customer = `${p.customer_first_name || ""} ${p.customer_last_name || ""}`.toLowerCase();
        const number = String(p.project_number);
        return name.includes(lower) || address.includes(lower) || customer.includes(lower) || number.includes(lower);
      })
      .slice(0, 8);
  };

  const resultsA = useMemo(() => filterProjects(searchA, projectB?.id), [searchA, projects, projectB?.id]);
  const resultsB = useMemo(() => filterProjects(searchB, projectA?.id), [searchB, projects, projectA?.id]);

  // Get customer name helper
  const getCustomerName = (project: Project) => {
    return `${project.customer_first_name || ""} ${project.customer_last_name || ""}`.trim() || "Unknown";
  };

  // Initialize field selections when moving to compare step
  const initializeSelections = () => {
    const selections: Record<string, "A" | "B"> = {};
    MERGE_FIELDS.forEach((field) => {
      const valueA = projectA?.[field.key];
      const valueB = projectB?.[field.key];
      const aHasValue = valueA !== null && valueA !== undefined && valueA !== "";
      const bHasValue = valueB !== null && valueB !== undefined && valueB !== "";

      if (aHasValue && !bHasValue) {
        selections[field.key] = "A";
      } else if (!aHasValue && bHasValue) {
        selections[field.key] = "B";
      } else {
        selections[field.key] = primary;
      }
    });
    setFieldSelections(selections);
  };

  const handleProceedToCompare = () => {
    if (!projectA || !projectB) {
      toast.error("Please select both projects to merge");
      return;
    }
    initializeSelections();
    setStep("compare");
  };

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!projectA || !projectB || !companyId) throw new Error("Missing data");

      const primaryProject = primary === "A" ? projectA : projectB;
      const secondaryProject = primary === "A" ? projectB : projectA;

      // Build merged data based on field selections
      const mergedData: Record<string, any> = {};
      MERGE_FIELDS.forEach((field) => {
        const selection = fieldSelections[field.key];
        const sourceProject = selection === "A" ? projectA : projectB;
        if (sourceProject[field.key] !== undefined) {
          mergedData[field.key] = sourceProject[field.key];
        }
      });

      // Keep primary's IDs
      mergedData.project_number = primaryProject.project_number;
      mergedData.opportunity_id = primaryProject.opportunity_id || secondaryProject.opportunity_id;
      mergedData.opportunity_uuid = primaryProject.opportunity_uuid || secondaryProject.opportunity_uuid;
      mergedData.contact_id = primaryProject.contact_id || secondaryProject.contact_id;
      mergedData.contact_uuid = primaryProject.contact_uuid || secondaryProject.contact_uuid;
      mergedData.updated_at = new Date().toISOString();

      // 1. Update the primary project with merged data
      const { error: updateError } = await supabase
        .from("projects")
        .update(mergedData)
        .eq("id", primaryProject.id);

      if (updateError) throw updateError;

      // 2. Transfer related records from secondary to primary
      // Agreements
      await supabase
        .from("project_agreements")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Payment Phases
      await supabase
        .from("project_payment_phases")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Bills
      await supabase
        .from("project_bills")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Documents
      await supabase
        .from("project_documents")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Estimates
      await supabase
        .from("estimates")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Portal Tokens
      await supabase
        .from("client_portal_tokens")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Portal View Logs
      await supabase
        .from("portal_view_logs")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Project Notes
      await supabase
        .from("project_notes")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Commission Payments
      await supabase
        .from("commission_payments")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // Client Comments
      await supabase
        .from("client_comments")
        .update({ project_id: primaryProject.id })
        .eq("project_id", secondaryProject.id);

      // 3. Soft delete the secondary project
      const { error: deleteError } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", secondaryProject.id);

      if (deleteError) throw deleteError;

      return { primaryId: primaryProject.id, secondaryId: secondaryProject.id };
    },
    onSuccess: () => {
      toast.success("Projects merged successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });

  const renderProjectCard = (project: Project, side: "A" | "B") => {
    const isPrimary = primary === side;
    const counts = side === "A" ? relatedCounts?.countsA : relatedCounts?.countsB;

    return (
      <div
        className={cn(
          "p-4 rounded-lg border-2 transition-all",
          isPrimary
            ? "border-primary bg-primary/5"
            : "border-muted bg-muted/30"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">
              #{project.project_number} - {project.project_name || "Unnamed"}
            </h4>
            <p className="text-sm text-muted-foreground truncate">
              {getCustomerName(project)}
            </p>
          </div>
          <Button
            variant={isPrimary ? "default" : "outline"}
            size="sm"
            onClick={() => setPrimary(side)}
            className="shrink-0"
          >
            {isPrimary ? "Primary" : "Set Primary"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs mb-2">
          <Badge variant="outline">{project.project_status || "No status"}</Badge>
          {project.primary_salesperson && (
            <Badge variant="secondary">{project.primary_salesperson}</Badge>
          )}
        </div>
        {project.project_address && (
          <p className="text-xs text-muted-foreground truncate mb-2">
            <MapPin className="inline h-3 w-3 mr-1" />
            {project.project_address}
          </p>
        )}
        {/* Related records indicators */}
        {counts && Object.keys(counts).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {(counts as any).agreements > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {(counts as any).agreements} agreement{(counts as any).agreements !== 1 ? "s" : ""}
              </Badge>
            )}
            {(counts as any).bills > 0 && (
              <Badge variant="outline" className="gap-1">
                <DollarSign className="h-3 w-3" />
                {(counts as any).bills} bill{(counts as any).bills !== 1 ? "s" : ""}
              </Badge>
            )}
            {(counts as any).documents > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {(counts as any).documents} doc{(counts as any).documents !== 1 ? "s" : ""}
              </Badge>
            )}
            {(counts as any).estimates > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {(counts as any).estimates} estimate{(counts as any).estimates !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
        {isPrimary && (
          <p className="text-xs text-primary mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            This project will be kept
          </p>
        )}
      </div>
    );
  };

  const renderFieldComparison = (field: MergeField) => {
    const valueA = projectA?.[field.key];
    const valueB = projectB?.[field.key];
    const displayA = field.format ? field.format(valueA) : (valueA ?? "—");
    const displayB = field.format ? field.format(valueB) : (valueB ?? "—");
    const Icon = field.icon;
    const selected = fieldSelections[field.key];

    const secondarySide = primary === "A" ? "B" : "A";
    const secondaryValue = secondarySide === "A" ? valueA : valueB;
    const hasSecondaryValue = secondaryValue !== null && secondaryValue !== undefined && secondaryValue !== "";
    const isCopyEnabled = copyFromSecondary[field.key] ?? false;

    return (
      <div key={field.key} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-1.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFieldSelections((prev) => ({ ...prev, [field.key]: "A" }))}
          onKeyDown={(e) => e.key === "Enter" && setFieldSelections((prev) => ({ ...prev, [field.key]: "A" }))}
          className={cn(
            "p-2 rounded-lg border text-left transition-all cursor-pointer",
            selected === "A"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-muted hover:border-primary/50"
          )}
        >
          <p className="text-sm font-medium truncate">{displayA}</p>
          {primary === "B" && hasSecondaryValue && (
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                id={`copy-${field.key}-A`}
                checked={isCopyEnabled}
                onCheckedChange={(checked) => {
                  setCopyFromSecondary(prev => ({ ...prev, [field.key]: !!checked }));
                  if (checked) {
                    setFieldSelections(prev => ({ ...prev, [field.key]: "A" }));
                  }
                }}
              />
              <label
                htmlFor={`copy-${field.key}-A`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Copy to primary
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground text-center">{field.label}</span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setFieldSelections((prev) => ({ ...prev, [field.key]: "B" }))}
          onKeyDown={(e) => e.key === "Enter" && setFieldSelections((prev) => ({ ...prev, [field.key]: "B" }))}
          className={cn(
            "p-2 rounded-lg border text-left transition-all cursor-pointer",
            selected === "B"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-muted hover:border-primary/50"
          )}
        >
          <p className="text-sm font-medium truncate">{displayB}</p>
          {primary === "A" && hasSecondaryValue && (
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                id={`copy-${field.key}-B`}
                checked={isCopyEnabled}
                onCheckedChange={(checked) => {
                  setCopyFromSecondary(prev => ({ ...prev, [field.key]: !!checked }));
                  if (checked) {
                    setFieldSelections(prev => ({ ...prev, [field.key]: "B" }));
                  }
                }}
              />
              <label
                htmlFor={`copy-${field.key}-B`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Copy to primary
              </label>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Projects
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Search and select two projects to merge together."
              : "Choose which values to keep for the merged project."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Project A Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">First Project</Label>
              {projectA ? (
                <div className="relative">
                  {renderProjectCard(projectA, "A")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setProjectA(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, customer, or #..."
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsA.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsA.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setProjectA(project);
                            setSearchA("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">
                            #{project.project_number} - {project.project_name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getCustomerName(project)} • {project.project_address || "No address"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Project B Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Second Project</Label>
              {projectB ? (
                <div className="relative">
                  {renderProjectCard(projectB, "B")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setProjectB(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, customer, or #..."
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsB.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsB.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setProjectB(project);
                            setSearchB("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">
                            #{project.project_number} - {project.project_name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getCustomerName(project)} • {project.project_address || "No address"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[500px]" style={{ scrollbarWidth: "auto", scrollbarColor: "hsl(var(--border)) transparent" }}>
            <div className="space-y-3 py-4">
              {/* Primary Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                {projectA && renderProjectCard(projectA, "A")}
                {projectB && renderProjectCard(projectB, "B")}
              </div>

              <Separator />

              {/* Field-by-field comparison */}
              <div>
                <h4 className="font-medium mb-2">Choose values for each field</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on a value to select it for the merged project. Check "Copy to primary"
                  to transfer a value from the project being archived.
                </p>
                <div className="space-y-1 divide-y">
                  {MERGE_FIELDS.map(renderFieldComparison)}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All linked records (agreements, bills, documents, estimates) will be transferred to the
                  primary project. The other project will be archived (soft deleted).
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "compare" && (
            <Button variant="outline" onClick={() => setStep("select")}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {step === "select" ? (
            <Button
              onClick={handleProceedToCompare}
              disabled={!projectA || !projectB}
            >
              Compare & Merge
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
              variant="destructive"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-1" />
                  Merge Projects
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
