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
    const { contactId, contactUuid, email, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating email for contact ${contactId || contactUuid} to: ${email} (local-only)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact - try by ghl_id first, then by UUID
    let contact = null;
    
    if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, email")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }
    
    // Fallback to UUID if ghl_id lookup failed
    if (!contact && contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, email")
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

    const oldEmail = contact.email || "";
    const newEmail = email?.trim() || "";

    // Update Supabase using UUID (more reliable than ghl_id)
    await supabase
      .from("contacts")
      .update({ email: newEmail || null, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("Contact email updated in Supabase");

    // Track the edit if value changed
    if (oldEmail !== newEmail && opportunityGhlId) {
      console.log(`Tracking email edit: "${oldEmail}" -> "${newEmail}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contact.ghl_id || null,
        field_name: "email",
        old_value: oldEmail || null,
        new_value: newEmail || null,
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
    console.error("Error updating email:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
