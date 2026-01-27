import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stage Badge Mapping structure stored in company_settings
 * Key: stage_badge_mappings
 * Value: JSON array of {badgeName: string, stages: string[], color?: string}
 */
export interface StageBadgeMapping {
  badgeName: string;
  stages: string[];
  color?: string; // Optional tailwind color class like "amber" | "red" | "blue"
}

export interface StageBadgeMappingsResult {
  mappings: StageBadgeMapping[];
  isLoading: boolean;
  isConfigured: boolean;
  getBadgeForStage: (stageName: string) => StageBadgeMapping | null;
  getCountForBadge: (badgeName: string, opportunities: { stage_name?: string | null }[]) => number;
  filterByBadge: <T extends { stage_name?: string | null }>(badgeName: string, items: T[]) => T[];
}

/**
 * Hook to read stage badge mappings from company_settings.
 * Provides helper functions to count/filter opportunities by badge category.
 */
export function useStageBadgeMappings(companyId: string | null | undefined): StageBadgeMappingsResult {
  const query = useQuery({
    queryKey: ["stage-badge-mappings", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "stage_badge_mappings")
        .maybeSingle();

      if (error) {
        console.error("[useStageBadgeMappings] Error fetching:", error);
        return [];
      }

      if (!data?.setting_value) {
        return [];
      }

      try {
        const parsed = JSON.parse(data.setting_value);
        if (Array.isArray(parsed)) {
          return parsed as StageBadgeMapping[];
        }
        return [];
      } catch (e) {
        console.error("[useStageBadgeMappings] Failed to parse:", e);
        return [];
      }
    },
  });

  const mappings = query.data ?? [];

  const getBadgeForStage = useMemo(() => {
    return (stageName: string): StageBadgeMapping | null => {
      if (!stageName) return null;
      const normalized = stageName.toLowerCase().trim();
      return mappings.find(m => 
        m.stages.some(s => s.toLowerCase().trim() === normalized)
      ) || null;
    };
  }, [mappings]);

  const getCountForBadge = useMemo(() => {
    return (badgeName: string, opportunities: { stage_name?: string | null }[]): number => {
      const mapping = mappings.find(m => m.badgeName === badgeName);
      if (!mapping) return 0;
      
      const stageSet = new Set(mapping.stages.map(s => s.toLowerCase().trim()));
      return opportunities.filter(o => 
        o.stage_name && stageSet.has(o.stage_name.toLowerCase().trim())
      ).length;
    };
  }, [mappings]);

  const filterByBadge = useMemo(() => {
    return <T extends { stage_name?: string | null }>(badgeName: string, items: T[]): T[] => {
      const mapping = mappings.find(m => m.badgeName === badgeName);
      if (!mapping) return [];
      
      const stageSet = new Set(mapping.stages.map(s => s.toLowerCase().trim()));
      return items.filter(item => 
        item.stage_name && stageSet.has(item.stage_name.toLowerCase().trim())
      );
    };
  }, [mappings]);

  return {
    mappings,
    isLoading: query.isLoading,
    isConfigured: mappings.length > 0,
    getBadgeForStage,
    getCountForBadge,
    filterByBadge,
  };
}
