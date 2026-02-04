import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

interface LinkedRecordCounts {
  contacts: number;
  opportunities: number;
  projects: number;
  estimates: number;
  contactId: string | null;
  contactName: string | null;
  currentEmail: string | null;
}

interface SyncEmailParams {
  contactUuid: string;
  newEmail: string;
}

/**
 * Hook to check how many records are linked to a contact and sync email across all of them.
 */
export function useEmailSync(contactUuid: string | null | undefined) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // Fetch counts of linked records
  const { data: linkedCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ["email-sync-counts", contactUuid, companyId],
    queryFn: async (): Promise<LinkedRecordCounts> => {
      if (!contactUuid || !companyId) {
        return {
          contacts: 0,
          opportunities: 0,
          projects: 0,
          estimates: 0,
          contactId: null,
          contactName: null,
          currentEmail: null,
        };
      }

      // Get contact info
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, contact_name, email, ghl_id")
        .eq("id", contactUuid)
        .single();

      if (!contact) {
        return {
          contacts: 0,
          opportunities: 0,
          projects: 0,
          estimates: 0,
          contactId: null,
          contactName: null,
          currentEmail: null,
        };
      }

      // Count opportunities linked to this contact
      const { count: oppCount } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .or(`contact_uuid.eq.${contactUuid},contact_id.eq.${contact.ghl_id}`);

      // Count projects linked to this contact
      const { count: projCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`contact_uuid.eq.${contactUuid},contact_id.eq.${contact.ghl_id}`);

      // Count estimates linked to this contact
      const { count: estCount } = await supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("contact_uuid", contactUuid);

      return {
        contacts: 1,
        opportunities: oppCount || 0,
        projects: projCount || 0,
        estimates: estCount || 0,
        contactId: contact.id,
        contactName: contact.contact_name,
        currentEmail: contact.email,
      };
    },
    enabled: !!contactUuid && !!companyId,
    staleTime: 30000, // 30 seconds
  });

  // Mutation to sync email across all linked records
  const syncEmailMutation = useMutation({
    mutationFn: async ({ contactUuid, newEmail }: SyncEmailParams) => {
      if (!companyId) throw new Error("No company context");

      // Get the contact's ghl_id for legacy lookups
      const { data: contact } = await supabase
        .from("contacts")
        .select("ghl_id")
        .eq("id", contactUuid)
        .single();

      const ghlId = contact?.ghl_id;

      // Update contact
      const { error: contactError } = await supabase
        .from("contacts")
        .update({ email: newEmail })
        .eq("id", contactUuid);

      if (contactError) throw contactError;

      // Note: Opportunities don't have an email field - they reference contact_uuid
      // The contact's email update above handles the source of truth

      // Update projects
      if (ghlId) {
        await supabase
          .from("projects")
          .update({ customer_email: newEmail })
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .or(`contact_uuid.eq.${contactUuid},contact_id.eq.${ghlId}`);
      } else {
        await supabase
          .from("projects")
          .update({ customer_email: newEmail })
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .eq("contact_uuid", contactUuid);
      }

      // Update estimates
      await supabase
        .from("estimates")
        .update({ customer_email: newEmail })
        .eq("company_id", companyId)
        .eq("contact_uuid", contactUuid);

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Email updated across all linked records");
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["email-sync-counts"] });
    },
    onError: (error) => {
      console.error("Email sync error:", error);
      toast.error("Failed to sync email across records");
    },
  });

  return {
    linkedCounts,
    isLoadingCounts,
    syncEmail: syncEmailMutation.mutate,
    isSyncing: syncEmailMutation.isPending,
  };
}
