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
  StickyNote,
  CalendarCheck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string;
  ghl_id?: string | null;
  name?: string | null;
  contact_id?: string | null;
  contact_uuid?: string | null;
  stage_name?: string | null;
  pipeline_name?: string | null;
  monetary_value?: number | null;
  status?: string | null;
  address?: string | null;
  scope_of_work?: string | null;
  assigned_to?: string | null;
  ghl_date_added?: string | null;
  created_at?: string;
  won_at?: string | null;
}

interface MergeOpportunitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: Opportunity[];
  contacts: any[];
  users: any[];
}

type MergeField = {
  key: keyof Opportunity;
  label: string;
  icon: React.ElementType;
  format?: (value: any) => string;
};

const MERGE_FIELDS: MergeField[] = [
  { key: "name", label: "Opportunity Name", icon: FileText },
  { key: "contact_uuid", label: "Contact", icon: User },
  { key: "address", label: "Address", icon: MapPin },
  { key: "scope_of_work", label: "Scope of Work", icon: FileText },
  { key: "monetary_value", label: "Value", icon: DollarSign, format: (v) => v ? `$${Number(v).toLocaleString()}` : "—" },
  { key: "stage_name", label: "Stage", icon: CheckCircle2 },
  { key: "assigned_to", label: "Assigned To", icon: User },
  { key: "won_at", label: "Won Date", icon: Calendar, format: (v) => v ? format(new Date(v), "MMM d, yyyy") : "—" },
];

export function MergeOpportunitiesDialog({
  open,
  onOpenChange,
  opportunities,
  contacts,
  users,
}: MergeOpportunitiesDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<"select" | "compare">("select");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [oppA, setOppA] = useState<Opportunity | null>(null);
  const [oppB, setOppB] = useState<Opportunity | null>(null);
  const [primary, setPrimary] = useState<"A" | "B">("A");
  const [fieldSelections, setFieldSelections] = useState<Record<string, "A" | "B">>({});
  const [copyFromSecondary, setCopyFromSecondary] = useState<Record<string, boolean>>({});

  // Fetch appointments for selected opportunities
  const { data: appointmentsData } = useQuery({
    queryKey: ["merge-opp-appointments", oppA?.id, oppB?.id, companyId],
    queryFn: async () => {
      if (!oppA && !oppB) return { appointmentsA: [], appointmentsB: [] };
      
      const oppIds = [oppA?.id, oppB?.id].filter(Boolean) as string[];
      const contactIds = [
        oppA?.contact_id, oppB?.contact_id,
        oppA?.contact_uuid, oppB?.contact_uuid
      ].filter(Boolean) as string[];
      
      if (contactIds.length === 0) return { appointmentsA: [], appointmentsB: [] };

      const { data } = await supabase
        .from("appointments")
        .select("id, start_time, title, contact_id, contact_uuid")
        .eq("company_id", companyId)
        .or(contactIds.map(id => `contact_id.eq.${id},contact_uuid.eq.${id}`).join(","))
        .order("start_time", { ascending: true });

      const appointments = data || [];
      
      const matchesOpp = (apt: any, opp: Opportunity | null) => {
        if (!opp) return false;
        return apt.contact_id === opp.contact_id || 
               apt.contact_uuid === opp.contact_uuid ||
               apt.contact_id === opp.contact_uuid ||
               apt.contact_uuid === opp.contact_id;
      };

      return {
        appointmentsA: appointments.filter(a => matchesOpp(a, oppA)),
        appointmentsB: appointments.filter(a => matchesOpp(a, oppB)),
      };
    },
    enabled: open && (!!oppA || !!oppB),
  });

  // Fetch notes for selected opportunities
  const { data: notesData } = useQuery({
    queryKey: ["merge-opp-notes", oppA?.id, oppB?.id, companyId],
    queryFn: async () => {
      if (!oppA && !oppB) return { notesA: [], notesB: [] };
      
      const contactIds = [
        oppA?.contact_id, oppB?.contact_id,
        oppA?.contact_uuid, oppB?.contact_uuid
      ].filter(Boolean) as string[];
      
      if (contactIds.length === 0) return { notesA: [], notesB: [] };

      const { data } = await supabase
        .from("contact_notes")
        .select("id, body, contact_id, contact_uuid, created_at")
        .eq("company_id", companyId)
        .or(contactIds.map(id => `contact_id.eq.${id},contact_uuid.eq.${id}`).join(","))
        .order("created_at", { ascending: false });

      const notes = data || [];
      
      const matchesOpp = (note: any, opp: Opportunity | null) => {
        if (!opp) return false;
        return note.contact_id === opp.contact_id || 
               note.contact_uuid === opp.contact_uuid ||
               note.contact_id === opp.contact_uuid ||
               note.contact_uuid === opp.contact_id;
      };

      return {
        notesA: notes.filter(n => matchesOpp(n, oppA)),
        notesB: notes.filter(n => matchesOpp(n, oppB)),
      };
    },
    enabled: open && (!!oppA || !!oppB),
  });

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select");
      setSearchA("");
      setSearchB("");
      setOppA(null);
      setOppB(null);
      setPrimary("A");
      setFieldSelections({});
      setCopyFromSecondary({});
    }
    onOpenChange(isOpen);
  };

  // Filter opportunities for search
  const filterOpps = (search: string, exclude?: string) => {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return opportunities
      .filter((o) => o.id !== exclude)
      .filter((o) => {
        const name = o.name?.toLowerCase() || "";
        const address = o.address?.toLowerCase() || "";
        const contact = contacts.find(
          (c) => c.id === o.contact_uuid || c.ghl_id === o.contact_id
        );
        const contactName = contact?.contact_name?.toLowerCase() || "";
        return name.includes(lower) || address.includes(lower) || contactName.includes(lower);
      })
      .slice(0, 8);
  };

  const resultsA = useMemo(() => filterOpps(searchA, oppB?.id), [searchA, opportunities, oppB?.id]);
  const resultsB = useMemo(() => filterOpps(searchB, oppA?.id), [searchB, opportunities, oppA?.id]);

  // Get contact name helper
  const getContactName = (opp: Opportunity) => {
    const contact = contacts.find(
      (c) => c.id === opp.contact_uuid || c.ghl_id === opp.contact_id
    );
    return contact?.contact_name || "Unknown";
  };

  // Get user name helper
  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users.find((u) => u.ghl_id === userId || u.id === userId);
    return user?.name || user?.email || userId;
  };

  // Initialize field selections when moving to compare step
  const initializeSelections = () => {
    const selections: Record<string, "A" | "B"> = {};
    MERGE_FIELDS.forEach((field) => {
      // Default to primary, or prefer the one with data
      const valueA = oppA?.[field.key];
      const valueB = oppB?.[field.key];
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
    if (!oppA || !oppB) {
      toast.error("Please select both opportunities to merge");
      return;
    }
    initializeSelections();
    setStep("compare");
  };

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!oppA || !oppB || !companyId) throw new Error("Missing data");

      const primaryOpp = primary === "A" ? oppA : oppB;
      const secondaryOpp = primary === "A" ? oppB : oppA;

      // Build merged data based on field selections
      const mergedData: Record<string, any> = {};
      MERGE_FIELDS.forEach((field) => {
        const selection = fieldSelections[field.key];
        const sourceOpp = selection === "A" ? oppA : oppB;
        if (sourceOpp[field.key] !== undefined) {
          mergedData[field.key] = sourceOpp[field.key];
        }
      });

      // Always keep primary's ghl_id
      mergedData.ghl_id = primaryOpp.ghl_id;
      
      // Use contact from the selected field, not forced from primary
      const contactSource = fieldSelections["contact_uuid"] === "A" ? oppA : oppB;
      mergedData.contact_id = contactSource.contact_id;
      mergedData.contact_uuid = contactSource.contact_uuid;
      mergedData.updated_at = new Date().toISOString();

      // 1. Update the primary opportunity with merged data
      const { error: updateError } = await supabase
        .from("opportunities")
        .update(mergedData)
        .eq("id", primaryOpp.id);

      if (updateError) throw updateError;

      // 2. Transfer related records from secondary to primary
      // Estimates
      await supabase
        .from("estimates")
        .update({
          opportunity_id: primaryOpp.ghl_id,
          opportunity_uuid: primaryOpp.id,
        })
        .eq("opportunity_uuid", secondaryOpp.id);

      // Also update by ghl_id if present
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("estimates")
          .update({
            opportunity_id: primaryOpp.ghl_id,
            opportunity_uuid: primaryOpp.id,
          })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Projects
      await supabase
        .from("projects")
        .update({
          opportunity_id: primaryOpp.ghl_id,
          opportunity_uuid: primaryOpp.id,
        })
        .eq("opportunity_uuid", secondaryOpp.id);

      if (secondaryOpp.ghl_id) {
        await supabase
          .from("projects")
          .update({
            opportunity_id: primaryOpp.ghl_id,
            opportunity_uuid: primaryOpp.id,
          })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Tasks
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("tasks")
          .update({ opportunity_id: primaryOpp.ghl_id })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // Scope submissions
      if (secondaryOpp.ghl_id) {
        await supabase
          .from("scope_submissions")
          .update({ opportunity_id: primaryOpp.ghl_id })
          .eq("opportunity_id", secondaryOpp.ghl_id);
      }

      // 3. Delete the secondary opportunity
      const { error: deleteError } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", secondaryOpp.id);

      if (deleteError) throw deleteError;

      return { primaryId: primaryOpp.id, secondaryId: secondaryOpp.id };
    },
    onSuccess: () => {
      toast.success("Opportunities merged successfully");
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });

  const renderOpportunityCard = (opp: Opportunity, side: "A" | "B") => {
    const isPrimary = primary === side;
    const appointments = side === "A" ? appointmentsData?.appointmentsA : appointmentsData?.appointmentsB;
    const notes = side === "A" ? notesData?.notesA : notesData?.notesB;
    const nextAppointment = appointments?.find(a => a.start_time && new Date(a.start_time) > new Date());
    
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
              {opp.name || "Unnamed"}{" "}
              <span className="text-muted-foreground font-normal text-xs">
                ({opp.id.slice(-4)})
              </span>
            </h4>
            <p className="text-sm text-muted-foreground truncate">
              {getContactName(opp)}
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
          <Badge variant="outline">{opp.stage_name || "No stage"}</Badge>
          {opp.monetary_value && (
            <Badge variant="secondary">
              ${Number(opp.monetary_value).toLocaleString()}
            </Badge>
          )}
        </div>
        {/* Appointment & Notes indicators */}
        <div className="flex flex-wrap gap-2 text-xs">
          {appointments && appointments.length > 0 ? (
            <Badge variant="outline" className="gap-1">
              <CalendarCheck className="h-3 w-3" />
              {appointments.length} appt{appointments.length !== 1 ? "s" : ""}
              {nextAppointment && (
                <span className="text-muted-foreground">
                  • Next: {format(new Date(nextAppointment.start_time), "MMM d")}
                </span>
              )}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              No appointments
            </Badge>
          )}
          {notes && notes.length > 0 ? (
            <Badge variant="outline" className="gap-1">
              <StickyNote className="h-3 w-3" />
              {notes.length} note{notes.length !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              No notes
            </Badge>
          )}
        </div>
        {isPrimary && (
          <p className="text-xs text-primary mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            This opportunity will be kept
          </p>
        )}
      </div>
    );
  };

  const renderFieldComparison = (field: MergeField) => {
    const valueA = oppA?.[field.key];
    const valueB = oppB?.[field.key];
    const displayA = field.format ? field.format(valueA) : (valueA || "—");
    const displayB = field.format ? field.format(valueB) : (valueB || "—");
    const Icon = field.icon;
    const selected = fieldSelections[field.key];

    // Handle assigned_to specially to show names
    let finalDisplayA = field.key === "assigned_to" ? getUserName(valueA as string) : displayA;
    let finalDisplayB = field.key === "assigned_to" ? getUserName(valueB as string) : displayB;
    
    // Handle contact_uuid specially to show contact names
    if (field.key === "contact_uuid") {
      const contactA = contacts.find(c => c.id === oppA?.contact_uuid || c.ghl_id === oppA?.contact_id);
      const contactB = contacts.find(c => c.id === oppB?.contact_uuid || c.ghl_id === oppB?.contact_id);
      finalDisplayA = contactA?.contact_name || contactA?.email || oppA?.contact_uuid || "—";
      finalDisplayB = contactB?.contact_name || contactB?.email || oppB?.contact_uuid || "—";
    }

    // Determine which side is secondary (will be deleted)
    const secondarySide = primary === "A" ? "B" : "A";
    const secondaryValue = secondarySide === "A" ? valueA : valueB;
    const secondaryDisplay = secondarySide === "A" ? finalDisplayA : finalDisplayB;
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
          <p className="text-sm font-medium truncate">{finalDisplayA}</p>
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
          <p className="text-sm font-medium truncate">{finalDisplayB}</p>
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
            Merge Opportunities
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Search and select two opportunities to merge together."
              : "Choose which values to keep for the merged opportunity."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Opportunity A Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">First Opportunity</Label>
              {oppA ? (
                <div className="relative">
                  {renderOpportunityCard(oppA, "A")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setOppA(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, or contact..."
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsA.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsA.map((opp) => (
                        <button
                          key={opp.id}
                          onClick={() => {
                            setOppA(opp);
                            setSearchA("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">
                            {opp.name || "Unnamed"}{" "}
                            <span className="text-muted-foreground font-normal">
                              ({opp.id.slice(-4)})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getContactName(opp)} • {opp.address || "No address"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Opportunity B Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Second Opportunity</Label>
              {oppB ? (
                <div className="relative">
                  {renderOpportunityCard(oppB, "B")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setOppB(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, address, or contact..."
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {resultsB.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {resultsB.map((opp) => (
                        <button
                          key={opp.id}
                          onClick={() => {
                            setOppB(opp);
                            setSearchB("");
                          }}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">
                            {opp.name || "Unnamed"}{" "}
                            <span className="text-muted-foreground font-normal">
                              ({opp.id.slice(-4)})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getContactName(opp)} • {opp.address || "No address"}
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
          <div className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[500px]" style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--border)) transparent' }}>
            <div className="space-y-3 py-4">
              {/* Primary Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                {oppA && renderOpportunityCard(oppA, "A")}
                {oppB && renderOpportunityCard(oppB, "B")}
              </div>

              <Separator />

              {/* Field-by-field comparison */}
              <div>
                <h4 className="font-medium mb-2">Choose values for each field</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on a value to select it for the merged opportunity. Check "Copy to primary" 
                  to transfer a value from the opportunity being deleted.
                </p>
                <div className="space-y-1 divide-y">
                  {MERGE_FIELDS.map(renderFieldComparison)}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All linked records (estimates, projects, tasks) will be transferred to the 
                  primary opportunity. The other opportunity will be permanently deleted.
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
              disabled={!oppA || !oppB}
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
                  Merge Opportunities
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
