import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import type { EstimateDraft } from "./useEstimateDraft";
import type { Json } from "@/integrations/supabase/types";

/** Draft data without the savedAt timestamp (DB uses its own timestamps) */
type DraftInput = Omit<EstimateDraft, "savedAt">;

/**
 * Hook to persist estimate builder drafts to Supabase (estimate_drafts table).
 * 
 * - Saves/loads one draft per user per company
 * - On successful final save (or dialog close), deletes the draft
 * - Uses debounced upserts so we don't spam the server
 */
export function useEstimateDraftDB() {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const pendingDraft = useRef<DraftInput | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const userId = user?.id;

  /**
   * Immediately persist the provided draft to Supabase (upsert).
   * Should be called on blur / hide / unload events.
   */
  const flushDraft = useCallback(async (draft: DraftInput) => {
    if (!userId || !companyId) return;
    if (isSavingRef.current) return; // avoid overlapping saves
    isSavingRef.current = true;

    try {
      const row = {
        user_id: userId,
        company_id: companyId,
        draft_data: JSON.parse(JSON.stringify(draft)) as Json,
      };
      await supabase
        .from("estimate_drafts")
        .upsert([row], { onConflict: "user_id,company_id" });
    } catch (err) {
      console.warn("Failed to flush estimate draft to DB:", err);
    } finally {
      isSavingRef.current = false;
    }
  }, [userId, companyId]);

  /**
   * Debounced save. Accumulates latest draft and saves after 2s of inactivity.
   */
  const saveDraft = useCallback((draft: DraftInput) => {
    pendingDraft.current = draft;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingDraft.current) {
        flushDraft(pendingDraft.current);
        pendingDraft.current = null;
      }
    }, 2000);
  }, [flushDraft]);

  /**
   * Force flush any pending draft immediately (useful on visibility change).
   */
  const flushPending = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingDraft.current) {
      flushDraft(pendingDraft.current);
      pendingDraft.current = null;
    }
  }, [flushDraft]);

  /**
   * Load the existing draft from DB for this user/company.
   */
  const loadDraft = useCallback(async (): Promise<EstimateDraft | null> => {
    if (!userId || !companyId) return null;

    try {
      const { data, error } = await supabase
        .from("estimate_drafts")
        .select("draft_data")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.draft_data) return null;

      return data.draft_data as unknown as EstimateDraft;
    } catch (err) {
      console.warn("Failed to load estimate draft from DB:", err);
      return null;
    }
  }, [userId, companyId]);

  /**
   * Delete the draft from DB (call on successful save or dialog close).
   */
  const deleteDraft = useCallback(async () => {
    if (!userId || !companyId) return;

    // Cancel any pending debounced save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDraft.current = null;

    try {
      await supabase
        .from("estimate_drafts")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);
    } catch (err) {
      console.warn("Failed to delete estimate draft from DB:", err);
    }
  }, [userId, companyId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveDraft,
    flushPending,
    loadDraft,
    deleteDraft,
  };
}
