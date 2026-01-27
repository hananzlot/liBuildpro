import { useCallback, useEffect, useRef } from "react";

// Session storage key prefix for estimate drafts
const DRAFT_KEY_PREFIX = "estimate-draft-";

export interface EstimateDraft {
  formData: any;
  groups: any[];
  paymentSchedule: any[];
  activeTab: string;
  aiSummary: any;
  linkedProjectId: string | null;
  linkedOpportunityUuid: string | null;
  linkedOpportunityGhlId: string | null;
  plansFileUrl: string | null;
  plansFileName: string | null;
  savedAt: number;
}

/**
 * Hook to persist estimate builder draft to sessionStorage.
 * This ensures that form data survives when:
 * - User switches browser tabs (focus lost)
 * - Dialog temporarily unmounts due to React re-renders
 * - Browser refreshes (sessionStorage persists for the session)
 * 
 * @param estimateId - The estimate ID being edited, or null/undefined for new estimates
 * @param isOpen - Whether the dialog is currently open
 */
export function useEstimateDraft(estimateId: string | null | undefined, isOpen: boolean) {
  const draftKeyRef = useRef<string>("");
  
  // Compute the storage key - use estimateId if editing, or "new" for new estimates
  useEffect(() => {
    const key = estimateId ? `${DRAFT_KEY_PREFIX}${estimateId}` : `${DRAFT_KEY_PREFIX}new`;
    draftKeyRef.current = key;
  }, [estimateId]);

  /**
   * Save draft to sessionStorage
   */
  const saveDraft = useCallback((draft: Omit<EstimateDraft, "savedAt">) => {
    if (!draftKeyRef.current) return;
    
    try {
      const fullDraft: EstimateDraft = {
        ...draft,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(draftKeyRef.current, JSON.stringify(fullDraft));
    } catch (err) {
      // sessionStorage might be full or unavailable - silently fail
      console.warn("Failed to save estimate draft:", err);
    }
  }, []);

  /**
   * Load draft from sessionStorage
   * Returns null if no draft exists or if the draft is stale (> 4 hours old)
   */
  const loadDraft = useCallback((): EstimateDraft | null => {
    if (!draftKeyRef.current) return null;
    
    try {
      const stored = sessionStorage.getItem(draftKeyRef.current);
      if (!stored) return null;
      
      const draft = JSON.parse(stored) as EstimateDraft;
      
      // Check if draft is too old (4 hours)
      const maxAge = 4 * 60 * 60 * 1000;
      if (Date.now() - draft.savedAt > maxAge) {
        sessionStorage.removeItem(draftKeyRef.current);
        return null;
      }
      
      return draft;
    } catch (err) {
      console.warn("Failed to load estimate draft:", err);
      return null;
    }
  }, []);

  /**
   * Clear the draft from sessionStorage
   * Call this after successful save
   */
  const clearDraft = useCallback(() => {
    if (!draftKeyRef.current) return;
    
    try {
      sessionStorage.removeItem(draftKeyRef.current);
    } catch (err) {
      console.warn("Failed to clear estimate draft:", err);
    }
  }, []);

  /**
   * Clear all estimate drafts (for debugging or cleanup)
   */
  const clearAllDrafts = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(DRAFT_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (err) {
      console.warn("Failed to clear all estimate drafts:", err);
    }
  }, []);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    clearAllDrafts,
  };
}
