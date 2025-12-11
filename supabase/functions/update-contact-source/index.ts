import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, source } = await req.json();

    if (!contactId) {
      return new Response(
        JSON.stringify({ error: "contactId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating source for contact ${contactId} to: ${source}`);

    // First, fetch the contact to get its location_id
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("location_id")
      .eq("ghl_id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("Contact lookup error:", contactError);
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which API key to use based on location_id
    const locationId1 = Deno.env.get("GHL_LOCATION_ID");
    const locationId2 = Deno.env.get("GHL_LOCATION_ID_2");
    let apiKey: string;

    if (contact.location_id === locationId2) {
      apiKey = Deno.env.get("GHL_API_KEY_2")!;
    } else {
      apiKey = Deno.env.get("GHL_API_KEY")!;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the contact in GHL with the new source
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        source: source || "",
      }),
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error("GHL API error:", ghlResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `GHL API error: ${ghlResponse.status}` }),
        { status: ghlResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlData = await ghlResponse.json();
    console.log("GHL update successful:", ghlData.contact?.id);

    // Update the contact in Supabase
    await supabase
      .from("contacts")
      .update({ source: source || null, updated_at: new Date().toISOString() })
      .eq("ghl_id", contactId);

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
