import { del } from "idb-keyval";

const LOCAL_VERSION_KEY = "app_version_cache";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Pre-boot version check. Runs BEFORE React mounts.
 * Fetches the latest version from the DB using raw fetch (no React Query).
 * If the version has changed since last visit, clears all caches and reloads.
 * Returns true if the app should continue mounting, false if a reload was triggered.
 */
export async function checkVersionBeforeBoot(): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_version?select=version_number&order=deployed_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) {
      console.warn("Version check failed, continuing boot:", res.status);
      return true;
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) return true;

    const dbVersion = String(rows[0].version_number);
    const storedVersion = localStorage.getItem(LOCAL_VERSION_KEY);

    if (storedVersion && storedVersion !== dbVersion) {
      console.log(`Version mismatch: stored=${storedVersion}, db=${dbVersion}. Clearing caches...`);

      // Clear IDB React Query cache
      try {
        await del("react-query-cache");
      } catch (e) {
        console.warn("Failed to clear IDB:", e);
      }

      // Clear service worker caches
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }

      // Unregister service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // Clear session storage
      sessionStorage.clear();

      // Store the new version BEFORE reload so we don't loop
      localStorage.setItem(LOCAL_VERSION_KEY, dbVersion);

      // Reload the page
      window.location.reload();
      return false; // App should not mount
    }

    if (!storedVersion) {
      // First visit — store the current version
      localStorage.setItem(LOCAL_VERSION_KEY, dbVersion);
    }

    return true;
  } catch (e) {
    console.warn("Version check error, continuing boot:", e);
    return true;
  }
}
