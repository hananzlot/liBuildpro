import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract link ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const linkId = pathParts[pathParts.length - 1];

    if (!linkId || linkId.length < 10) {
      return new Response(JSON.stringify({ error: "Link ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);

    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Get user's company
    const { data: profile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(JSON.stringify({ error: "User profile or company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify link belongs to user's company
    const { data: link, error: linkError } = await supabaseUser
      .from("short_links")
      .select("id, company_id, short_code, custom_alias, long_url, title, is_active, click_count, created_at, last_clicked_at, expires_at, max_clicks")
      .eq("id", linkId)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.company_id !== profile.company_id) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Get clicks for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: clicks, error: clicksError } = await supabaseService
      .from("short_link_clicks")
      .select("clicked_at, referer, device_type")
      .eq("short_link_id", linkId)
      .gte("clicked_at", thirtyDaysAgo.toISOString())
      .order("clicked_at", { ascending: true });

    if (clicksError) {
      console.error("Clicks query error:", clicksError);
      return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate clicks per day
    const clicksByDay: Record<string, number> = {};
    const refererCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};

    clicks?.forEach((click) => {
      // Group by date
      const date = click.clicked_at.split("T")[0];
      clicksByDay[date] = (clicksByDay[date] || 0) + 1;

      // Count referers
      const referer = click.referer || "direct";
      try {
        const refererHost = click.referer ? new URL(click.referer).hostname : "direct";
        refererCounts[refererHost] = (refererCounts[refererHost] || 0) + 1;
      } catch {
        refererCounts[referer] = (refererCounts[referer] || 0) + 1;
      }

      // Count devices
      const device = click.device_type || "unknown";
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    // Fill in missing days with 0
    const dailyClicks: { date: string; clicks: number }[] = [];
    const currentDate = new Date(thirtyDaysAgo);
    const today = new Date();
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split("T")[0];
      dailyClicks.push({
        date: dateStr,
        clicks: clicksByDay[dateStr] || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort referers by count
    const topReferers = Object.entries(refererCounts)
      .map(([referer, count]) => ({ referer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Device breakdown
    const deviceBreakdown = Object.entries(deviceCounts)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Get company domain for short URL
    const { data: companySetting } = await supabaseService
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", profile.company_id)
      .eq("setting_key", "app_base_url")
      .maybeSingle();

    let baseDomain = companySetting?.setting_value;
    if (!baseDomain) {
      const { data: appSetting } = await supabaseService
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_base_url")
        .maybeSingle();
      baseDomain = appSetting?.setting_value;
    }

    const shortUrl = baseDomain
      ? `${baseDomain}/r/${link.custom_alias || link.short_code}`
      : `/r/${link.custom_alias || link.short_code}`;

    return new Response(
      JSON.stringify({
        link: {
          ...link,
          short_url: shortUrl,
        },
        analytics: {
          total_clicks: link.click_count,
          clicks_last_30_days: clicks?.length || 0,
          daily_clicks: dailyClicks,
          top_referers: topReferers,
          device_breakdown: deviceBreakdown,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
