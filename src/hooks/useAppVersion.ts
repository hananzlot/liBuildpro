import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppVersionData {
  version_number: number;
  deployed_at: string;
}

export function useAppVersion() {
  const { data: dbVersion, isLoading, error } = useQuery({
    queryKey: ["app-version"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_version")
        .select("version_number, deployed_at")
        .order("deployed_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as AppVersionData;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  return {
    version: dbVersion?.version_number ?? null,
    deployedAt: dbVersion?.deployed_at ?? null,
    isLoading,
    error,
    versionString: dbVersion ? `v${dbVersion.version_number.toFixed(2)}` : "v2.20",
  };
}
