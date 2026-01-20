import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, locationId, apiKey, companyId, isPrimary } = await req.json();

    // Validate required fields
    if (!name || !locationId || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, locationId, apiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Test the API key with GHL
    console.log(`Testing GHL API key for location ${locationId}...`);
    const testResponse = await fetch(
      `https://services.leadconnectorhq.com/users/?locationId=${locationId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error("GHL API test failed:", errorText);
      return new Response(
        JSON.stringify({ 
          error: `Invalid API key or location ID. GHL returned: ${testResponse.status}`,
          details: errorText.substring(0, 200)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testData = await testResponse.json();
    console.log(`GHL API test successful. Found ${testData.users?.length || 0} users.`);

    // Step 2: If setting as primary, unset any existing primary for this company
    if (isPrimary && companyId) {
      console.log("Unsetting existing primary integration...");
      await supabase
        .from("company_integrations")
        .update({ is_primary: false })
        .eq("company_id", companyId)
        .eq("provider", "ghl")
        .eq("is_primary", true);
    }

    // Step 3: Check if integration already exists for this company + location
    const { data: existing } = await supabase
      .from("company_integrations")
      .select("id")
      .eq("provider", "ghl")
      .eq("location_id", locationId)
      .maybeSingle();

    let integrationId: string;

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("company_integrations")
        .update({
          company_id: companyId || null,
          name,
          is_primary: isPrimary || false,
          is_active: true,
          sync_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
      integrationId = existing.id;
      console.log(`Updated existing integration: ${integrationId}`);
    } else {
      // Insert new record
      const { data: newIntegration, error: insertError } = await supabase
        .from("company_integrations")
        .insert({
          company_id: companyId || null,
          provider: "ghl",
          name,
          location_id: locationId,
          is_primary: isPrimary || false,
          is_active: true,
          sync_status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      integrationId = newIntegration.id;
      console.log("Created new integration record:", integrationId);
    }

    // Step 4: Store the API key encrypted using pgcrypto
    console.log("Storing API key encrypted...");
    const { error: encryptError } = await supabase.rpc("store_ghl_api_key_encrypted", {
      p_api_key: apiKey,
      p_integration_id: integrationId,
    });

    if (encryptError) {
      console.error("Encryption storage error:", encryptError);
      throw new Error(`Failed to store API key: ${encryptError.message}`);
    }

    console.log("API key stored successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "GHL integration configured successfully",
        usersFound: testData.users?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in store-ghl-integration:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
