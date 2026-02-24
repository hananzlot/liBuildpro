import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Merge,
  EyeOff,
  Phone,
  Mail,
  User,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  ghl_id?: string | null;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  custom_fields?: any;
  ghl_date_added?: string | null;
  created_at?: string;
  company_id?: string | null;
}

interface DuplicatePair {
  contactA: Contact;
  contactB: Contact;
  matchType: "name" | "email" | "phone";
  matchValue: string;
}

interface DuplicateContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  opportunities: any[];
  appointments: any[];
  onMerge: (pair: { contactA: Contact; contactB: Contact }) => void;
}

const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10); // last 10 digits
};

const normalizeName = (contact: Contact): string => {
  const name =
    contact.contact_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  return (name || "").toLowerCase().trim();
};

export function DuplicateContactsDialog({
  open,
  onOpenChange,
  contacts,
  opportunities,
  appointments,
  onMerge,
}: DuplicateContactsDialogProps) {
  const { companyId } = useCompanyContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch dismissed pairs
  const { data: dismissedPairs, isLoading: loadingDismissed } = useQuery({
    queryKey: ["dismissed-duplicates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("dismissed_duplicate_contacts")
        .select("contact_id_a, contact_id_b")
        .eq("company_id", companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId,
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (pair: DuplicatePair) => {
      if (!companyId) throw new Error("No company");
      // Store with sorted IDs so we always check consistently
      const [idA, idB] = [pair.contactA.id, pair.contactB.id].sort();
      const { error } = await supabase
        .from("dismissed_duplicate_contacts")
        .insert({
          company_id: companyId,
          contact_id_a: idA,
          contact_id_b: idB,
          dismissed_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as not duplicate");
      queryClient.invalidateQueries({ queryKey: ["dismissed-duplicates", companyId] });
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  // Merge All state
  const [confirmMergeAll, setConfirmMergeAll] = useState(false);
  const [mergeAllProgress, setMergeAllProgress] = useState<{ current: number; total: number } | null>(null);

  const mergeOnePair = useCallback(async (primary: Contact, secondary: Contact) => {
    if (!companyId) throw new Error("No company");

    // Keep primary's data, fill gaps from secondary
    const mergedData: Record<string, any> = {};
    const fields = ["contact_name", "first_name", "last_name", "email", "phone", "source"] as const;
    fields.forEach((f) => {
      mergedData[f] = (primary as any)[f] || (secondary as any)[f] || null;
    });

    // Merge custom_fields: prefer primary, fill from secondary
    const primaryCF = Array.isArray(primary.custom_fields) ? primary.custom_fields : [];
    const secondaryCF = Array.isArray(secondary.custom_fields) ? secondary.custom_fields : [];
    const cfMap = new Map<string, any>();
    secondaryCF.forEach((cf: any) => { if (cf?.id && cf?.value) cfMap.set(cf.id, cf); });
    primaryCF.forEach((cf: any) => { if (cf?.id && cf?.value) cfMap.set(cf.id, cf); }); // primary overwrites
    if (cfMap.size > 0) mergedData.custom_fields = Array.from(cfMap.values());

    mergedData.ghl_id = primary.ghl_id;
    mergedData.updated_at = new Date().toISOString();

    // Update primary
    await supabase.from("contacts").update(mergedData).eq("id", primary.id);

    // Transfer related records
    const buildOr = (uuid: string, ghlId: string | null | undefined) => {
      const c = [`contact_uuid.eq.${uuid}`];
      if (ghlId) c.push(`contact_id.eq.${ghlId}`);
      return c.join(",");
    };
    const secondaryOr = buildOr(secondary.id, secondary.ghl_id);
    const transferPayload = { contact_id: primary.ghl_id, contact_uuid: primary.id };

    await Promise.all([
      supabase.from("opportunities").update(transferPayload).eq("company_id", companyId).or(secondaryOr),
      supabase.from("appointments").update(transferPayload).eq("company_id", companyId).or(secondaryOr),
      supabase.from("contact_notes").update({ contact_id: primary.ghl_id || primary.id, contact_uuid: primary.id }).eq("company_id", companyId).or(secondaryOr),
      supabase.from("estimates").update(transferPayload).eq("company_id", companyId).or(secondaryOr),
      supabase.from("projects").update(transferPayload).eq("company_id", companyId).or(secondaryOr),
      ...(secondary.ghl_id ? [supabase.from("ghl_tasks").update({ contact_id: primary.ghl_id, contact_uuid: primary.id }).eq("company_id", companyId).eq("contact_id", secondary.ghl_id)] : []),
    ]);

    // Delete secondary
    await supabase.from("contacts").delete().eq("id", secondary.id);
  }, [companyId]);

  const mergeAllMutation = useMutation({
    mutationFn: async (pairs: DuplicatePair[]) => {
      let merged = 0;
      let failed = 0;
      setMergeAllProgress({ current: 0, total: pairs.length });
      for (let i = 0; i < pairs.length; i++) {
        try {
          // Use the older contact (by created_at or ghl_date_added) as primary
          const a = pairs[i].contactA;
          const b = pairs[i].contactB;
          const dateA = a.ghl_date_added || a.created_at || "";
          const dateB = b.ghl_date_added || b.created_at || "";
          const [primary, secondary] = dateA <= dateB ? [a, b] : [b, a];
          await mergeOnePair(primary, secondary);
          merged++;
        } catch (err) {
          console.error("Failed to merge pair:", err);
          failed++;
        }
        setMergeAllProgress({ current: i + 1, total: pairs.length });
      }
      return { merged, failed };
    },
    onSuccess: ({ merged, failed }) => {
      setMergeAllProgress(null);
      toast.success(`Merged ${merged} duplicate pairs${failed > 0 ? ` (${failed} failed)` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["contact_notes"] });
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["global-search-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["global-search-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["global-search-projects"] });
      queryClient.invalidateQueries({ queryKey: ["global-search-estimates"] });
    },
    onError: (err) => {
      setMergeAllProgress(null);
      toast.error(`Merge all failed: ${err.message}`);
    },
  });

  const dismissedSet = useMemo(() => {
    const set = new Set<string>();
    (dismissedPairs || []).forEach((d) => {
      const key = [d.contact_id_a, d.contact_id_b].sort().join("|");
      set.add(key);
    });
    return set;
  }, [dismissedPairs]);

  // Detect duplicates
  const duplicatePairs = useMemo(() => {
    if (loadingDismissed || !contacts.length) return [];

    const pairs: DuplicatePair[] = [];
    const seen = new Set<string>();

    // Index by email
    const emailMap = new Map<string, Contact[]>();
    // Index by phone (normalized)
    const phoneMap = new Map<string, Contact[]>();
    // Index by name
    const nameMap = new Map<string, Contact[]>();

    contacts.forEach((c) => {
      if (c.email) {
        const key = c.email.toLowerCase().trim();
        if (!emailMap.has(key)) emailMap.set(key, []);
        emailMap.get(key)!.push(c);
      }
      const phone = normalizePhone(c.phone);
      if (phone.length >= 7) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone)!.push(c);
      }
      const name = normalizeName(c);
      if (name && name !== "unknown" && name.length > 2) {
        if (!nameMap.has(name)) nameMap.set(name, []);
        nameMap.get(name)!.push(c);
      }
    });

    const addPairs = (
      map: Map<string, Contact[]>,
      matchType: "name" | "email" | "phone"
    ) => {
      map.forEach((group, matchValue) => {
        if (group.length < 2) return;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const pairKey = [group[i].id, group[j].id].sort().join("|");
            if (seen.has(pairKey)) continue;
            if (dismissedSet.has(pairKey)) continue;
            seen.add(pairKey);
            pairs.push({
              contactA: group[i],
              contactB: group[j],
              matchType,
              matchValue,
            });
          }
        }
      });
    };

    addPairs(emailMap, "email");
    addPairs(phoneMap, "phone");
    addPairs(nameMap, "name");

    return pairs;
  }, [contacts, dismissedSet, loadingDismissed]);

  const getContactName = (c: Contact) =>
    c.contact_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "Unknown";

  const matchTypeIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-3 w-3" />;
      case "phone": return <Phone className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const matchTypeLabel = (type: string) => {
    switch (type) {
      case "email": return "Same email";
      case "phone": return "Same phone";
      default: return "Same name";
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Potential Duplicate Contacts
          </DialogTitle>
          <DialogDescription>
            {loadingDismissed
              ? "Scanning..."
              : duplicatePairs.length === 0
              ? "No potential duplicates found."
              : `Found ${duplicatePairs.length} potential duplicate${duplicatePairs.length !== 1 ? "s" : ""}. Review each pair and choose to merge or dismiss.`}
          </DialogDescription>
        </DialogHeader>

        {loadingDismissed ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : duplicatePairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              All contacts look unique! No duplicates detected.
            </p>
          </div>
        ) : (
          <>
            {/* Merge All button + progress */}
            {mergeAllProgress ? (
              <div className="space-y-2 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Merging duplicates...</span>
                  <span className="font-medium">{mergeAllProgress.current} / {mergeAllProgress.total}</span>
                </div>
                <Progress value={(mergeAllProgress.current / mergeAllProgress.total) * 100} />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{duplicatePairs.length} pairs</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs h-8"
                  disabled={mergeAllMutation.isPending}
                  onClick={() => setConfirmMergeAll(true)}
                >
                  <Merge className="h-3.5 w-3.5 mr-1" />
                  Merge All ({duplicatePairs.length})
                </Button>
              </div>
            )}

            <div className="overflow-y-auto max-h-[55vh] -mx-6 px-6">
              <div className="space-y-3 pb-4">
                {duplicatePairs.map((pair, idx) => (
                  <div
                    key={`${pair.contactA.id}-${pair.contactB.id}`}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    {/* Match reason */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        {matchTypeLabel(pair.matchType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {pair.matchValue}
                      </span>
                    </div>

                    {/* Two contact cards side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      {[pair.contactA, pair.contactB].map((contact) => (
                        <div
                          key={contact.id}
                          className="rounded-md border border-border/60 p-3 space-y-1"
                        >
                          <p className="font-medium text-sm truncate">
                            {getContactName(contact)}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {contact.email}
                            </p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {contact.phone}
                            </p>
                          )}
                          {contact.source && (
                            <p className="text-xs text-muted-foreground">
                              Source: {contact.source}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        disabled={dismissMutation.isPending || mergeAllMutation.isPending}
                        onClick={() => dismissMutation.mutate(pair)}
                      >
                        <EyeOff className="h-3.5 w-3.5 mr-1" />
                        Not Duplicate
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-8"
                        disabled={mergeAllMutation.isPending}
                        onClick={() => {
                          onMerge({
                            contactA: pair.contactA,
                            contactB: pair.contactB,
                          });
                        }}
                      >
                        <Merge className="h-3.5 w-3.5 mr-1" />
                        Merge
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

      {/* Merge All Confirmation */}
      <AlertDialog open={confirmMergeAll} onOpenChange={setConfirmMergeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge all {duplicatePairs.length} duplicate pairs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will automatically merge each pair, keeping the older contact as the primary record and transferring all related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmMergeAll(false);
                mergeAllMutation.mutate(duplicatePairs);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Merge All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
