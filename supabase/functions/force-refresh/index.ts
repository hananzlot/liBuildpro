import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Refreshing iBuildPro...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .box { text-align: center; padding: 2rem; }
    .spinner { width: 40px; height: 40px; border: 4px solid #ddd; border-top-color: #333; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 1rem auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>Refreshing iBuildPro...</h2>
    <p style="color:#666">Clearing cached data. You'll be redirected automatically.</p>
  </div>
  <script>
    (async function() {
      var target = 'https://ibuildpro.lovable.app';

      // 1. Clear IndexedDB on the target origin
      // We can't clear cross-origin IDB directly, so we'll redirect with a flag
      // that main.tsx can pick up

      // Set a flag in a way the target origin can read
      // We'll use a URL param approach

      // Redirect to target with cache-bust and clear flag
      window.location.replace(target + '/?_force_clear=1&_cb=' + Date.now());
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
