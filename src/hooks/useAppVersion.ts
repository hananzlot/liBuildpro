import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_VERSION_KEY = "app_version_cache";

interface AppVersionData {
  version_number: number;
  deployed_at: string;
}

export function useAppVersion() {
  const [hasCacheCleared, setHasCacheCleared] = useState(false);

  // Fetch the latest version from database
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
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: true,
  });

  // Check if we need to clear cache
  useEffect(() => {
    if (!dbVersion || hasCacheCleared) return;

    const storedVersion = localStorage.getItem(LOCAL_VERSION_KEY);
    const currentDbVersion = dbVersion.version_number.toString();

    if (storedVersion && storedVersion !== currentDbVersion) {
      // Clear all caches
      clearAllCaches().then(() => {
        // Update stored version
        localStorage.setItem(LOCAL_VERSION_KEY, currentDbVersion);
        setHasCacheCleared(true);
        
        // Force reload to get fresh assets
        window.location.reload();
      });
    } else if (!storedVersion) {
      // First time - just store the version
      localStorage.setItem(LOCAL_VERSION_KEY, currentDbVersion);
    }
  }, [dbVersion, hasCacheCleared]);

  return {
    version: dbVersion?.version_number ?? null,
    deployedAt: dbVersion?.deployed_at ?? null,
    isLoading,
    error,
    versionString: dbVersion ? `v${dbVersion.version_number.toFixed(2)}` : "v2.20",
  };
}

async function clearAllCaches(): Promise<void> {
  // Clear service worker caches
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );
  }

  // Clear session storage
  sessionStorage.clear();

  // Unregister service workers
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
  }
}
