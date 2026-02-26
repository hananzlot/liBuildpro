import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get retention days from app_settings
    const { data: setting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "audit_log_retention_days")
      .single();

    const retentionDays = setting?.setting_value
      ? parseInt(setting.setting_value, 10)
      : 7;

    // Call the archive function
    const { data, error } = await supabase.rpc("archive_old_audit_logs", {
      p_retention_days: retentionDays,
    });

    if (error) throw error;

    console.log(`Archived ${data} audit log records (retention: ${retentionDays} days)`);

    return new Response(
      JSON.stringify({ archived: data, retention_days: retentionDays }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Archive audit logs error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
