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
    const { opportunityGhlId, address, editedBy } = await req.json();

    if (!opportunityGhlId) {
      return new Response(
        JSON.stringify({ error: "opportunityGhlId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch opportunity with current address
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select("address, location_id, contact_id")
      .eq("ghl_id", opportunityGhlId)
      .single();

    if (oppError) {
      console.error("Error fetching opportunity:", oppError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch opportunity" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldAddress = opportunity.address || "";
    const newAddress = address || "";

    // Update opportunity address
    const { error: updateError } = await supabase
      .from("opportunities")
      .update({ 
        address: newAddress, 
        updated_at: new Date().toISOString() 
      })
      .eq("ghl_id", opportunityGhlId);

    if (updateError) {
      console.error("Error updating opportunity address:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update address" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log edit if value changed
    if (oldAddress !== newAddress) {
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: opportunity.contact_id || null,
        field_name: "address",
        old_value: oldAddress || null,
        new_value: newAddress || null,
        edited_by: editedBy || null,
        location_id: opportunity.location_id || null,
      });
      console.log(`Address updated for opportunity ${opportunityGhlId}: "${oldAddress}" -> "${newAddress}"`);
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
