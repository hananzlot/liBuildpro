import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStage = {
  id: string;
  name: string;
  position: number;
};

type CompanyPipelineSettings = {
  pipelineId: string;
  pipelineName: string;
  stages: PipelineStage[];
  stageNames: string[];
  stageIdByName: Record<string, string>;
  stageNameById: Record<string, string>;
};

/**
 * Reads pipeline config from:
 * 1. pipeline_stages table (UUID-based, preferred)
 * 2. Falls back to company_settings for legacy data
 */
export function useCompanyPipelineSettings(companyId: string | null | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["company-pipeline-settings", companyId],
    enabled: enabled && !!companyId,
    queryFn: async () => {
      if (!companyId) return null;

      // First, try to fetch from pipeline_stages table (new UUID-based system)
      const { data: pipelineStagesData, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("company_id", companyId)
        .order("position", { ascending: true });

      if (stagesError) {
        console.error("[useCompanyPipelineSettings] Error fetching pipeline_stages:", stagesError);
      }

      // If we have stages in the new table, use them
      if (pipelineStagesData && pipelineStagesData.length > 0) {
        // Also fetch pipeline name from company_settings
        const { data: settingsData } = await supabase
          .from("company_settings")
          .select("setting_key, setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "default_pipeline_name")
          .maybeSingle();

        const pipelineName = settingsData?.setting_value || "Main";
        const pipelineId = `pipeline_${companyId}`;

        const stages: PipelineStage[] = pipelineStagesData.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        }));

        const stageNames = stages.map((s) => s.name);
        const stageIdByName: Record<string, string> = {};
        const stageNameById: Record<string, string> = {};
        
        stages.forEach((s) => {
          stageIdByName[s.name] = s.id;
          stageIdByName[s.name.toLowerCase().trim()] = s.id;
          stageNameById[s.id] = s.name;
        });

        const result: CompanyPipelineSettings = {
          pipelineId,
          pipelineName,
          stages,
          stageNames,
          stageIdByName,
          stageNameById,
        };
        return result;
      }

      // Fallback: Read from company_settings (legacy)
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["default_pipeline_name", "pipeline_stages"]);

      if (error) throw error;

      const pipelineNameSetting = data?.find((s) => s.setting_key === "default_pipeline_name");
      const stagesSetting = data?.find((s) => s.setting_key === "pipeline_stages");

      const pipelineName = pipelineNameSetting?.setting_value || "Main";
      const pipelineId = `local_pipeline_${companyId}`;
      
      let stageNames: string[] = [];
      if (stagesSetting?.setting_value) {
        stageNames = normalizeStageNames(stagesSetting.setting_value);
      }

      // Create synthetic stages with generated IDs for legacy data
      const stages: PipelineStage[] = stageNames.map((name, idx) => ({
        id: `local_stage_${idx}`,
        name,
        position: idx,
      }));

      const stageIdByName: Record<string, string> = {};
      const stageNameById: Record<string, string> = {};
      
      stages.forEach((s) => {
        stageIdByName[s.name] = s.id;
        stageIdByName[s.name.toLowerCase().trim()] = s.id;
        stageNameById[s.id] = s.name;
      });

      const result: CompanyPipelineSettings = {
        pipelineId,
        pipelineName,
        stages,
        stageNames,
        stageIdByName,
        stageNameById,
      };
      return result;
    },
  });

  return useMemo(
    () => ({
      ...query,
      isConfigured: !!query.data?.stageNames?.length,
    }),
    [query]
  );
}

const normalizeStageNames = (raw: string): string[] => {
  let stages: string[] = [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      stages = parsed.map((s) => String(s));
    } else if (typeof parsed === "string") {
      stages = parsed.split(",");
    }
  } catch {
    stages = raw.split(",");
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const stage of stages) {
    const cleaned = String(stage).trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
};
