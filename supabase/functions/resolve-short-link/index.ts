import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  // Simple hash for privacy - not cryptographically secure but good for analytics
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function detectDeviceType(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "bot";
  }
  return "desktop";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract code from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const code = pathParts[pathParts.length - 1];

    if (!code || code.length < 3) {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up by custom_alias first, then short_code
    let { data: link, error } = await supabase
      .from("short_links")
      .select("id, long_url, is_active, expires_at, max_clicks, click_count")
      .eq("custom_alias", code)
      .eq("is_active", true)
      .maybeSingle();

    if (!link) {
      const result = await supabase
        .from("short_links")
        .select("id, long_url, is_active, expires_at, max_clicks, click_count")
        .eq("short_code", code)
        .eq("is_active", true)
        .maybeSingle();
      
      link = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Lookup error:", error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!link) {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Check if link is active
    if (!link.is_active) {
      return new Response("Link is no longer active", {
        status: 410,
        headers: corsHeaders,
      });
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response("Link has expired", {
        status: 410,
        headers: corsHeaders,
      });
    }

    // Check max clicks
    if (link.max_clicks !== null && link.click_count >= link.max_clicks) {
      return new Response("Link has reached maximum clicks", {
        status: 410,
        headers: corsHeaders,
      });
    }

    // Extract request metadata
    const userAgent = req.headers.get("user-agent");
    const referer = req.headers.get("referer");
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIP = req.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIP || null;

    // Atomic update: increment click count and update last_clicked_at
    const { error: updateError } = await supabase
      .from("short_links")
      .update({
        click_count: link.click_count + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    if (updateError) {
      console.error("Click count update error:", updateError);
      // Continue with redirect even if update fails
    }

    // Log click event (async, don't wait)
    supabase
      .from("short_link_clicks")
      .insert({
        short_link_id: link.id,
        ip_hash: hashIP(ip),
        user_agent: userAgent?.substring(0, 500) || null,
        referer: referer?.substring(0, 500) || null,
        device_type: detectDeviceType(userAgent),
      })
      .then(({ error: clickError }) => {
        if (clickError) {
          console.error("Click log error:", clickError);
        }
      });

    // Return 302 redirect
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: link.long_url,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
