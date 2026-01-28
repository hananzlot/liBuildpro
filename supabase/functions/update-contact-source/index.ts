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
    const { contactId, contactUuid, source, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating source for contact ${contactId || contactUuid} to: ${source} (local-only)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact
    let contact = null;
    
    if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, source")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }
    
    if (!contact && contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, source")
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

    const oldSource = contact.source || "";
    const newSource = source || "";

    // Update Supabase
    await supabase
      .from("contacts")
      .update({ source: newSource || null, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("Contact source updated in Supabase");

    // Track the edit if value changed
    if (oldSource !== newSource && opportunityGhlId) {
      console.log(`Tracking source edit: "${oldSource}" -> "${newSource}"`);
      const { error: editError } = await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId || contact.ghl_id,
        field_name: "source",
        old_value: oldSource || null,
        new_value: newSource || null,
        edited_by: editedBy || null,
        location_id: contact.location_id,
        company_id: companyId || null,
      });
      if (editError) {
        console.error("Error tracking edit:", editError);
      } else {
        console.log("Edit tracked successfully");
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error updating source:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
