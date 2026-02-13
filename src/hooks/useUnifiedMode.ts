import { useEffect, useMemo, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedModeStore } from "@/stores/useUnifiedModeStore";

/**
 * Hook for Corp Admins/Viewers to toggle a "unified view" that shows
 * data from ALL companies in their corporation instead of just the active one.
 * 
 * When unified mode is ON:
 * - Queries should use `.in("company_id", companyIds)` instead of `.eq("company_id", companyId)`
 * - Table rows show a company badge
 * 
 * When unified mode is OFF:
 * - Normal single-company behaviour
 */

interface CompanyInfo {
  id: string;
  name: string;
}

export function useUnifiedMode() {
  const { isCorpAdmin, isCorpViewer, isSuperAdmin, companyId, company } = useAuth();
  
  const canUnify = (isCorpAdmin || isCorpViewer) && !isSuperAdmin;

  // Use Zustand store for shared state across all hook consumers
  const { isUnified: isUnifiedRaw, toggleUnified: toggleUnifiedStore } = useUnifiedModeStore();

  const [corporationCompanies, setCorporationCompanies] = useState<CompanyInfo[]>([]);

  // Fetch all companies in the corporation
  useEffect(() => {
    if (!canUnify || !company?.corporation_id) {
      setCorporationCompanies([]);
      return;
    }

    const fetchCorpCompanies = async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("corporation_id", company.corporation_id!)
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setCorporationCompanies(data);
      }
    };

    fetchCorpCompanies();
  }, [canUnify, company?.corporation_id]);

  const toggleUnified = useCallback(() => {
    toggleUnifiedStore();
  }, [toggleUnifiedStore]);

  // The list of company IDs to query
  const companyIds = useMemo(() => {
    if (canUnify && isUnifiedRaw && corporationCompanies.length > 0) {
      return corporationCompanies.map((c) => c.id);
    }
    return companyId ? [companyId] : [];
  }, [canUnify, isUnifiedRaw, corporationCompanies, companyId]);

  // The effective "active" state
  const effectiveUnified = canUnify && isUnifiedRaw && corporationCompanies.length > 1;

  // Company name lookup for badges
  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    corporationCompanies.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [corporationCompanies]);

  const getCompanyName = useCallback(
    (id: string | null) => (id ? companyNameMap.get(id) ?? "Unknown" : "Unknown"),
    [companyNameMap]
  );

  // Query key suffix to bust cache when toggling
  const queryKeySuffix = effectiveUnified ? "unified" : companyId;

  return {
    /** Whether the user CAN toggle unified mode */
    canUnify,
    /** Whether unified mode is currently active */
    isUnified: effectiveUnified,
    /** Toggle unified mode on/off */
    toggleUnified,
    /** Company IDs to use in queries (single or multiple) */
    companyIds,
    /** Get company name by ID (for badges) */
    getCompanyName,
    /** All companies in the corporation */
    corporationCompanies,
    /** Value to append to query keys for proper cache busting */
    queryKeySuffix,
    /** The single active company ID (falls back to normal) */
    activeCompanyId: companyId,
  };
}
