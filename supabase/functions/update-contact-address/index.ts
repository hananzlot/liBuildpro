import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default address field ID (used for custom_fields storage)
const ADDRESS_FIELD_ID = "b7oTVsUQrLgZt84bHpCn";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, contactUuid, address, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating address for contact ${contactId || contactUuid} (local-only)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact
    let contact = null;
    
    if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, custom_fields")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }
    
    if (!contact && contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, custom_fields")
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

    // Extract old address from custom_fields
    let oldAddress = "";
    if (Array.isArray(contact.custom_fields)) {
      const addressField = contact.custom_fields.find((f: { id: string; value?: string }) => f.id === ADDRESS_FIELD_ID);
      oldAddress = addressField?.value || "";
    }
    const newAddress = address || "";

    // Update Supabase custom_fields
    let customFields = Array.isArray(contact.custom_fields) ? [...contact.custom_fields] : [];
    const existingIndex = customFields.findIndex((f: { id: string }) => f.id === ADDRESS_FIELD_ID);
    if (existingIndex >= 0) {
      customFields[existingIndex] = { id: ADDRESS_FIELD_ID, value: newAddress };
    } else {
      customFields.push({ id: ADDRESS_FIELD_ID, value: newAddress });
    }

    await supabase
      .from("contacts")
      .update({ custom_fields: customFields, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("Contact address updated in Supabase");

    // Track the edit if value changed
    if (oldAddress !== newAddress && opportunityGhlId) {
      console.log(`Tracking address edit: "${oldAddress}" -> "${newAddress}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId || contact.ghl_id,
        field_name: "address",
        old_value: oldAddress || null,
        new_value: newAddress || null,
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
    console.error("Error updating address:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
