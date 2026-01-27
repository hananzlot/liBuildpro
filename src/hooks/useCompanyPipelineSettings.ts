import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type CompanyPipelineSettings = {
  pipelineId: string;
  pipelineName: string;
  stageNames: string[];
  stageIdByName: Record<string, string>;
};

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

/**
 * Reads pipeline config from Admin Settings (company_settings):
 * - default_pipeline_name
 * - pipeline_stages (JSON array string or legacy CSV)
 */
export function useCompanyPipelineSettings(companyId: string | null | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["company-pipeline-settings", companyId],
    enabled: enabled && !!companyId,
    queryFn: async () => {
      if (!companyId) return null;
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
      const stageNames = stagesSetting?.setting_value
        ? normalizeStageNames(stagesSetting.setting_value)
        : [];

      const stageIdByName: Record<string, string> = {};
      stageNames.forEach((name, idx) => {
        stageIdByName[name] = `local_stage_${idx}`;
      });

      const result: CompanyPipelineSettings = {
        pipelineId,
        pipelineName,
        stageNames,
        stageIdByName,
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
