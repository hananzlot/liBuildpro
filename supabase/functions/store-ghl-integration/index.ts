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

    // Step 2: Store the API key in vault
    console.log("Storing API key in vault...");
    const keyName = `ghl_${companyId || "default"}_${locationId}`;
    
    const { data: vaultId, error: vaultError } = await supabase.rpc("store_ghl_api_key", {
      api_key: apiKey,
      key_name: keyName,
    });

    if (vaultError) {
      console.error("Vault storage error:", vaultError);
      throw new Error(`Failed to store API key securely: ${vaultError.message}`);
    }

    console.log(`API key stored in vault with ID: ${vaultId}`);

    // Step 3: If setting as primary, unset any existing primary for this company
    if (isPrimary && companyId) {
      console.log("Unsetting existing primary integration...");
      await supabase
        .from("company_integrations")
        .update({ is_primary: false })
        .eq("company_id", companyId)
        .eq("provider", "ghl")
        .eq("is_primary", true);
    }

    // Step 4: Create or update the integration record
    console.log("Creating/updating integration record...");
    const integrationData = {
      company_id: companyId || null,
      provider: "ghl",
      name,
      location_id: locationId,
      api_key_vault_id: vaultId,
      is_primary: isPrimary || false,
      is_active: true,
      sync_status: "pending",
      updated_at: new Date().toISOString(),
    };

    // Check if integration already exists for this company + location
    const { data: existing } = await supabase
      .from("company_integrations")
      .select("id, api_key_vault_id")
      .eq("provider", "ghl")
      .eq("location_id", locationId)
      .eq("company_id", companyId || "")
      .maybeSingle();

    if (existing) {
      // Delete old vault secret if exists
      if (existing.api_key_vault_id && existing.api_key_vault_id !== vaultId) {
        await supabase.rpc("delete_ghl_api_key", { secret_id: existing.api_key_vault_id });
      }

      // Update existing
      const { error: updateError } = await supabase
        .from("company_integrations")
        .update(integrationData)
        .eq("id", existing.id);

      if (updateError) throw updateError;
      console.log(`Updated existing integration: ${existing.id}`);
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from("company_integrations")
        .insert({
          ...integrationData,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      console.log("Created new integration record");
    }

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
