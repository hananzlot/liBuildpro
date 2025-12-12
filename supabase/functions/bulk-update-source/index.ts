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
    const { oldSource, newSource, editedBy } = await req.json();

    if (!oldSource || !newSource) {
      return new Response(
        JSON.stringify({ error: "oldSource and newSource are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Bulk updating source from "${oldSource}" to "${newSource}"`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all contacts with the old source (case-insensitive match)
    const { data: contacts, error: fetchError } = await supabase
      .from("contacts")
      .select("ghl_id, source, location_id")
      .ilike("source", oldSource);

    if (fetchError) {
      console.error("Error fetching contacts:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch contacts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: "No contacts found with that source" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${contacts.length} contacts to update`);

    // Get API keys for both locations
    const locationId1 = Deno.env.get("GHL_LOCATION_ID");
    const locationId2 = Deno.env.get("GHL_LOCATION_ID_2");
    const apiKey1 = Deno.env.get("GHL_API_KEY")!;
    const apiKey2 = Deno.env.get("GHL_API_KEY_2")!;

    let successCount = 0;
    let errorCount = 0;

    // Process contacts in batches to avoid rate limiting
    for (const contact of contacts) {
      try {
        // Determine which API key to use based on location
        const apiKey = contact.location_id === locationId2 ? apiKey2 : apiKey1;

        // Update in GHL
        const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contact.ghl_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify({ source: newSource }),
        });

        if (!ghlResponse.ok) {
          const errorText = await ghlResponse.text();
          console.error(`GHL API error for contact ${contact.ghl_id}:`, ghlResponse.status, errorText);
          errorCount++;
          continue;
        }

        // Update in Supabase
        await supabase
          .from("contacts")
          .update({ source: newSource, updated_at: new Date().toISOString() })
          .eq("ghl_id", contact.ghl_id);

        // Find related opportunity for edit tracking
        const { data: opportunity } = await supabase
          .from("opportunities")
          .select("ghl_id")
          .eq("contact_id", contact.ghl_id)
          .limit(1)
          .maybeSingle();

        // Track the edit
        if (opportunity) {
          await supabase.from("opportunity_edits").insert({
            opportunity_ghl_id: opportunity.ghl_id,
            contact_ghl_id: contact.ghl_id,
            field_name: "source",
            old_value: contact.source || null,
            new_value: newSource,
            edited_by: editedBy || null,
            location_id: contact.location_id,
          });
        }

        successCount++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error updating contact ${contact.ghl_id}:`, err);
        errorCount++;
      }
    }

    console.log(`Bulk update complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: successCount, 
        errors: errorCount,
        total: contacts.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in bulk update:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
