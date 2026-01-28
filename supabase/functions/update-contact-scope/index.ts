import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default scope of work field ID (used for custom_fields storage)
const SCOPE_OF_WORK_FIELD_ID = "KwQRtJT0aMSHnq3mwR68";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, contactUuid, scopeOfWork, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating scope of work for contact ${contactId || contactUuid} (local-only)`);

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

    // Extract old scope from custom_fields
    let oldScope = "";
    if (Array.isArray(contact.custom_fields)) {
      const scopeField = contact.custom_fields.find((f: { id: string; value?: string }) => f.id === SCOPE_OF_WORK_FIELD_ID);
      oldScope = scopeField?.value || "";
    }
    const newScope = scopeOfWork || "";

    // Update Supabase custom_fields
    let customFields = Array.isArray(contact.custom_fields) ? [...contact.custom_fields] : [];
    const existingIndex = customFields.findIndex((f: { id: string }) => f.id === SCOPE_OF_WORK_FIELD_ID);
    if (existingIndex >= 0) {
      customFields[existingIndex] = { id: SCOPE_OF_WORK_FIELD_ID, value: newScope };
    } else {
      customFields.push({ id: SCOPE_OF_WORK_FIELD_ID, value: newScope });
    }

    await supabase
      .from("contacts")
      .update({ custom_fields: customFields, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("Contact scope of work updated in Supabase");

    // Track the edit if value changed
    if (oldScope !== newScope && opportunityGhlId) {
      console.log(`Tracking scope edit: "${oldScope}" -> "${newScope}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId || contact.ghl_id,
        field_name: "scope_of_work",
        old_value: oldScope || null,
        new_value: newScope || null,
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
    console.error("Error updating scope:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
