import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface ArchivedSource {
  id: string;
  source_name: string;
  archived_at: string;
  archived_by: string | null;
}

export function useArchivedSources() {
  const { companyId } = useCompanyContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: archivedSources = [], isLoading } = useQuery({
    queryKey: ["archived-sources", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("archived_sources")
        .select("id, source_name, archived_at, archived_by")
        .eq("company_id", companyId)
        .order("source_name");
      
      if (error) throw error;
      return data as ArchivedSource[];
    },
    enabled: !!companyId,
  });

  const archiveSourceMutation = useMutation({
    mutationFn: async (sourceName: string) => {
      if (!companyId) throw new Error("No company context");
      
      const { error } = await supabase
        .from("archived_sources")
        .insert({
          company_id: companyId,
          source_name: sourceName,
          archived_by: user?.id || null,
        });
      
      if (error) {
        if (error.code === "23505") {
          throw new Error("Source is already archived");
        }
        throw error;
      }
    },
    onSuccess: (_, sourceName) => {
      toast.success(`Source "${sourceName}" archived`);
      queryClient.invalidateQueries({ queryKey: ["archived-sources", companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to archive source");
    },
  });

  const unarchiveSourceMutation = useMutation({
    mutationFn: async (sourceName: string) => {
      if (!companyId) throw new Error("No company context");
      
      const { error } = await supabase
        .from("archived_sources")
        .delete()
        .eq("company_id", companyId)
        .ilike("source_name", sourceName);
      
      if (error) throw error;
    },
    onSuccess: (_, sourceName) => {
      toast.success(`Source "${sourceName}" restored`);
      queryClient.invalidateQueries({ queryKey: ["archived-sources", companyId] });
    },
    onError: () => {
      toast.error("Failed to restore source");
    },
  });

  // Helper to check if a source is archived (case-insensitive)
  const isSourceArchived = (sourceName: string): boolean => {
    return archivedSources.some(
      (s) => s.source_name.toLowerCase() === sourceName.toLowerCase()
    );
  };

  // Helper to filter out archived sources from a list
  const filterArchivedSources = (sources: string[]): string[] => {
    const archivedLower = new Set(archivedSources.map((s) => s.source_name.toLowerCase()));
    return sources.filter((source) => !archivedLower.has(source.toLowerCase()));
  };

  return {
    archivedSources,
    isLoading,
    archiveSource: archiveSourceMutation.mutate,
    unarchiveSource: unarchiveSourceMutation.mutate,
    isArchiving: archiveSourceMutation.isPending,
    isUnarchiving: unarchiveSourceMutation.isPending,
    isSourceArchived,
    filterArchivedSources,
  };
}
