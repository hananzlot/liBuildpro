import { useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

  // Build dismissed set for fast lookups
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
          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
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
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate(pair)}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                      Not Duplicate
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-8"
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
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
