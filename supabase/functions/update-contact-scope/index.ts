import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLFieldMappings } from "../_shared/ghl-field-mappings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get GHL API key from database - returns null if not configured
async function getGHLApiKey(supabase: any, locationId: string | null): Promise<string | null> {
  if (!locationId || locationId === 'local') {
    return null;
  }

  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, api_key_encrypted")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_encrypted) {
    return null;
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key_encrypted",
    { p_integration_id: integration.id }
  );

  if (vaultError || !apiKey) {
    return null;
  }

  return apiKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, scopeOfWork, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId) {
      return new Response(
        JSON.stringify({ error: "contactId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating scope of work for contact ${contactId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact with current custom_fields to get old scope and location_id
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("location_id, custom_fields")
      .eq("ghl_id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("Contact lookup error:", contactError);
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get field mappings from database using location_id
    const fieldMappings = await getGHLFieldMappings(supabase, { locationId: contact.location_id });
    const SCOPE_OF_WORK_FIELD_ID = fieldMappings.scope_of_work || "KwQRtJT0aMSHnq3mwR68";

    // Extract old scope from custom_fields
    let oldScope = "";
    if (Array.isArray(contact.custom_fields)) {
      const scopeField = contact.custom_fields.find((f: { id: string; value?: string }) => f.id === SCOPE_OF_WORK_FIELD_ID);
      oldScope = scopeField?.value || "";
    }
    const newScope = scopeOfWork || "";


    // Get API key - may be null if GHL is not configured
    const apiKey = await getGHLApiKey(supabase, contact.location_id);

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
          customFields: [
            {
              id: SCOPE_OF_WORK_FIELD_ID,
              value: newScope,
            },
          ],
        }),
      });

      if (!ghlResponse.ok) {
        const errorText = await ghlResponse.text();
        console.error("GHL API error:", ghlResponse.status, errorText);
        // Continue with local update even if GHL fails
        console.log("Continuing with local-only update");
      } else {
        console.log("GHL scope update successful");
      }
    } else {
      console.log("Skipping GHL sync - credentials not configured or local-only contact");
    }

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
      .eq("ghl_id", contactId);

    // Track the edit if value changed
    if (oldScope !== newScope && opportunityGhlId) {
      console.log(`Tracking scope edit: "${oldScope}" -> "${newScope}"`);
      await supabase.from("opportunity_edits").insert({
        opportunity_ghl_id: opportunityGhlId,
        contact_ghl_id: contactId,
        field_name: "scope_of_work",
        old_value: oldScope || null,
        new_value: newScope || null,
        edited_by: editedBy || null,
        location_id: contact.location_id,
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
