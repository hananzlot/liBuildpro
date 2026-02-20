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
    const { contactId, contactUuid, phone, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating phone for contact ${contactId || contactUuid} to: ${phone} (local-only)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact - prefer UUID lookup, then ghl_id scoped by company
    let contact = null;
    
    if (contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, phone")
        .eq("id", contactUuid)
        .maybeSingle();
      contact = result.data;
    }
    
    if (!contact && contactId) {
      let query = supabase
        .from("contacts")
        .select("id, ghl_id, location_id, phone")
        .eq("ghl_id", contactId);
      
      // Scope by company_id to prevent cross-company updates
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      
      const result = await query.maybeSingle();
      contact = result.data;
    }

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldPhone = contact.phone || "";
    const newPhone = phone || "";

    // Update Supabase
    await supabase
      .from("contacts")
      .update({ phone: newPhone || null, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("Contact phone updated in Supabase");

    // Track the edit if value changed
    if (oldPhone !== newPhone && opportunityGhlId) {
      console.log(`Tracking phone edit: "${oldPhone}" -> "${newPhone}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId || contact.ghl_id,
        field_name: "phone",
        old_value: oldPhone || null,
        new_value: newPhone || null,
        edited_by: editedBy || null,
        location_id: contact.location_id,
        company_id: companyId || null,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error updating phone:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
