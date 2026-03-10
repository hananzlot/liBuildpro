import { useEffect } from "react";

export default function RefreshPage() {
  useEffect(() => {
    (async () => {
      // 1. Clear IndexedDB
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      } catch {
        try { indexedDB.deleteDatabase("keyval-store"); } catch {}
      }

      // 2. Clear Cache API
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }

      // 3. Unregister service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // 4. Clear storage
      localStorage.removeItem("app_version_cache");
      sessionStorage.clear();

      // 5. Redirect with cache bust
      window.location.replace("/?_cb=" + Date.now());
    })();
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, border: "4px solid #ddd", borderTopColor: "#333",
          borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "1rem auto",
        }} />
        <h2>Refreshing iBuildPro...</h2>
        <p style={{ color: "#666" }}>Clearing cached data. You'll be redirected automatically.</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
