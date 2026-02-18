import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityGhlId, opportunityId, scopeOfWork, editedBy, companyId } = await req.json();

    if (!opportunityGhlId && !opportunityId) {
      return new Response(
        JSON.stringify({ error: "opportunityGhlId or opportunityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine lookup strategy: prefer UUID when ghl_id is missing or a local ID
    const useUuid = !opportunityGhlId || opportunityGhlId.startsWith("local_");
    console.log(`Updating scope of work for opportunity ${useUuid ? `UUID:${opportunityId}` : `GHL:${opportunityGhlId}`}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch opportunity with current scope_of_work
    let oppQuery = supabase
      .from("opportunities")
      .select("scope_of_work, location_id, contact_id");

    if (useUuid && opportunityId) {
      oppQuery = oppQuery.eq("id", opportunityId);
    } else {
      oppQuery = oppQuery.eq("ghl_id", opportunityGhlId);
    }

    const { data: opportunity, error: oppError } = await oppQuery.single();

    if (oppError || !opportunity) {
      console.error("Opportunity lookup error:", oppError);
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldScope = opportunity.scope_of_work || "";
    const newScope = scopeOfWork || "";

    // Update opportunity in Supabase
    let updateQuery = supabase
      .from("opportunities")
      .update({ 
        scope_of_work: newScope, 
        updated_at: new Date().toISOString() 
      });

    if (useUuid && opportunityId) {
      updateQuery = updateQuery.eq("id", opportunityId);
    } else {
      updateQuery = updateQuery.eq("ghl_id", opportunityGhlId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Error updating opportunity:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update opportunity" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Opportunity scope update successful");

    // Track the edit if value changed
    if (oldScope !== newScope) {
      console.log(`Tracking scope edit: "${oldScope}" -> "${newScope}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: opportunity.contact_id || null,
        field_name: "scope_of_work",
        old_value: oldScope || null,
        new_value: newScope || null,
        edited_by: editedBy || null,
        location_id: opportunity.location_id,
        company_id: companyId || null,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error updating scope:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
