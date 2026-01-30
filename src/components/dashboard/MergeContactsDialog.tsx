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
  Phone,
  Mail,
  MapPin,
  FileText,
  StickyNote,
  CalendarCheck,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { cn, extractCustomField, CUSTOM_FIELD_IDS } from "@/lib/utils";

interface Contact {
  id: string;
  ghl_id?: string | null;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[] | null;
  custom_fields?: any;
  ghl_date_added?: string | null;
  created_at?: string;
}

interface MergeContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  opportunities: any[];
  appointments: any[];
  preselectedContacts?: { contactA: Contact; contactB: Contact };
}

type MergeField = {
  key: keyof Contact | "address" | "scope_of_work" | "notes";
  label: string;
  icon: React.ElementType;
  isCustomField?: boolean;
  customFieldId?: string;
};

const MERGE_FIELDS: MergeField[] = [
  { key: "contact_name", label: "Name", icon: User },
  { key: "email", label: "Email", icon: Mail },
  { key: "phone", label: "Phone", icon: Phone },
  { key: "source", label: "Source", icon: Briefcase },
  { key: "address", label: "Address", icon: MapPin, isCustomField: true, customFieldId: CUSTOM_FIELD_IDS.ADDRESS },
  { key: "scope_of_work", label: "Scope of Work", icon: FileText, isCustomField: true, customFieldId: CUSTOM_FIELD_IDS.SCOPE_OF_WORK },
  { key: "notes", label: "Notes", icon: StickyNote, isCustomField: true, customFieldId: CUSTOM_FIELD_IDS.NOTES },
];

export function MergeContactsDialog({
  open,
  onOpenChange,
  contacts,
  opportunities,
  appointments,
  preselectedContacts,
}: MergeContactsDialogProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<"select" | "compare">("select");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [contactA, setContactA] = useState<Contact | null>(null);
  const [contactB, setContactB] = useState<Contact | null>(null);
  const [primary, setPrimary] = useState<"A" | "B">("A");
  const [fieldSelections, setFieldSelections] = useState<Record<string, "A" | "B">>({});

  // Set preselected contacts when they're provided
  useEffect(() => {
    if (preselectedContacts && open) {
      setContactA(preselectedContacts.contactA);
      setContactB(preselectedContacts.contactB);
    }
  }, [preselectedContacts, open]);

  // Fetch related data counts for selected contacts
  const { data: relatedCounts } = useQuery({
    queryKey: ["merge-contact-counts", contactA?.id, contactB?.id, companyId],
    queryFn: async () => {
      if (!contactA && !contactB) return { opportunitiesA: 0, opportunitiesB: 0, appointmentsA: 0, appointmentsB: 0, notesA: 0, notesB: 0 };
      
      const countForContact = async (contact: Contact | null) => {
        if (!contact) return { opportunities: 0, appointments: 0, notes: 0 };
        
        // Count opportunities
        const { count: oppCount } = await supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id}`);
        
        // Count appointments
        const { count: aptCount } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id}`);
        
        // Count notes
        const { count: noteCount } = await supabase
          .from("contact_notes")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id}`);
        
        return { opportunities: oppCount || 0, appointments: aptCount || 0, notes: noteCount || 0 };
      };

      const [countsA, countsB] = await Promise.all([
        countForContact(contactA),
        countForContact(contactB),
      ]);

      return {
        opportunitiesA: countsA.opportunities,
        appointmentsA: countsA.appointments,
        notesA: countsA.notes,
        opportunitiesB: countsB.opportunities,
        appointmentsB: countsB.appointments,
        notesB: countsB.notes,
      };
    },
    enabled: open && (!!contactA || !!contactB),
  });

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("select");
      setSearchA("");
      setSearchB("");
      setContactA(null);
      setContactB(null);
      setPrimary("A");
      setFieldSelections({});
    }
    onOpenChange(newOpen);
  };

  // Filter contacts for search
  const filterContacts = (search: string, exclude?: string) => {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return contacts
      .filter((c) => c.id !== exclude)
      .filter((c) => {
        const name = c.contact_name?.toLowerCase() || "";
        const email = c.email?.toLowerCase() || "";
        const phone = c.phone?.replace(/\D/g, "") || "";
        const searchPhone = search.replace(/\D/g, "");
        return name.includes(lower) || email.includes(lower) || (searchPhone && phone.includes(searchPhone));
      })
      .slice(0, 8);
  };

  const resultsA = useMemo(() => filterContacts(searchA, contactB?.id), [searchA, contacts, contactB?.id]);
  const resultsB = useMemo(() => filterContacts(searchB, contactA?.id), [searchB, contacts, contactA?.id]);

  // Get field value from contact (including custom fields)
  const getFieldValue = (contact: Contact | null, field: MergeField): string | null => {
    if (!contact) return null;
    if (field.isCustomField && field.customFieldId) {
      return extractCustomField(contact.custom_fields, field.customFieldId);
    }
    return (contact as any)[field.key] || null;
  };

  // Initialize field selections when moving to compare step
  const initializeSelections = () => {
    const selections: Record<string, "A" | "B"> = {};
    MERGE_FIELDS.forEach((field) => {
      const valueA = getFieldValue(contactA, field);
      const valueB = getFieldValue(contactB, field);
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
    if (!contactA || !contactB) {
      toast.error("Please select both contacts to merge");
      return;
    }
    initializeSelections();
    setStep("compare");
  };

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!contactA || !contactB || !companyId) throw new Error("Missing data");

      const primaryContact = primary === "A" ? contactA : contactB;
      const secondaryContact = primary === "A" ? contactB : contactA;

      // Build merged data based on field selections
      const mergedData: Record<string, any> = {};
      const mergedCustomFields: Array<{ id: string; value: string }> = [];

      MERGE_FIELDS.forEach((field) => {
        const selection = fieldSelections[field.key];
        const sourceContact = selection === "A" ? contactA : contactB;
        const value = getFieldValue(sourceContact, field);
        
        if (field.isCustomField && field.customFieldId && value) {
          mergedCustomFields.push({ id: field.customFieldId, value });
        } else if (!field.isCustomField && value !== undefined) {
          mergedData[field.key] = value;
        }
      });

      // Set custom_fields as merged array
      if (mergedCustomFields.length > 0) {
        mergedData.custom_fields = mergedCustomFields;
      }

      // Keep primary's identifiers
      mergedData.ghl_id = primaryContact.ghl_id;
      mergedData.updated_at = new Date().toISOString();

      // 1. Update the primary contact with merged data
      const { error: updateError } = await supabase
        .from("contacts")
        .update(mergedData)
        .eq("id", primaryContact.id);

      if (updateError) throw updateError;

      // 2. Transfer related records from secondary to primary
      // Opportunities
      await supabase
        .from("opportunities")
        .update({
          contact_id: primaryContact.ghl_id,
          contact_uuid: primaryContact.id,
        })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${secondaryContact.id},contact_id.eq.${secondaryContact.ghl_id}`);

      // Appointments
      await supabase
        .from("appointments")
        .update({
          contact_id: primaryContact.ghl_id,
          contact_uuid: primaryContact.id,
        })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${secondaryContact.id},contact_id.eq.${secondaryContact.ghl_id}`);

      // Contact Notes
      await supabase
        .from("contact_notes")
        .update({
          contact_id: primaryContact.ghl_id || primaryContact.id,
          contact_uuid: primaryContact.id,
        })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${secondaryContact.id},contact_id.eq.${secondaryContact.ghl_id}`);

      // Tasks
      if (secondaryContact.ghl_id) {
        await supabase
          .from("ghl_tasks")
          .update({
            contact_id: primaryContact.ghl_id,
            contact_uuid: primaryContact.id,
          })
          .eq("company_id", companyId)
          .eq("contact_id", secondaryContact.ghl_id);
      }

      // Estimates
      await supabase
        .from("estimates")
        .update({
          contact_id: primaryContact.ghl_id,
          contact_uuid: primaryContact.id,
        })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${secondaryContact.id},contact_id.eq.${secondaryContact.ghl_id}`);

      // Projects
      await supabase
        .from("projects")
        .update({
          contact_id: primaryContact.ghl_id,
          contact_uuid: primaryContact.id,
        })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${secondaryContact.id},contact_id.eq.${secondaryContact.ghl_id}`);

      // 3. Delete the secondary contact
      const { error: deleteError } = await supabase
        .from("contacts")
        .delete()
        .eq("id", secondaryContact.id);

      if (deleteError) throw deleteError;

      return { primary: primaryContact, secondary: secondaryContact };
    },
    onSuccess: (data) => {
      toast.success(`Merged contacts into "${data.primary.contact_name}"`);
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
      handleOpenChange(false);
    },
    onError: (error) => {
      console.error("Merge failed:", error);
      toast.error(`Merge failed: ${error.message}`);
    },
  });

  const renderContactCard = (contact: Contact | null, side: "A" | "B") => {
    if (!contact) return null;
    const isPrimary = primary === side;
    const counts = side === "A" 
      ? { opportunities: relatedCounts?.opportunitiesA || 0, appointments: relatedCounts?.appointmentsA || 0, notes: relatedCounts?.notesA || 0 }
      : { opportunities: relatedCounts?.opportunitiesB || 0, appointments: relatedCounts?.appointmentsB || 0, notes: relatedCounts?.notesB || 0 };

    return (
      <div
        className={cn(
          "p-3 rounded-lg border-2 transition-all",
          isPrimary
            ? "border-primary bg-primary/5"
            : "border-muted"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{contact.contact_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground truncate">{contact.email || contact.phone || "No contact info"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ID: ...{contact.id.slice(-4)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => side === "A" ? setContactA(null) : setContactB(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {counts.opportunities > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              {counts.opportunities} opp
            </Badge>
          )}
          {counts.appointments > 0 && (
            <Badge variant="secondary" className="text-xs">
              <CalendarCheck className="h-3 w-3 mr-1" />
              {counts.appointments} appt
            </Badge>
          )}
          {counts.notes > 0 && (
            <Badge variant="secondary" className="text-xs">
              <StickyNote className="h-3 w-3 mr-1" />
              {counts.notes} notes
            </Badge>
          )}
        </div>
        {isPrimary && (
          <p className="text-xs text-primary mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            This contact will be kept
          </p>
        )}
      </div>
    );
  };

  const renderFieldComparison = (field: MergeField) => {
    const valueA = getFieldValue(contactA, field);
    const valueB = getFieldValue(contactB, field);
    const displayA = valueA || "—";
    const displayB = valueB || "—";
    const Icon = field.icon;
    const selected = fieldSelections[field.key];

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
            Merge Contacts
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Search and select two contacts to merge. All related records will be transferred."
              : "Select which values to keep for each field. The secondary contact will be deleted."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <>
            <div className="grid grid-cols-2 gap-6 py-4">
              {/* Contact A */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">First Contact</Label>
                {!contactA ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      className="pl-9"
                    />
                    {resultsA.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {resultsA.map((c) => (
                          <button
                            key={c.id}
                            className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                            onClick={() => {
                              setContactA(c);
                              setSearchA("");
                            }}
                          >
                            <p className="font-medium truncate">{c.contact_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.email || c.phone || "No contact info"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  renderContactCard(contactA, "A")
                )}
              </div>

              {/* Contact B */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Second Contact</Label>
                {!contactB ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      className="pl-9"
                    />
                    {resultsB.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {resultsB.map((c) => (
                          <button
                            key={c.id}
                            className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                            onClick={() => {
                              setContactB(c);
                              setSearchB("");
                            }}
                          >
                            <p className="font-medium truncate">{c.contact_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.email || c.phone || "No contact info"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  renderContactCard(contactB, "B")
                )}
              </div>
            </div>

            {contactA && contactB && (
              <>
                <Separator />
                <div className="py-4">
                  <Label className="text-sm font-medium mb-3 block">Select Primary Contact (will be kept)</Label>
                  <RadioGroup
                    value={primary}
                    onValueChange={(v) => setPrimary(v as "A" | "B")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="A" id="primary-a" />
                      <Label htmlFor="primary-a" className="cursor-pointer">
                        {contactA.contact_name || "First Contact"}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="B" id="primary-b" />
                      <Label htmlFor="primary-b" className="cursor-pointer">
                        {contactB.contact_name || "Second Contact"}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[500px]" style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--border)) transparent' }}>
            <div className="space-y-3 py-4">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center pb-2 border-b">
                <div className="text-center">
                  <p className="font-medium">{contactA?.contact_name}</p>
                  {primary === "A" && (
                    <Badge variant="default" className="mt-1">Primary</Badge>
                  )}
                </div>
                <div className="w-20" />
                <div className="text-center">
                  <p className="font-medium">{contactB?.contact_name}</p>
                  {primary === "B" && (
                    <Badge variant="default" className="mt-1">Primary</Badge>
                  )}
                </div>
              </div>

              {/* Field comparisons */}
              {MERGE_FIELDS.map(renderFieldComparison)}

              {/* Related records info */}
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All related records (opportunities, appointments, notes, tasks, estimates, projects) 
                  from the secondary contact will be transferred to the primary contact. 
                  The secondary contact will be deleted.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProceedToCompare}
                disabled={!contactA || !contactB}
              >
                Compare & Merge
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
                variant="destructive"
              >
                {mergeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Merge className="h-4 w-4 mr-2" />
                    Merge Contacts
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
