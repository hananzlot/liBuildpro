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
    const { opportunityGhlId, opportunityId, address, editedBy, companyId } = await req.json();

    if (!opportunityGhlId && !opportunityId) {
      return new Response(
        JSON.stringify({ error: "opportunityGhlId or opportunityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefer UUID lookup when ghl_id is missing or a local ID
    const useUuid = !opportunityGhlId || opportunityGhlId.startsWith("local_");
    console.log(`Updating address for opportunity ${useUuid ? `UUID:${opportunityId}` : `GHL:${opportunityGhlId}`}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch opportunity with current address
    let fetchQuery = supabase
      .from("opportunities")
      .select("address, location_id, contact_id, company_id");

    if (useUuid && opportunityId) {
      fetchQuery = fetchQuery.eq("id", opportunityId);
    } else {
      fetchQuery = fetchQuery.eq("ghl_id", opportunityGhlId);
    }

    const { data: opportunity, error: oppError } = await fetchQuery.single();

    if (oppError || !opportunity) {
      console.error("Error fetching opportunity:", oppError);
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldAddress = opportunity.address || "";
    const newAddress = address || "";
    const effectiveCompanyId = companyId || opportunity.company_id || null;

    // Update opportunity address
    let updateQuery = supabase
      .from("opportunities")
      .update({ address: newAddress, updated_at: new Date().toISOString() });

    if (useUuid && opportunityId) {
      updateQuery = updateQuery.eq("id", opportunityId);
    } else {
      updateQuery = updateQuery.eq("ghl_id", opportunityGhlId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Error updating opportunity address:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update address" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log edit if value changed
    if (oldAddress !== newAddress) {
      const editGhlId = opportunityGhlId || `local_opp_${opportunityId}`;
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: editGhlId,
        contact_ghl_id: opportunity.contact_id || null,
        field_name: "address",
        old_value: oldAddress || null,
        new_value: newAddress || null,
        edited_by: editedBy || null,
        location_id: opportunity.location_id || null,
        company_id: effectiveCompanyId,
      });
      console.log(`Address updated for opportunity ${editGhlId}: "${oldAddress}" -> "${newAddress}"`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in update-opportunity-address:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
