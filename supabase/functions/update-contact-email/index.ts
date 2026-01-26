import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { contactId, contactUuid, email, editedBy, opportunityGhlId, companyId } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating email for contact ${contactId || contactUuid} to: ${email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact - try by ghl_id first, then by UUID
    let contact = null;
    let contactError = null;
    
    if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, email")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
      contactError = result.error;
    }
    
    // Fallback to UUID if ghl_id lookup failed
    if (!contact && contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, email")
        .eq("id", contactUuid)
        .maybeSingle();
      contact = result.data;
      contactError = result.error;
    }

    if (contactError || !contact) {
      console.error("Contact lookup error:", contactError);
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldEmail = contact.email || "";
    const newEmail = email?.trim() || "";

    // Get API key - may be null if GHL is not configured
    const apiKey = await getGHLApiKey(supabase, contact.location_id);

    // Only call GHL API if credentials are configured AND contact has a ghl_id that's not local-only
    if (apiKey && contact.ghl_id && !contact.ghl_id.startsWith("local_")) {
      const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contact.ghl_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({ email: newEmail }),
      });

      if (!ghlResponse.ok) {
        const errorText = await ghlResponse.text();
        console.error("GHL API error:", ghlResponse.status, errorText);
        // Continue with local update even if GHL fails
        console.log("Continuing with local-only update");
      } else {
        console.log("GHL email update successful");
      }
    } else {
      console.log("Skipping GHL sync - credentials not configured or local-only contact");
    }

    // Update Supabase using UUID (more reliable than ghl_id)
    await supabase
      .from("contacts")
      .update({ email: newEmail || null, updated_at: new Date().toISOString() })
      .eq("id", contact.id);

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
