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
    const { contactId, contactUuid, firstName, lastName, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating name for contact ${contactId || contactUuid} to: ${firstName} ${lastName} (local-only)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact - try by ghl_id first, then by UUID
    let contact = null;
    
    if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, first_name, last_name, contact_name")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }
    
    // Fallback to UUID if ghl_id lookup failed
    if (!contact && contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, first_name, last_name, contact_name")
        .eq("id", contactUuid)
        .maybeSingle();
      contact = result.data;
    }

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldName = contact.contact_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "";
    const newName = `${firstName || ""} ${lastName || ""}`.trim();

    // Update Supabase using UUID (more reliable than ghl_id)
    await supabase
      .from("contacts")
      .update({ 
        first_name: firstName || null,
        last_name: lastName || null,
        contact_name: newName || null,
        updated_at: new Date().toISOString() 
      })
      .eq("id", contact.id);

    console.log("Contact name updated in Supabase");

    // Track the edit if value changed
    if (oldName !== newName && opportunityGhlId) {
      console.log(`Tracking name edit: "${oldName}" -> "${newName}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId || contact.ghl_id,
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
