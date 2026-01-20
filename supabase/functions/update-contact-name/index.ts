import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get GHL API key - returns null if not configured (graceful degradation)
function getGHLApiKey(locationId: string | null): string | null {
  const locationId2 = Deno.env.get("GHL_LOCATION_ID_2");
  
  if (locationId === locationId2) {
    return Deno.env.get("GHL_API_KEY_2") || null;
  }
  return Deno.env.get("GHL_API_KEY") || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, firstName, lastName, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId) {
      return new Response(
        JSON.stringify({ error: "contactId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating name for contact ${contactId} to: ${firstName} ${lastName}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact to get location_id and current name
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("location_id, first_name, last_name, contact_name")
      .eq("ghl_id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("Contact lookup error:", contactError);
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldName = contact.contact_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "";
    const newName = `${firstName || ""} ${lastName || ""}`.trim();

    // Get API key - may be null if GHL is not configured
    const apiKey = getGHLApiKey(contact.location_id);

    // Only call GHL API if credentials are configured AND contact is not local-only
    if (apiKey && !contactId.startsWith("local_")) {
      const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({ 
          firstName: firstName || "", 
          lastName: lastName || "" 
        }),
      });

      if (!ghlResponse.ok) {
        const errorText = await ghlResponse.text();
        console.error("GHL API error:", ghlResponse.status, errorText);
        // Continue with local update even if GHL fails
        console.log("Continuing with local-only update");
      } else {
        console.log("GHL name update successful");
      }
    } else {
      console.log("Skipping GHL sync - credentials not configured or local-only contact");
    }

    // Update Supabase
    await supabase
      .from("contacts")
      .update({ 
        first_name: firstName || null,
        last_name: lastName || null,
        contact_name: newName || null,
        updated_at: new Date().toISOString() 
      })
      .eq("ghl_id", contactId);

    // Track the edit if value changed
    if (oldName !== newName && opportunityGhlId) {
      console.log(`Tracking name edit: "${oldName}" -> "${newName}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId,
        field_name: "contact_name",
        old_value: oldName || null,
        new_value: newName || null,
        edited_by: editedBy || null,
        location_id: contact.location_id,
        company_id: companyId || null,
      });
    }

    return new Response(
      JSON.stringify({ success: true, newName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error updating name:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
