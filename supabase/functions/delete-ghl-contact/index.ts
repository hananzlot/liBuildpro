import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get GHL API key from database
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
    const { contactId, contactUuid, deleteFromGHL = false } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleting contact ${contactId || contactUuid}, deleteFromGHL: ${deleteFromGHL}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact
    let contact = null;
    
    if (contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, contact_name")
        .eq("id", contactUuid)
        .maybeSingle();
      contact = result.data;
    } else if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, contact_name")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally delete from GHL first
    if (deleteFromGHL && contact.ghl_id && !contact.ghl_id.startsWith("local_")) {
      const apiKey = await getGHLApiKey(supabase, contact.location_id);
      
      if (apiKey) {
        console.log(`Attempting to delete contact ${contact.ghl_id} from GHL`);
        const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contact.ghl_id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Version: "2021-07-28",
          },
        });

        if (!ghlResponse.ok) {
          const errorText = await ghlResponse.text();
          console.error("GHL API delete error:", ghlResponse.status, errorText);
          // Continue with local delete even if GHL fails
        } else {
          console.log("GHL contact delete successful");
        }
      }
    }

    // Delete related records first (those with ON DELETE SET NULL won't cascade)
    // Contact notes have ON DELETE CASCADE, so they'll be deleted automatically
    
    // Update opportunities to remove contact reference
    await supabase
      .from("opportunities")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Update appointments to remove contact reference
    await supabase
      .from("appointments")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Update projects to remove contact reference
    await supabase
      .from("projects")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Update estimates to remove contact reference
    await supabase
      .from("estimates")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Delete the contact
    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id);

    if (deleteError) {
      console.error("Error deleting contact:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete contact", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully deleted contact ${contact.id}`);

    return new Response(
      JSON.stringify({ success: true, deletedContactId: contact.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in delete-ghl-contact:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
