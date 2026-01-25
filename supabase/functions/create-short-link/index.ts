import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base62 characters for short code generation
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateShortCode(length = 8): string {
  let result = "";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[randomBytes[i] % 62];
  }
  return result;
}

function validateLongUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }
  if (url.length > 2048) {
    return { valid: false, error: "URL must be 2048 characters or less" };
  }
  const urlLower = url.toLowerCase();
  if (!urlLower.startsWith("http://") && !urlLower.startsWith("https://")) {
    return { valid: false, error: "URL must start with http:// or https://" };
  }
  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "file:", "chrome:", "vbscript:"];
  if (dangerousProtocols.some((p) => urlLower.includes(p))) {
    return { valid: false, error: "URL contains forbidden protocol" };
  }
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

function validateCustomAlias(alias: string): { valid: boolean; error?: string } {
  if (!alias) return { valid: true }; // Optional
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(alias)) {
    return { valid: false, error: "Custom alias must be 3-40 characters, alphanumeric, underscores, or hyphens only" };
  }
  return { valid: true };
}

async function getCompanyDomain(supabase: any, companyId: string): Promise<string | null> {
  // Try company_settings first for app_base_url
  const { data: companySetting } = await supabase
    .from("company_settings")
    .select("setting_value")
    .eq("company_id", companyId)
    .eq("setting_key", "app_base_url")
    .maybeSingle();

  if (companySetting?.setting_value) {
    return companySetting.setting_value;
  }

  // Fall back to global app_settings
  const { data: appSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "app_base_url")
    .maybeSingle();

  return appSetting?.setting_value || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json();
    const { long_url, custom_alias, title, expires_at, max_clicks, portal_token, portal_type } = body;

    // Validate URL
    const urlValidation = validateLongUrl(long_url);
    if (!urlValidation.valid) {
      return new Response(JSON.stringify({ error: urlValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate custom alias if provided
    const aliasValidation = validateCustomAlias(custom_alias);
    if (!aliasValidation.valid) {
      return new Response(JSON.stringify({ error: aliasValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let companyId: string;
    let createdByType: string;
    let createdById: string;

    const authHeader = req.headers.get("Authorization");

    // Check for portal token flow (no auth header or explicit portal token)
    if (portal_token && portal_type) {
      // Portal access flow - use service role client
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (portal_type === "customer") {
        // Validate customer portal token using existing RPC
        const { data: tokenData, error: tokenError } = await supabase.rpc("validate_portal_token", {
          p_token: portal_token,
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
        // Use the portal token ID as the actor ID for customers
        createdById = token.id;
      } else if (portal_type === "salesperson") {
        // Validate salesperson portal token
        const { data: spToken, error: spError } = await supabase
          .from("salesperson_portal_tokens")
          .select("id, salesperson_id, company_id, is_active")
          .eq("token", portal_token)
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
        return new Response(JSON.stringify({ error: "Invalid portal_type. Must be 'customer' or 'salesperson'" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique short code with collision retry
      let shortCode: string;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        shortCode = generateShortCode(8);
        const { data: existing } = await supabase
          .from("short_links")
          .select("id")
          .eq("short_code", shortCode)
          .maybeSingle();

        if (!existing) break;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        return new Response(JSON.stringify({ error: "Failed to generate unique short code. Please try again." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check custom alias uniqueness if provided
      if (custom_alias) {
        const { data: existingAlias } = await supabase
          .from("short_links")
          .select("id")
          .eq("custom_alias", custom_alias)
          .maybeSingle();

        if (existingAlias) {
          return new Response(JSON.stringify({ error: "Custom alias already in use" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Insert the short link
      const { data: newLink, error: insertError } = await supabase
        .from("short_links")
        .insert({
          company_id: companyId,
          created_by_type: createdByType,
          created_by_id: createdById,
          long_url,
          short_code: shortCode!,
          custom_alias: custom_alias || null,
          title: title || null,
          expires_at: expires_at || null,
          max_clicks: max_clicks || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create short link" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get company domain for short URL
      const baseDomain = await getCompanyDomain(supabase, companyId);
      const code = custom_alias || shortCode!;
      const shortUrl = baseDomain ? `${baseDomain}/r/${code}` : `/r/${code}`;

      return new Response(
        JSON.stringify({
          id: newLink.id,
          short_url: shortUrl,
          short_code: newLink.short_code,
          custom_alias: newLink.custom_alias,
          long_url: newLink.long_url,
          created_at: newLink.created_at,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Internal user flow - requires JWT auth
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's JWT for auth context
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);

    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Get user's company from profile OR from request body (for super admins)
    const { data: profile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use company_id from request body if provided (for super admins), otherwise from profile
    const requestCompanyId = body.company_id;
    companyId = requestCompanyId || profile?.company_id;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "Company context required. Super admins must select a company." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    createdByType = "internal_user";
    createdById = userId;

    // Use service role for inserts to bypass RLS (we've already validated access)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique short code with collision retry
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      shortCode = generateShortCode(8);
      const { data: existing } = await supabaseService
        .from("short_links")
        .select("id")
        .eq("short_code", shortCode)
        .maybeSingle();

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({ error: "Failed to generate unique short code. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check custom alias uniqueness if provided
    if (custom_alias) {
      const { data: existingAlias } = await supabaseService
        .from("short_links")
        .select("id")
        .eq("custom_alias", custom_alias)
        .maybeSingle();

      if (existingAlias) {
        return new Response(JSON.stringify({ error: "Custom alias already in use" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert the short link
    const { data: newLink, error: insertError } = await supabaseService
      .from("short_links")
      .insert({
        company_id: companyId,
        created_by_type: createdByType,
        created_by_id: createdById,
        long_url,
        short_code: shortCode!,
        custom_alias: custom_alias || null,
        title: title || null,
        expires_at: expires_at || null,
        max_clicks: max_clicks || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create short link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company domain for short URL
    const baseDomain = await getCompanyDomain(supabaseService, companyId);
    const code = custom_alias || shortCode!;
    const shortUrl = baseDomain ? `${baseDomain}/r/${code}` : `/r/${code}`;

    return new Response(
      JSON.stringify({
        id: newLink.id,
        short_url: shortUrl,
        short_code: newLink.short_code,
        custom_alias: newLink.custom_alias,
        long_url: newLink.long_url,
        created_at: newLink.created_at,
      }),
      {
        status: 201,
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
