import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useEffect } from "react";
import { toast } from "sonner";

export interface QueuedJob {
  id: string;
  estimate_id: string;
  status: string;
  current_stage: string | null;
  total_stages: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  error_message: string | null;
  request_params: {
    job_address?: string;
    customer_name?: string;
    [key: string]: unknown;
  } | null;
  // Joined from profiles
  creator_name?: string | null;
  creator_email?: string | null;
  // Joined from estimates
  estimate_number?: number | null;
}

export function useAIGenerationQueue() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  // Fetch all pending/processing jobs for this company
  const { data: queuedJobs = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-generation-queue", companyId],
    queryFn: async (): Promise<QueuedJob[]> => {
      if (!companyId) return [];

      // Fetch jobs without embedded join (no FK relationship exists)
      const { data: jobs, error } = await supabase
        .from("estimate_generation_jobs")
        .select(`
          id,
          estimate_id,
          status,
          current_stage,
          total_stages,
          created_at,
          started_at,
          completed_at,
          created_by,
          error_message,
          request_params
        `)
        .eq("company_id", companyId)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!jobs || jobs.length === 0) return [];

      // Fetch creator profiles separately
      const creatorIds = [...new Set(jobs.map(j => j.created_by).filter(Boolean))];
      let profilesMap: Record<string, { full_name?: string; email?: string }> = {};
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", creatorIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      }

      // Fetch estimate numbers separately
      const estimateIds = [...new Set(jobs.map(j => j.estimate_id))];
      let estimatesMap: Record<string, number | null> = {};
      
      if (estimateIds.length > 0) {
        const { data: estimates } = await supabase
          .from("estimates")
          .select("id, estimate_number")
          .in("id", estimateIds);
        
        if (estimates) {
          estimatesMap = Object.fromEntries(estimates.map(e => [e.id, e.estimate_number]));
        }
      }

      return jobs.map((job) => {
        const profile = job.created_by ? profilesMap[job.created_by] : null;
        return {
          ...job,
          request_params: job.request_params as QueuedJob["request_params"],
          creator_name: profile?.full_name || null,
          creator_email: profile?.email || null,
          estimate_number: estimatesMap[job.estimate_id] ?? null,
        };
      });
    },
    enabled: !!companyId,
    refetchInterval: 10000, // Poll every 10s as backup
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel("ai-queue-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "estimate_generation_jobs",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, refetch]);

  // Pause a job (set status to 'paused')
  const pauseJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("estimate_generation_jobs")
        .update({ status: "paused" })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-generation-queue"] });
      toast.success("Job paused");
    },
    onError: (err) => {
      toast.error("Failed to pause job: " + (err as Error).message);
    },
  });

  // Resume a paused job
  const resumeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("estimate_generation_jobs")
        .update({ status: "pending" })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-generation-queue"] });
      toast.success("Job resumed");
    },
    onError: (err) => {
      toast.error("Failed to resume job: " + (err as Error).message);
    },
  });

  // Delete/cancel a job
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("estimate_generation_jobs")
        .delete()
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-generation-queue"] });
      toast.success("Job cancelled");
    },
    onError: (err) => {
      toast.error("Failed to cancel job: " + (err as Error).message);
    },
  });

  // Count of active jobs (pending + processing)
  const activeCount = queuedJobs.length;

  return {
    queuedJobs,
    activeCount,
    isLoading,
    refetch,
    pauseJob: pauseJobMutation.mutate,
    resumeJob: resumeJobMutation.mutate,
    deleteJob: deleteJobMutation.mutate,
    isPausing: pauseJobMutation.isPending,
    isResuming: resumeJobMutation.isPending,
    isDeleting: deleteJobMutation.isPending,
  };
}
