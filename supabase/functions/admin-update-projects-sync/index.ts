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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { companyId, daysBack } = await req.json();

    if (!companyId) {
      throw new Error("companyId is required");
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (daysBack || 4));

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update({ auto_sync_to_quickbooks: true })
      .eq("company_id", companyId)
      .eq("auto_sync_to_quickbooks", false)
      .gte("created_at", cutoffDate.toISOString())
      .select("id, project_name");

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, updated: data?.length || 0, projects: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
