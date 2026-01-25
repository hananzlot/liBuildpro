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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const url = new URL(req.url);
    const portalToken = url.searchParams.get("portal_token");
    const portalType = url.searchParams.get("portal_type");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let companyId: string;
    let createdByType: string | null = null;
    let createdById: string | null = null;

    const authHeader = req.headers.get("Authorization");

    // Portal token flow
    if (portalToken && portalType) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (portalType === "customer") {
        const { data: tokenData, error: tokenError } = await supabase.rpc("validate_portal_token", {
          p_token: portalToken,
        });

        if (tokenError || !tokenData || tokenData.length === 0) {
          return new Response(JSON.stringify({ error: "Invalid or expired customer portal token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const token = tokenData[0];
        companyId = token.company_id;
        createdByType = "customer";
        createdById = token.id;
      } else if (portalType === "salesperson") {
        const { data: spToken, error: spError } = await supabase
          .from("salesperson_portal_tokens")
          .select("id, salesperson_id, company_id, is_active")
          .eq("token", portalToken)
          .eq("is_active", true)
          .maybeSingle();

        if (spError || !spToken) {
          return new Response(JSON.stringify({ error: "Invalid or expired salesperson portal token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        companyId = spToken.company_id;
        createdByType = "salesperson";
        createdById = spToken.salesperson_id;
      } else {
        return new Response(JSON.stringify({ error: "Invalid portal_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Portal users can only see their own links
      const { data: links, error: linksError, count } = await supabase
        .from("short_links")
        .select("id, short_code, custom_alias, long_url, title, is_active, click_count, expires_at, created_at", { count: "exact" })
        .eq("company_id", companyId)
        .eq("created_by_type", createdByType)
        .eq("created_by_id", createdById)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (linksError) {
        console.error("Query error:", linksError);
        return new Response(JSON.stringify({ error: "Failed to fetch links" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get company domain for short URLs
      const { data: companySetting } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      let baseDomain = companySetting?.setting_value;
      if (!baseDomain) {
        const { data: appSetting } = await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        baseDomain = appSetting?.setting_value;
      }

      const linksWithUrls = links?.map((link) => ({
        ...link,
        short_url: baseDomain ? `${baseDomain}/r/${link.custom_alias || link.short_code}` : `/r/${link.custom_alias || link.short_code}`,
      }));

      return new Response(
        JSON.stringify({
          links: linksWithUrls,
          total: count,
          page,
          limit,
          total_pages: Math.ceil((count || 0) / limit),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Internal user flow
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
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

    companyId = profile.company_id;

    // Internal users can see all links in their company
    const { data: links, error: linksError, count } = await supabaseUser
      .from("short_links")
      .select("id, short_code, custom_alias, long_url, title, is_active, click_count, expires_at, max_clicks, created_by_type, created_at, last_clicked_at", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (linksError) {
      console.error("Query error:", linksError);
      return new Response(JSON.stringify({ error: "Failed to fetch links" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company domain for short URLs
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const { data: companySetting } = await supabaseService
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", companyId)
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

    const linksWithUrls = links?.map((link) => ({
      ...link,
      short_url: baseDomain ? `${baseDomain}/r/${link.custom_alias || link.short_code}` : `/r/${link.custom_alias || link.short_code}`,
    }));

    return new Response(
      JSON.stringify({
        links: linksWithUrls,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
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
