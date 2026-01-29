import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PortalTokenRow = {
  id: string;
  company_id: string | null;
  project_id: string | null;
  estimate_id: string | null;
  expires_at: string | null;
  is_active: boolean | null;
};

function isTrue(value: unknown): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const token = body?.token as string | undefined;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate customer portal token via existing RPC
    const { data: tokenData, error: tokenError } = await supabase.rpc("validate_portal_token", {
      p_token: token,
    });

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid or expired portal token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenRow = (Array.isArray(tokenData) ? tokenData[0] : tokenData) as PortalTokenRow | undefined;
    if (!tokenRow?.company_id) {
      return new Response(JSON.stringify({ error: "Portal token missing company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = tokenRow.company_id;

    // Try explicit company setting first
    const { data: settingRow, error: settingError } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", companyId)
      .eq("setting_key", "compliance_package_enabled")
      .maybeSingle();

    if (!settingError && settingRow) {
      return new Response(
        JSON.stringify({ enabled: isTrue(settingRow.setting_value), company_id: companyId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: infer from active templates
    const { data: templateRow } = await supabase
      .from("compliance_document_templates")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({ enabled: !!templateRow?.id, company_id: companyId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("portal-compliance-enabled error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
